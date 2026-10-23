import mongoose from 'mongoose';
import { Attendance, Case, Client, Invoice, Leave, User } from '../models/index.js';

function parseWorkday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function requirePeopleManager(req, res) {
  if (!['admin', 'hr'].includes(req.user.role)) {
    res.status(403).json({ message: 'Only HR or an admin can manage attendance and leave reviews' });
    return false;
  }
  return true;
}

async function upsertAttendanceMarks(entries) {
  if (!entries.length) return;
  const employeeIds = [...new Set(entries.map((entry) => String(entry.employeeId)))];
  const firstDate = new Date(Math.min(...entries.map((entry) => entry.date.getTime())));
  const lastDate = new Date(Math.max(...entries.map((entry) => entry.date.getTime())) + 86400000);
  const existing = await Attendance.find({
    employeeId: { $in: employeeIds }, date: { $gte: firstDate, $lt: lastDate }
  }).sort({ updatedAt: -1, _id: -1 }).lean();
  const grouped = new Map();
  for (const mark of existing) {
    const key = `${mark.employeeId}:${new Date(mark.date).toISOString().slice(0, 10)}`;
    grouped.set(key, [...(grouped.get(key) || []), mark]);
  }
  const duplicateIds = [];
  const operations = entries.map((entry) => {
    const key = `${entry.employeeId}:${entry.date.toISOString().slice(0, 10)}`;
    const matches = grouped.get(key) || [];
    const canonical = matches.find((mark) => new Date(mark.date).getTime() === entry.date.getTime()) || matches[0];
    duplicateIds.push(...matches.filter((mark) => mark !== canonical).map((mark) => mark._id));
    return {
      updateOne: {
        filter: canonical ? { _id: canonical._id } : { employeeId: entry.employeeId, date: entry.date },
        update: {
          $set: {
            employeeId: entry.employeeId,
            name: entry.name,
            date: entry.date,
            status: entry.status,
            checkIn: entry.checkIn || '',
            checkOut: entry.checkOut || ''
          }
        },
        upsert: !canonical
      }
    };
  });
  await Attendance.bulkWrite(operations);
  if (duplicateIds.length) await Attendance.deleteMany({ _id: { $in: duplicateIds } });
}

export async function attendanceWorkday(req, res, next) {
  try {
    if (!requirePeopleManager(req, res)) return;
    const date = parseWorkday(req.query.date);
    if (!date) return res.status(400).json({ message: 'A valid work date in YYYY-MM-DD format is required' });
    const nextDay = new Date(date.getTime() + 86400000);
    const [employees, marks] = await Promise.all([
      User.find({ role: 'employee', active: { $ne: false } })
        .select('name email phone department designation').sort({ name: 1 }).lean(),
      Attendance.find({ date: { $gte: date, $lt: nextDay } }).select('employeeId status checkIn checkOut').lean()
    ]);
    const markByEmployee = new Map(marks.map((mark) => [String(mark.employeeId), mark]));
    return res.json({
      data: employees.map((employee) => {
        const mark = markByEmployee.get(String(employee._id));
        return {
          ...employee,
          id: String(employee._id),
          attendanceId: mark?._id,
          status: mark?.status || 'Unmarked',
          checkIn: mark?.checkIn || '',
          checkOut: mark?.checkOut || ''
        };
      }),
      date: date.toISOString().slice(0, 10)
    });
  } catch (error) {
    next(error);
  }
}

