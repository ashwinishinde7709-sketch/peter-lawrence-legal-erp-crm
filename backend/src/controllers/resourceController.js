import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {
  User, Client, Case, Hearing, Appointment, Document, Invoice, Payment, Receipt,
  Message, Candidate, Payroll, Attendance, Leave, Task, Expense, Notification,
  caseQueryForUser
} from '../models/index.js';

const map = {
  clients: Client,
  cases: Case,
  hearings: Hearing,
  appointments: Appointment,
  documents: Document,
  invoices: Invoice,
  payments: Payment,
  receipts: Receipt,
  messages: Message,
  candidates: Candidate,
  payroll: Payroll,
  attendance: Attendance,
  leave: Leave,
  tasks: Task,
  expenses: Expense,
  notifications: Notification
};

const access = {
  users: { get: ['admin'], post: ['admin'], put: ['admin'], delete: ['admin'] },
  lawyers: { get: ['admin', 'reception', 'lawyer'], put: ['admin'], delete: ['admin'] },
  employees: { get: ['admin', 'hr'], post: ['admin', 'hr'], put: ['admin', 'hr'], delete: ['admin', 'hr'] },
  clients: { get: ['admin', 'reception', 'lawyer'], post: ['admin', 'reception'], put: ['admin', 'reception'], delete: ['admin'] },
  cases: { get: ['admin', 'lawyer', 'client'], post: [], put: ['admin'], delete: ['admin'] },
  hearings: { get: ['admin', 'lawyer'], post: ['admin', 'lawyer'], put: ['admin', 'lawyer'], delete: ['admin'] },
  appointments: { get: ['admin', 'reception', 'lawyer', 'client'], post: ['admin', 'reception', 'lawyer', 'client'], put: ['admin', 'reception', 'lawyer'], delete: ['admin', 'reception'] },
  documents: { get: ['admin', 'lawyer', 'client'], post: ['admin', 'lawyer'], put: ['admin', 'lawyer'], delete: ['admin'] },
  invoices: { get: ['admin', 'accountant', 'client'], post: ['admin', 'accountant'], put: [], delete: [] },
  payments: { get: ['admin', 'accountant', 'client'], post: [], put: [], delete: [] },
  receipts: { get: ['admin', 'accountant', 'client'], post: [], put: [], delete: [] },
  messages: { get: ['admin', 'lawyer', 'client'], post: ['admin', 'lawyer', 'client'], put: [], delete: ['admin'] },
  candidates: { get: ['admin', 'hr'], post: ['admin', 'hr'], put: ['admin', 'hr'], delete: ['admin'] },
  payroll: { get: ['admin', 'accountant', 'hr', 'employee'], post: ['admin', 'hr'], put: ['admin', 'accountant', 'hr'], delete: ['admin'] },
  attendance: { get: ['admin', 'hr', 'employee'], post: ['admin', 'hr'], put: ['admin', 'hr'], delete: ['admin'] },
  leave: { get: ['admin', 'hr', 'employee'], post: ['employee'], put: [], delete: [] },
  tasks: { get: ['admin', 'lawyer', 'employee'], post: ['admin', 'lawyer'], put: ['admin', 'lawyer'], delete: ['admin'] },
  expenses: { get: ['admin', 'accountant'], post: ['admin', 'accountant'], put: ['admin', 'accountant'], delete: ['admin'] },
  notifications: { get: ['admin', 'lawyer', 'client', 'accountant', 'reception', 'hr', 'employee'], post: ['admin'], put: ['admin'], delete: ['admin'] }
};

const normalize = (resource, item) => {
  const row = item.toObject ? item.toObject() : { ...item };
  if (['users', 'lawyers', 'employees'].includes(resource)) delete row.passwordHash;
  row.id = row._id?.toString?.() || row.id;
  if (['users', 'lawyers', 'employees'].includes(resource)) {
    row.status = row.active === false || row.status === 'Inactive' ? 'Inactive' : 'Active';
    row.initials = String(row.name || 'U').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }
  if (resource === 'clients') {
    row.avatar = String(row.name || 'CL').slice(0, 2).toUpperCase();
    row.cases = row.cases || 0;
    row.joined = row.joined ? new Date(row.joined).toLocaleDateString() : '—';
  }
  if (resource === 'invoices') {
    row.due = row.due || (row.dueAt ? new Date(row.dueAt).toLocaleDateString() : '—');
    if (['pending', 'outstanding'].includes(String(row.status || '').toLowerCase()) && row.dueAt && new Date(row.dueAt) < new Date()) {
      row.status = 'Overdue';
    } else if (String(row.status || '').toLowerCase() === 'outstanding') {
      row.status = 'Pending';
    }
  }
  if (resource === 'payroll') {
    row.basicSalary = row.basicSalary ?? row.salary ?? 0;
    row.allowances = row.allowances ?? row.bonus ?? 0;
    row.salaryMonth = row.salaryMonth || (row.payDate ? new Date(row.payDate).toISOString().slice(0, 7) : '');
  }
  return row;
};

