import {
  User, Client, Case, Appointment, Document, Invoice,
  Payroll, Attendance, Leave, Task, Expense
} from '../models/index.js';
import { financeMetrics } from '../utils/financeMetrics.js';

const colors = ['#2563EB', '#22C55E', '#F59E0B', '#EF6A6A', '#8B5CF6'];
const stat = (label, value, icon = 'grid') => [label, String(value), '', 'up', icon];

async function caseCounts(query) {
  const [total, grouped] = await Promise.all([
    Case.countDocuments(query),
    Case.aggregate([{ $match: query }, { $group: { _id: '$status', count: { $sum: 1 } } }])
  ]);
  return { total, grouped };
}

export async function dashboard(req, res, next) {
  try {
    const { role } = req.user;
    if (req.params.role !== role) {
      return res.status(403).json({ message: 'You do not have permission to view this dashboard' });
    }
    const emptyCharts = {
      revenueTrend: [], lawyerPerformance: [], caseTrends: [], recruitment: [], attendanceTrend: []
    };
    let stats = [];
    let activeCases = 0;
    let revenue = 0;
    let caseStatus = [];
    let pendingPayments = 0;
    let totalRevenue = 0;
    let monthlyRevenue = 0;
    let totalInvoices = 0;
    let overduePayments = 0;
    let overdueInvoiceCount = 0;
    let revenueTrend = [];

    if (role === 'admin') {
      const [clients, lawyers, employees, activeCasesCount, pendingConsultations, pendingDocuments, finance] = await Promise.all([
        Client.countDocuments(),
        User.countDocuments({ role: 'lawyer' }),
        User.countDocuments({ role: 'employee' }),
        Case.countDocuments({ status: { $nin: ['Completed', 'Closed', 'Inactive'] } }),
        Appointment.countDocuments({ status: { $in: ['Requested', 'Scheduled'] }, consultationApproved: { $ne: true } }),
        Document.countDocuments({ $or: [{ status: 'Requested' }, { reviewStatus: { $in: ['Pending', 'Re-upload requested'] } }] }),
        financeMetrics()
      ]);
      activeCases = activeCasesCount;
      totalRevenue = finance.totalRevenue;
      monthlyRevenue = finance.monthlyRevenue;
      pendingPayments = finance.pendingPayments;
      totalInvoices = finance.totalInvoices;
      overduePayments = finance.overduePayments;
      overdueInvoiceCount = finance.overdueInvoiceCount;
      revenueTrend = finance.revenueTrend;
      stats = [
        stat('Total clients', clients, 'users'),
        stat('Total lawyers', lawyers, 'scale'),
        stat('Total employees', employees, 'userPlus'),
        stat('Active cases', activeCasesCount, 'folder'),
        stat('Pending consultations', pendingConsultations, 'calendar'),
        stat('Pending documents', pendingDocuments, 'file'),
        stat('Pending invoices', finance.pendingInvoiceCount, 'wallet'),
        stat('Total revenue', totalRevenue ? `₹${totalRevenue.toLocaleString('en-IN')}` : '₹0 Revenue', 'wallet'),
        stat('Monthly revenue', `₹${monthlyRevenue.toLocaleString('en-IN')}`, 'chart'),
        stat('Pending payments', `₹${pendingPayments.toLocaleString('en-IN')}`, 'wallet')
      ];
    } else if (role === 'client') {
      const client = await Client.findOne({ userId: req.user._id }).select('_id').lean();
      const clientId = client?._id;
      const [cases, appointments, documents, invoices] = clientId
        ? await Promise.all([
          Case.countDocuments({ clientId }),
          Appointment.countDocuments({ clientId }),
          Document.countDocuments({ clientId }),
          Invoice.countDocuments({ clientId })
        ])
        : [0, 0, 0, 0];
      activeCases = cases;
      stats = [
        stat('My cases', cases, 'folder'),
        stat('Appointments', appointments, 'calendar'),
        stat('Documents', documents, 'file'),
        stat('Invoices', invoices, 'wallet')
      ];
    } else if (role === 'lawyer') {
      const scope = { lawyerId: req.user._id };
      const [cases, appointments, documents, tasks] = await Promise.all([
        caseCounts(scope),
        Appointment.countDocuments(scope),
        Document.countDocuments(scope),
        Task.countDocuments({ assigneeId: req.user._id })
      ]);
      activeCases = cases.total;
      caseStatus = cases.grouped.map((item, index) => ({
        name: item._id || 'Unknown', value: cases.total ? Math.round(item.count / cases.total * 100) : 0,
        color: colors[index % colors.length]
      }));
      stats = [
        stat('Assigned cases', cases.total, 'folder'),
        stat('Appointments', appointments, 'calendar'),
        stat('Tasks', tasks, 'check'),
        stat('Documents', documents, 'file')
      ];
    } else if (role === 'accountant') {
      const [finance, payroll, expenses] = await Promise.all([
        financeMetrics(),
        Payroll.countDocuments(),
        Expense.countDocuments()
      ]);
      totalRevenue = finance.totalRevenue;
      monthlyRevenue = finance.monthlyRevenue;
      pendingPayments = finance.pendingPayments;
      totalInvoices = finance.totalInvoices;
      overduePayments = finance.overduePayments;
      overdueInvoiceCount = finance.overdueInvoiceCount;
      revenueTrend = finance.revenueTrend;
      revenue = totalRevenue;
      stats = [
        stat('Total revenue', totalRevenue ? `₹${totalRevenue.toLocaleString('en-IN')}` : '₹0 Revenue', 'wallet'),
        stat('Monthly revenue', `₹${monthlyRevenue.toLocaleString('en-IN')}`, 'chart'),
        stat('Pending payments', `₹${pendingPayments.toLocaleString('en-IN')}`, 'wallet'),
        stat('Invoices', totalInvoices, 'file'),
        stat('Payroll', payroll, 'card'),
        stat('Expenses', expenses, 'receipt'),
        stat('Overdue payments', `₹${overduePayments.toLocaleString('en-IN')}`, 'clock')
      ];
    } else if (role === 'reception') {
      const [clients, appointments] = await Promise.all([
        Client.countDocuments(),
        Appointment.countDocuments({ status: { $in: ['Requested', 'Scheduled'] } })
      ]);
      stats = [stat('Clients', clients, 'users'), stat('Appointments to schedule', appointments, 'calendar')];
    } else if (role === 'hr') {
      const today = new Date();
      const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const [employees, activeEmployeeIds, pendingLeaves] = await Promise.all([
        User.countDocuments({ role: 'employee' }),
        User.distinct('_id', { role: 'employee', active: { $ne: false } }),
        Leave.countDocuments({ status: 'Pending' }),
      ]);
      const attendanceToday = { employeeId: { $in: activeEmployeeIds }, date: { $gte: dayStart, $lt: dayEnd } };
      const [present, absent, attendance] = await Promise.all([
        Attendance.countDocuments({ ...attendanceToday, status: 'Present' }),
        Attendance.countDocuments({ ...attendanceToday, status: 'Absent' }),
        Attendance.countDocuments(attendanceToday)
      ]);
      stats = [stat('Total employees', employees, 'users'), stat('Present today', present, 'check'),
        stat('Absent today', absent, 'clock'), stat('Pending leave requests', pendingLeaves, 'calendar'),
        stat('Attendance marked today', attendance, 'file')];
    } else {
      const [attendance, tasks] = await Promise.all([
        Attendance.countDocuments({ employeeId: req.user._id }),
        Task.countDocuments({ assigneeId: req.user._id })
      ]);
      stats = [stat('Attendance', attendance, 'clock'), stat('Tasks', tasks, 'check')];
    }

    if (role === 'admin' || role === 'lawyer') {
      emptyCharts.caseStatus = caseStatus;
    }
    emptyCharts.revenueTrend = revenueTrend;
    const response = {
      role,
      greeting: 'Workspace overview',
      summary: 'Live data from your Legal ERP database.',
      attention: [],
      metrics: {
        activeCases, revenue, pendingPayments, monthlyRevenue, totalInvoices,
        overduePayments, overdueInvoiceCount
      },
      finance: { totalRevenue, monthlyRevenue, pendingPayments, totalInvoices, overduePayments },
      charts: emptyCharts,
      stats
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}