export async function saveAttendanceWorkday(req, res, next) {
  try {
    if (!requirePeopleManager(req, res)) return;
    const date = parseWorkday(req.body.date);
    const entries = req.body.entries;
    if (!date) return res.status(400).json({ message: 'A valid work date in YYYY-MM-DD format is required' });
    if (!Array.isArray(entries) || entries.length > 500) {
      return res.status(400).json({ message: 'Attendance entries must be an array of up to 500 employees' });
    }
    const seen = new Set();
    for (const entry of entries) {
      const employeeId = String(entry.employeeId || '');
      if (!mongoose.isValidObjectId(employeeId) || seen.has(employeeId)) {
        return res.status(400).json({ message: 'Attendance entries must contain unique, valid employee IDs' });
      }
      if (!['Present', 'Absent', 'Leave'].includes(entry.status)) {
        return res.status(400).json({ message: 'Attendance status must be Present, Absent or Leave' });
      }
      seen.add(employeeId);
    }
    const employees = await User.find({
      _id: { $in: [...seen] }, role: 'employee', active: { $ne: false }
    }).select('_id name').lean();
    if (employees.length !== seen.size) {
      return res.status(400).json({ message: 'One or more selected employees are unavailable or inactive' });
    }
    const employeeById = new Map(employees.map((employee) => [String(employee._id), employee]));
    await upsertAttendanceMarks(entries.map((entry) => ({
      employeeId: employeeById.get(String(entry.employeeId))._id,
      name: employeeById.get(String(entry.employeeId)).name,
      date,
      status: entry.status,
      checkIn: String(entry.checkIn || '').slice(0, 5),
      checkOut: String(entry.checkOut || '').slice(0, 5)
    })));
    const nextDay = new Date(date.getTime() + 86400000);
    const marks = await Attendance.find({ employeeId: { $in: [...seen] }, date: { $gte: date, $lt: nextDay } }).lean();
    return res.json({ data: marks, message: 'Attendance saved successfully' });
  } catch (error) {
    next(error);
  }
}

export async function reviewLeave(req, res, next) {
  try {
    if (!requirePeopleManager(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid leave request id' });
    const status = String(req.body.status || '');
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Review status must be Approved or Rejected' });
    }

    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, status: 'Pending' },
      {
        $set: {
          status,
          reviewNote: String(req.body.reviewNote || '').trim().slice(0, 1000),
          reviewedBy: req.user._id,
          reviewedAt: new Date()
        },
        ...(status === 'Rejected' ? { $unset: { requestKey: 1 } } : {})
      },
      { new: true, runValidators: true }
    );
    if (!leave) {
      if (!await Leave.exists({ _id: req.params.id })) return res.status(404).json({ message: 'Leave request not found' });
      return res.status(409).json({ message: 'This leave request has already been reviewed' });
    }

    if (status === 'Approved') {
      const employee = await User.findOne({ _id: leave.employeeId, role: 'employee' }).select('name').lean();
      if (employee) {
        const from = new Date(Date.UTC(leave.from.getUTCFullYear(), leave.from.getUTCMonth(), leave.from.getUTCDate()));
        const to = new Date(Date.UTC(leave.to.getUTCFullYear(), leave.to.getUTCMonth(), leave.to.getUTCDate()));
        const marks = [];
        for (let day = from; day <= to; day = new Date(day.getTime() + 86400000)) {
          marks.push({
            employeeId: leave.employeeId,
            name: employee.name,
            date: day,
            status: 'Leave'
          });
        }
        await upsertAttendanceMarks(marks);
      }
    }

    return res.json({ data: leave });
  } catch (error) {
    next(error);
  }
}

export async function billingOptions(req, res, next) {
  try {
    if (!['admin', 'accountant'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only an admin or accountant can access invoice options' });
    }
    const [clients, completedCases] = await Promise.all([
      Client.find({ status: { $ne: 'Inactive' } }).select('name email').sort({ name: 1 }).lean(),
      Case.find({ status: 'Completed', progress: 100 }).select('_id title clientId fee').sort({ updatedAt: -1 }).lean()
    ]);
    const existingInvoices = await Invoice.find({ caseId: { $in: completedCases.map((item) => item._id) } })
      .select('caseId number amount status autoGenerated invoiceDate dueAt description').lean();
    const invoiceByCase = new Map(existingInvoices.map((invoice) => [String(invoice.caseId), invoice]));
    return res.json({
      data: {
        clients: clients.map(({ _id, ...client }) => ({ id: String(_id), ...client })),
        cases: completedCases.filter((item) => {
          const invoice = invoiceByCase.get(String(item._id));
          return !invoice || (invoice.autoGenerated && !['Paid', 'Cancelled'].includes(invoice.status));
        }).map((item) => {
          const invoice = invoiceByCase.get(String(item._id));
          return {
            id: String(item._id), title: item.title, clientId: String(item.clientId), fee: item.fee,
            invoiceId: invoice?._id ? String(invoice._id) : '',
            invoiceNumber: invoice?.number || '',
            invoiceAmount: invoice?.amount,
            invoiceDate: invoice?.invoiceDate,
            dueAt: invoice?.dueAt,
            description: invoice?.description || ''
          };
        })
      }
    });
  } catch (error) {
    next(error);
  }
}