function permitted(resource, action, role) {
  return access[resource]?.[action]?.includes(role) || false;
}

async function visibleQuery(resource, user) {
  if (resource === 'users') return {};
  if (resource === 'lawyers') return { role: 'lawyer' };
  if (resource === 'employees') return { role: 'employee' };
  if (resource === 'cases') return caseQueryForUser(user);
  if (resource === 'hearings' && user.role === 'lawyer') {
    const caseIds = await Case.distinct('_id', { lawyerId: user._id });
    return { caseId: { $in: caseIds } };
  }
  if (resource === 'clients') {
    if (user.role === 'client') return { userId: user._id };
    if (user.role === 'lawyer') {
      const clientIds = await Case.distinct('clientId', { lawyerId: user._id });
      return { _id: { $in: clientIds } };
    }
  }
  if (resource === 'appointments') {
    if (user.role === 'client') {
      const client = await Client.findOne({ userId: user._id }).select('_id').lean();
      return client ? { clientId: client._id } : { _id: { $in: [] } };
    }
    if (user.role === 'lawyer') return { lawyerId: user._id };
  }
  if (resource === 'documents') {
    if (user.role === 'client') {
      const client = await Client.findOne({ userId: user._id }).select('_id').lean();
      return client ? { clientId: client._id } : { _id: { $in: [] } };
    }
    if (user.role === 'lawyer') return { lawyerId: user._id };
  }
  if (['invoices', 'payments', 'receipts'].includes(resource) && user.role === 'client') {
    const client = await Client.findOne({ userId: user._id }).select('_id').lean();
    return client ? { clientId: client._id } : { _id: { $in: [] } };
  }
  if (resource === 'messages') {
    if (user.role === 'lawyer') return { lawyerId: user._id };
    if (user.role === 'client') {
      const client = await Client.findOne({ userId: user._id }).select('_id').lean();
      return client ? { clientId: client._id } : { _id: { $in: [] } };
    }
  }
  if (resource === 'notifications' && user.role !== 'admin') return { userId: user._id };
  if (resource === 'tasks' && user.role === 'lawyer') return { assigneeId: user._id };
  if (['attendance', 'leave', 'payroll'].includes(resource) && user.role === 'employee') return { employeeId: user._id };
  return {};
}

function cleanInput(input) {
  const { _id, id, __v, createdAt, updatedAt, ...safe } = input || {};
  return safe;
}

function restrictCreate(resource, body, user) {
  const data = cleanInput(body);
  if (resource === 'appointments') {
    delete data.consultationApproved;
    delete data.caseId;
    if (user.role === 'client') {
      data.clientId = undefined;
      data.lawyerId = undefined;
      data.lawyer = undefined;
      data.caseId = undefined;
      data.client = user.name;
      data.status = 'Requested';
      data.consultationApproved = false;
    }
    if (user.role === 'lawyer') {
      data.lawyerId = user._id;
      data.lawyer = user.name;
      data.status = 'Scheduled';
    }
  }
  if (resource === 'documents') {
    delete data.path;
    delete data.mimeType;
    delete data.size;
    delete data.reviewStatus;
    delete data.reviewNote;
    data.ownerId = user._id;
    if (user.role === 'lawyer') data.lawyerId = user._id;
  }
  if (resource === 'leave') {
    data.employeeId = user._id;
    data.name = user.name;
    data.status = 'Pending';
    delete data.reviewedBy;
    delete data.reviewedAt;
    delete data.reviewNote;
  }
  return data;
}

function restrictUpdate(resource, body, user) {
  const data = cleanInput(body);
  if (resource === 'users' || resource === 'lawyers') {
    const fields = ['name', 'email', 'role', 'phone', 'address', 'company', 'title', 'designation', 'department', 'joiningDate', 'specialty', 'team', 'active', 'status', 'password'];
    return Object.fromEntries(Object.entries(data).filter(([key]) => fields.includes(key)));
  }
  if (resource === 'employees') {
    const fields = ['name', 'email', 'phone', 'department', 'designation', 'joiningDate', 'active', 'status', 'password'];
    return Object.fromEntries(Object.entries(data).filter(([key]) => fields.includes(key)));
  }
  if (resource === 'clients') {
    const fields = ['name', 'email', 'phone', 'address', 'company', 'status'];
    return Object.fromEntries(Object.entries(data).filter(([key]) => fields.includes(key)));
  }
  if (resource === 'cases') {
    return Object.fromEntries(Object.entries(data).filter(([key]) =>
      ['title', 'type', 'description', 'priority', 'fee'].includes(key)
    ));
  }
  if (resource === 'documents') {
    const allowed = user.role === 'lawyer'
      ? ['reviewStatus', 'reviewNote']
      : ['name', 'category', 'reviewStatus', 'reviewNote'];
    return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  }
  if (resource === 'appointments') {
    const allowed = user.role === 'admin' || user.role === 'reception'
      ? ['status', 'consultationNotes', 'clientId', 'lawyerId', 'date', 'time']
      : ['status', 'consultationNotes'];
    return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  }
  if (resource === 'payroll') {
    const fields = user.role === 'accountant' ? ['status', 'payDate']
      : ['employeeId', 'basicSalary', 'allowances', 'deductions', 'salaryMonth', 'status', 'payDate'];
    return Object.fromEntries(Object.entries(data).filter(([key]) => fields.includes(key)));
  }
  return data;
}

export async function listResource(req, res, next) {
  try {
    const resource = req.params.resource;
    const UserModelResource = ['users', 'lawyers', 'employees'].includes(resource);
    const Model = UserModelResource ? User : map[resource];
    if (!Model) return res.status(404).json({ message: 'Unknown resource' });
    if (!permitted(resource, 'get', req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to view this resource' });
    }
    let query = await visibleQuery(resource, req.user);
    if (!query) return res.status(403).json({ message: 'You do not have permission to view this resource' });

    if (req.query.status && !['all', 'All'].includes(req.query.status)) {
      if (UserModelResource) query.active = String(req.query.status).toLowerCase() === 'active';
      else query.status = String(req.query.status);
    }
    if (req.query.caseId && mongoose.isValidObjectId(req.query.caseId)) query.caseId = req.query.caseId;
    if (resource === 'payroll' && /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.salaryMonth || ''))) {
      query.salaryMonth = req.query.salaryMonth;
    }
    if (req.query.search) {
      const term = String(req.query.search).trim().slice(0, 100);
      if (term) {
        const fields = resource === 'clients' ? ['name', 'email', 'company']
          : resource === 'cases' ? ['title', 'type', 'description']
            : resource === 'appointments' ? ['title', 'client', 'lawyer']
              : resource === 'documents' ? ['name', 'category']
                : resource === 'invoices' ? ['number', 'status']
                  : ['users', 'lawyers', 'employees'].includes(resource) ? ['name', 'email', 'title', 'specialty', 'department', 'designation'] : ['name', 'title'];
        query.$or = fields.map((field) => ({ [field]: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
      }
    }

    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 100));
    let rowsQuery = Model.find(query);
    if (resource === 'cases') rowsQuery = rowsQuery
      .populate('clientId', 'name email')
      .populate('lawyerId', 'name email title')
      .populate({ path: 'appointmentId', select: 'lawyerId', populate: { path: 'lawyerId', select: 'name email title' } });
    if (resource === 'invoices') rowsQuery = rowsQuery.populate('clientId', 'name email').populate('caseId', 'title');
    if (resource === 'payments') rowsQuery = rowsQuery.populate('invoiceId', 'number').populate('clientId', 'name email').populate('caseId', 'title');
    if (resource === 'receipts') rowsQuery = rowsQuery.populate('clientId', 'name email').populate('caseId', 'title')
      .populate({ path: 'invoiceId', select: 'number caseId', populate: { path: 'caseId', select: 'title' } })
      .populate('paymentId', 'method reference transactionReference paidAt');
    const [total, rows] = await Promise.all([
      Model.countDocuments(query),
      rowsQuery.sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()
    ]);
    res.json({
      data: rows.map((row) => normalize(resource, row)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
}

export async function createResource(req, res, next) {
  try {
    const resource = req.params.resource;
    if (resource === 'employees') {
      if (!permitted(resource, 'post', req.user.role)) return res.status(403).json({ message: 'You do not have permission to create employees' });
      const { name, email, password, ...profile } = req.body;
      if (!String(name || '').trim() || !String(email || '').trim() || !password) {
        return res.status(400).json({ message: 'Name, email and temporary password are required' });
      }
      const normalizedEmail = String(email).trim().toLowerCase();
      if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'Email already exists' });
      const employee = await User.create({
        name: String(name).trim(),
        email: normalizedEmail,
        role: 'employee',
        phone: profile.phone,
        department: profile.department,
        designation: profile.designation,
        joiningDate: profile.joiningDate || undefined,
        passwordHash: await bcrypt.hash(password, 12)
      });
      return res.status(201).json({ data: normalize(resource, employee) });
    }
    if (resource === 'users') {
      if (!permitted(resource, 'post', req.user.role)) return res.status(403).json({ message: 'You do not have permission to create users' });
      const { name, email, password, role, ...rest } = req.body;
      if (!name || !email || !password || !role) return res.status(400).json({ message: 'Name, email, password and role are required' });
      if (await User.exists({ email: String(email).toLowerCase() })) return res.status(409).json({ message: 'Email already exists' });
      const user = await User.create({
        ...cleanInput(rest), name, email: String(email).toLowerCase(), role,
        passwordHash: await bcrypt.hash(password, 12)
      });
      if (role === 'client') {
        const client = await Client.findOne({ email: user.email });
        if (client) {
          client.userId = user._id;
          client.name = name;
          client.phone = rest.phone || client.phone;
          client.address = rest.address || client.address;
          client.company = rest.company || client.company;
          client.status = 'Active';
          await client.save();
        } else {
          await Client.create({ userId: user._id, name, email: user.email, phone: rest.phone, address: rest.address, company: rest.company });
        }
      }
      return res.status(201).json({ data: normalize(resource, user) });
    }

    const Model = map[resource];
    if (!Model) return res.status(404).json({ message: 'Unknown resource' });
    if (!permitted(resource, 'post', req.user.role)) return res.status(403).json({ message: 'You do not have permission to create this resource' });
    const data = restrictCreate(resource, req.body, req.user);
    if (resource === 'leave') {
      const requestedFrom = new Date(data.from);
      const requestedTo = new Date(data.to);
      if (Number.isNaN(requestedFrom.getTime()) || Number.isNaN(requestedTo.getTime()) || requestedFrom > requestedTo) {
        return res.status(400).json({ message: 'Leave dates are invalid' });
      }
      const from = new Date(Date.UTC(requestedFrom.getUTCFullYear(), requestedFrom.getUTCMonth(), requestedFrom.getUTCDate()));
      const to = new Date(Date.UTC(requestedTo.getUTCFullYear(), requestedTo.getUTCMonth(), requestedTo.getUTCDate()));
      if ((to - from) / 86400000 > 365) return res.status(400).json({ message: 'A leave request cannot exceed 366 days' });
      const duplicate = await Leave.exists({
        employeeId: req.user._id,
        status: { $in: ['Pending', 'Approved'] },
        from: { $lte: to },
        to: { $gte: from }
      });
      if (duplicate) return res.status(409).json({ message: 'A pending or approved leave request already overlaps these dates' });
      data.from = from;
      data.to = to;
      data.requestKey = `${req.user._id}:${from.toISOString().slice(0, 10)}:${to.toISOString().slice(0, 10)}`;
    }
    if (resource === 'payroll') {
      const { employeeId } = data;
      if (!mongoose.isValidObjectId(employeeId)) return res.status(400).json({ message: 'A valid employee is required' });
      const employee = await User.findOne({ _id: employeeId, role: 'employee', active: { $ne: false } })
        .select('name department designation').lean();
      if (!employee) return res.status(400).json({ message: 'An active employee is required' });
      const basicSalary = Number(data.basicSalary);
      const allowances = Number(data.allowances || 0);
      const deductions = Number(data.deductions || 0);
      if (![basicSalary, allowances, deductions].every(Number.isFinite) || basicSalary < 0 || allowances < 0 || deductions < 0 || deductions > basicSalary + allowances) {
        return res.status(400).json({ message: 'Salary, allowances and deductions must be valid non-negative amounts' });
      }
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(data.salaryMonth || ''))) {
        return res.status(400).json({ message: 'Salary month must use YYYY-MM format' });
      }
      if (await Payroll.exists({ employeeId, salaryMonth: data.salaryMonth })) {
        return res.status(409).json({ message: 'Payroll already exists for this employee and month' });
      }
      Object.assign(data, {
        employeeId, name: employee.name, department: employee.department, designation: employee.designation,
        basicSalary, allowances, deductions, netSalary: basicSalary + allowances - deductions, status: 'Pending'
      });
      delete data.salary;
      delete data.bonus;
    }
    if (resource === 'invoices') {
      if (!mongoose.isValidObjectId(data.clientId) || !mongoose.isValidObjectId(data.caseId)) {
        return res.status(400).json({ message: 'A client and completed case are required' });
      }
      const caseRecord = await Case.findOne({
        _id: data.caseId, clientId: data.clientId, status: 'Completed', progress: 100
      }).select('_id clientId lawyerId invoiceId').lean();
      if (!caseRecord) return res.status(400).json({ message: 'Invoices can only be created for completed cases belonging to the selected client' });
      const number = String(data.number || '').trim();
      if (!number || number.length > 80) return res.status(400).json({ message: 'A valid invoice number is required' });
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Invoice amount must be greater than zero' });
      if (!String(data.description || '').trim()) return res.status(400).json({ message: 'Invoice description is required' });
      const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
      const dueAt = data.dueAt ? new Date(data.dueAt) : null;
      if (Number.isNaN(invoiceDate.getTime()) || !dueAt || Number.isNaN(dueAt.getTime())) {
        return res.status(400).json({ message: 'A valid invoice date and due date are required' });
      }
      Object.assign(data, {
        number, amount, invoiceDate, dueAt, status: 'Pending',
        lawyerId: caseRecord.lawyerId, autoGenerated: false
      });
    }
    if (resource === 'appointments' && req.user.role === 'reception' && !['Requested', 'Scheduled'].includes(data.status || 'Requested')) {
      return res.status(400).json({ message: 'Reception can only create requested or scheduled appointments' });
    }
    if (resource === 'appointments' && req.user.role === 'client') {
      const client = await Client.findOne({ userId: req.user._id }).select('_id').lean();
      if (!client) return res.status(409).json({ message: 'Your client profile is not configured' });
      data.clientId = client._id;
    }
    if (resource === 'documents' && req.user.role === 'client') {
      const client = await Client.findOne({ userId: req.user._id }).select('_id').lean();
      if (!client) return res.status(409).json({ message: 'Your client profile is not configured' });
      data.clientId = client._id;
    }
    if (resource === 'documents' && ['client', 'lawyer'].includes(req.user.role)) {
      if (!mongoose.isValidObjectId(data.caseId)) return res.status(400).json({ message: 'A valid case is required' });
      const caseScope = await caseQueryForUser(req.user);
      const caseRecord = await Case.findOne({ _id: data.caseId, ...(caseScope || {}) }).select('clientId lawyerId').lean();
      if (!caseRecord) return res.status(404).json({ message: 'Case not found' });
      data.clientId = caseRecord.clientId;
      data.lawyerId = caseRecord.lawyerId;
      if (req.user.role === 'lawyer') data.requestedBy = req.user._id;
    }
    if (resource === 'messages') {
      if (!mongoose.isValidObjectId(data.caseId)) return res.status(400).json({ message: 'A valid case is required' });
      const scope = await caseQueryForUser(req.user);
      const caseRecord = await Case.findOne({ _id: data.caseId, ...(scope || {}) })
        .select('clientId lawyerId').lean();
      if (!caseRecord) return res.status(404).json({ message: 'Case not found' });
      const body = String(data.body || '').trim();
      if (!body || body.length > 5000) return res.status(400).json({ message: 'Message must be between 1 and 5000 characters' });
      Object.assign(data, {
        body,
        clientId: caseRecord.clientId,
        lawyerId: caseRecord.lawyerId,
        senderId: req.user._id
      });
    }
    if (resource === 'appointments' && req.user.role === 'lawyer') {
      if (!mongoose.isValidObjectId(data.clientId) || !await Client.exists({ _id: data.clientId })) return res.status(400).json({ message: 'A valid appointment client is required' });
      if (!await Case.exists({ clientId: data.clientId, lawyerId: req.user._id })) {
        return res.status(403).json({ message: 'You can only schedule appointments with clients assigned to you' });
      }
    }
    if (resource === 'appointments' && ['admin', 'reception', 'lawyer'].includes(req.user.role)) {
      if (data.clientId && !await Client.exists({ _id: data.clientId })) return res.status(400).json({ message: 'Appointment client was not found' });
      if (data.lawyerId && !await User.exists({ _id: data.lawyerId, role: 'lawyer' })) return res.status(400).json({ message: 'Assigned lawyer was not found' });
      if (data.clientId) data.client = (await Client.findById(data.clientId).select('name').lean())?.name;
      if (data.lawyerId) data.lawyer = (await User.findById(data.lawyerId).select('name').lean())?.name;
    }
    let item;
    if (resource === 'invoices') {
      const existingInvoice = await Invoice.findOne({ caseId: data.caseId });
      if (existingInvoice) {
        if (!existingInvoice.autoGenerated || ['Paid', 'Cancelled'].includes(existingInvoice.status)) {
          return res.status(409).json({ message: 'An invoice already exists for this case' });
        }
        Object.assign(existingInvoice, data, { autoGenerated: false });
        item = await existingInvoice.save();
        await Case.updateOne({ _id: data.caseId }, { $set: { invoiceId: item._id } });
        return res.status(201).json({ data: normalize(resource, item) });
      }
      item = new Model(data);
      const linkedCase = await Case.findOneAndUpdate(
        { _id: data.caseId, clientId: data.clientId, status: 'Completed', progress: 100, invoiceId: null },
        { $set: { invoiceId: item._id } },
        { new: true }
      ).select('_id').lean();
      if (!linkedCase) return res.status(409).json({ message: 'This completed case already has an invoice or is no longer available' });
      try {
        await item.save();
      } catch (error) {
        await Case.updateOne({ _id: linkedCase._id, invoiceId: item._id }, { $unset: { invoiceId: 1 } });
        throw error;
      }
    } else {
      try {
        item = await Model.create(data);
      } catch (error) {
        if (error.code === 11000 && resource === 'payroll') {
          return res.status(409).json({ message: 'Payroll already exists for this employee and month' });
        }
        if (error.code === 11000 && resource === 'leave') {
          return res.status(409).json({ message: 'This leave request has already been submitted' });
        }
        throw error;
      }
    }
    return res.status(201).json({ data: normalize(resource, item) });
  } catch (error) {
    next(error);
  }
}

export async function getResource(req, res, next) {
  try {
    const resource = req.params.resource;
    const Model = ['users', 'lawyers', 'employees'].includes(resource) ? User : map[resource];
    if (!Model) return res.status(404).json({ message: 'Unknown resource' });
    if (!permitted(resource, 'get', req.user.role)) return res.status(403).json({ message: 'You do not have permission to view this resource' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid record id' });
    const scope = await visibleQuery(resource, req.user);
    const finder = Model.findOne({ _id: req.params.id, ...(scope || {}) });
    if (resource === 'invoices') finder.populate('clientId', 'name email').populate('caseId', 'title');
    if (resource === 'cases') finder
      .populate('clientId', 'name email')
      .populate('lawyerId', 'name email title')
      .populate({ path: 'appointmentId', select: 'lawyerId', populate: { path: 'lawyerId', select: 'name email title' } });
    if (resource === 'payments') finder.populate('invoiceId', 'number').populate('clientId', 'name email').populate('caseId', 'title');
    if (resource === 'receipts') finder.populate('clientId', 'name email').populate('caseId', 'title')
      .populate({ path: 'invoiceId', select: 'number caseId', populate: { path: 'caseId', select: 'title' } })
      .populate('paymentId', 'method reference transactionReference paidAt');
    const item = await finder.lean();
    if (!item) return res.status(404).json({ message: 'Record not found' });
    return res.json({ data: normalize(resource, item) });
  } catch (error) {
    next(error);
  }
}

export async function updateResource(req, res, next) {
  try {
    const resource = req.params.resource;
    const Model = ['users', 'lawyers', 'employees'].includes(resource) ? User : map[resource];
    if (!Model) return res.status(404).json({ message: 'Unknown resource' });
    if (!permitted(resource, 'put', req.user.role)) return res.status(403).json({ message: 'You do not have permission to update this resource' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid record id' });
    const scope = await visibleQuery(resource, req.user);
    const update = restrictUpdate(resource, req.body, req.user);
    if (!Object.keys(update).length) return res.status(400).json({ message: 'No permitted fields were provided' });
    if (resource === 'employees') {
      const employee = await User.findOne({ _id: req.params.id, role: 'employee', ...(scope || {}) });
      if (!employee) return res.status(404).json({ message: 'Record not found' });
      if (update.email) update.email = String(update.email).trim().toLowerCase();
      if (update.email && update.email !== employee.email && await User.exists({ email: update.email, _id: { $ne: employee._id } })) {
        return res.status(409).json({ message: 'Email already exists' });
      }
      if (update.status !== undefined) {
        if (!['Active', 'Inactive'].includes(update.status)) return res.status(400).json({ message: 'Status must be Active or Inactive' });
        update.active = update.status === 'Active';
      }
      if (update.password !== undefined) {
        if (String(update.password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
        update.passwordHash = await bcrypt.hash(update.password, 12);
        delete update.password;
      }
      const updatedEmployee = await User.findByIdAndUpdate(employee._id, { $set: update }, { new: true, runValidators: true });
      return res.json({ data: normalize(resource, updatedEmployee) });
    }
    if (['users', 'lawyers'].includes(resource)) {
      if (resource === 'lawyers' && update.role && update.role !== 'lawyer') {
        return res.status(400).json({ message: 'A lawyer account must keep the lawyer role' });
      }
      if (update.role && !User.schema.path('role').enumValues.includes(update.role)) {
        return res.status(400).json({ message: 'Invalid user role' });
      }
      if (update.status !== undefined) {
        if (!['Active', 'Inactive'].includes(update.status)) return res.status(400).json({ message: 'Status must be Active or Inactive' });
        update.active = update.status === 'Active';
      } else if (update.active !== undefined) {
        update.status = update.active ? 'Active' : 'Inactive';
      }
      if (update.password !== undefined) {
        if (String(update.password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
        update.passwordHash = await bcrypt.hash(String(update.password), 12);
        delete update.password;
      }
      if (update.email) update.email = String(update.email).trim().toLowerCase();
      if (update.email && await User.exists({ email: update.email, _id: { $ne: req.params.id } })) {
        return res.status(409).json({ message: 'Email already exists' });
      }
      if (String(req.user._id) === String(req.params.id) && update.active === false) {
        return res.status(409).json({ message: 'You cannot deactivate your own account' });
      }
      const currentUser = await User.findById(req.params.id).select('role');
      if (!currentUser || (resource === 'lawyers' && currentUser.role !== 'lawyer')) {
        return res.status(404).json({ message: 'Record not found' });
      }
      const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
      if (currentUser.role === 'client' && user.role !== 'client') {
        await Client.findOneAndUpdate({ userId: user._id }, { $set: { status: 'Inactive' } });
      }
      if (user.role === 'client') {
        const clientUpdate = {};
        for (const field of ['name', 'email', 'phone', 'address', 'company']) {
          if (update[field] !== undefined) clientUpdate[field] = update[field];
        }
        if (update.active !== undefined) clientUpdate.status = update.active ? 'Active' : 'Inactive';
        else if (currentUser.role !== 'client') clientUpdate.status = 'Active';
        if (Object.keys(clientUpdate).length || currentUser.role !== 'client') {
          await Client.findOneAndUpdate(
            { userId: user._id },
            { $set: clientUpdate, $setOnInsert: { name: user.name, email: user.email, phone: user.phone, address: user.address, company: user.company, userId: user._id } },
            { upsert: true, runValidators: true }
          );
        }
      }
      return res.json({ data: normalize(resource, user) });
    }
    if (resource === 'clients') {
      if (update.status !== undefined && !['Active', 'Inactive'].includes(update.status)) {
        return res.status(400).json({ message: 'Status must be Active or Inactive' });
      }
      if (update.email) update.email = String(update.email).trim().toLowerCase();
      const currentClient = await Client.findOne({ _id: req.params.id, ...(scope || {}) });
      if (!currentClient) return res.status(404).json({ message: 'Record not found' });
      if (update.email && update.email !== currentClient.email && await Client.exists({ email: update.email, _id: { $ne: currentClient._id } })) {
        return res.status(409).json({ message: 'Client email already exists' });
      }
      const client = await Client.findByIdAndUpdate(currentClient._id, { $set: update }, { new: true, runValidators: true });
      const userUpdate = {};
      for (const field of ['name', 'email', 'phone', 'address', 'company']) {
        if (update[field] !== undefined) userUpdate[field] = update[field];
      }
      if (update.status !== undefined) {
        userUpdate.active = update.status === 'Active';
        userUpdate.status = update.status;
      }
      if (currentClient.userId && Object.keys(userUpdate).length) {
        await User.findByIdAndUpdate(currentClient.userId, { $set: userUpdate }, { runValidators: true });
      }
      return res.json({ data: normalize(resource, client) });
    }
    if (resource === 'payroll') {
      const current = await Payroll.findOne({ _id: req.params.id, ...(scope || {}) });
      if (!current) return res.status(404).json({ message: 'Record not found' });
      const employeeId = update.employeeId || current.employeeId;
      if (!mongoose.isValidObjectId(employeeId)) return res.status(400).json({ message: 'A valid employee is required' });
      const employee = await User.findOne({ _id: employeeId, role: 'employee' }).select('name department designation').lean();
      if (!employee) return res.status(400).json({ message: 'Employee was not found' });
      const basicSalary = Number(update.basicSalary ?? current.basicSalary);
      const allowances = Number(update.allowances ?? current.allowances ?? 0);
      const deductions = Number(update.deductions ?? current.deductions ?? 0);
      const salaryMonth = update.salaryMonth || current.salaryMonth;
      if (![basicSalary, allowances, deductions].every(Number.isFinite) || basicSalary < 0 || allowances < 0 || deductions < 0 || deductions > basicSalary + allowances) {
        return res.status(400).json({ message: 'Salary, allowances and deductions must be valid non-negative amounts' });
      }
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(salaryMonth || ''))) return res.status(400).json({ message: 'Salary month must use YYYY-MM format' });
      if (await Payroll.exists({ _id: { $ne: current._id }, employeeId, salaryMonth })) {
        return res.status(409).json({ message: 'Payroll already exists for this employee and month' });
      }
      Object.assign(update, {
        employeeId,
        name: employee.name,
        department: employee.department,
        designation: employee.designation,
        basicSalary,
        allowances,
        deductions,
        netSalary: basicSalary + allowances - deductions,
        salaryMonth
      });
      if (update.status === 'Paid' && !update.payDate && !current.payDate) update.payDate = new Date();
      let payroll;
      try {
        payroll = await Payroll.findByIdAndUpdate(current._id, { $set: update }, { new: true, runValidators: true });
      } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Payroll already exists for this employee and month' });
        throw error;
      }
      return res.json({ data: normalize(resource, payroll) });
    }
    if (resource === 'cases') {
      if ('progress' in update || 'status' in update || 'consultationApproved' in update || 'appointmentId' in update) {
        return res.status(400).json({ message: 'Use the case workflow endpoints to change case progress or approval' });
      }
      if ('clientId' in req.body || 'lawyerId' in req.body || 'invoiceId' in req.body) {
        return res.status(400).json({ message: 'Case relationships are managed by the consultation workflow' });
      }
    }
    if (resource === 'appointments' && ['admin', 'reception'].includes(req.user.role)) {
      if (update.clientId && !await Client.exists({ _id: update.clientId })) return res.status(400).json({ message: 'Appointment client was not found' });
      if (update.lawyerId && !await User.exists({ _id: update.lawyerId, role: 'lawyer' })) return res.status(400).json({ message: 'Assigned lawyer was not found' });
      if (update.clientId) update.client = (await Client.findById(update.clientId).select('name').lean())?.name;
      if (update.lawyerId) update.lawyer = (await User.findById(update.lawyerId).select('name').lean())?.name;
    }
    if (resource === 'appointments' && update.status) {
      if (!['Requested', 'Scheduled', 'Completed', 'Cancelled'].includes(update.status)) {
        return res.status(400).json({ message: 'Invalid appointment status' });
      }
      if (req.user.role === 'reception' && update.status === 'Completed') {
        return res.status(403).json({ message: 'Only the assigned lawyer can complete a consultation' });
      }
    }
    if (resource === 'appointments' && ('clientId' in update || 'lawyerId' in update)) {
      const appointment = await Model.findOne({ _id: req.params.id, ...(scope || {}) }).select('consultationApproved').lean();
      if (!appointment) return res.status(404).json({ message: 'Record not found' });
      if (appointment.consultationApproved) return res.status(409).json({ message: 'Approved appointments cannot be reassigned' });
    }
    const item = await Model.findOneAndUpdate(
      { _id: req.params.id, ...(scope || {}) },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!item) return res.status(404).json({ message: 'Record not found' });
    return res.json({ data: normalize(resource, item) });
  } catch (error) {
    next(error);
  }
}

export async function deleteResource(req, res, next) {
  try {
    const resource = req.params.resource;
    const Model = ['users', 'lawyers', 'employees'].includes(resource) ? User : map[resource];
    if (!Model) return res.status(404).json({ message: 'Unknown resource' });
    if (!permitted(resource, 'delete', req.user.role)) return res.status(403).json({ message: 'You do not have permission to delete this resource' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid record id' });
    const scope = await visibleQuery(resource, req.user);
    if (resource === 'users' || resource === 'lawyers' || resource === 'employees') {
      if (String(req.user._id) === String(req.params.id)) {
        return res.status(409).json({ message: 'You cannot deactivate your own account' });
      }
      const query = { _id: req.params.id, ...(scope || {}) };
      if (resource === 'lawyers') query.role = 'lawyer';
      if (resource === 'employees') query.role = 'employee';
      const user = await User.findOneAndUpdate(query, { $set: { active: false, status: 'Inactive' } }, { new: true });
      if (!user) return res.status(404).json({ message: 'Record not found' });
      if (user.role === 'client') {
        await Client.findOneAndUpdate({ userId: user._id }, { $set: { status: 'Inactive' } });
      }
      return res.json({ message: 'User deactivated', data: normalize(resource, user) });
    }
    if (resource === 'clients') {
      const client = await Client.findOneAndUpdate(
        { _id: req.params.id, ...(scope || {}) },
        { $set: { status: 'Inactive' } },
        { new: true }
      );
      if (!client) return res.status(404).json({ message: 'Record not found' });
      if (client.userId) await User.findByIdAndUpdate(client.userId, { $set: { active: false, status: 'Inactive' } });
      return res.json({ message: 'Client deactivated', data: normalize(resource, client) });
    }
    const item = await Model.findOneAndDelete({ _id: req.params.id, ...(scope || {}) });
    if (!item) return res.status(404).json({ message: 'Record not found' });
    return res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
}
