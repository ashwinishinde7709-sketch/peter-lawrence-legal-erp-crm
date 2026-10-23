import { useEffect, useState } from 'react';
import { Button, EmptyState, FormField, Icon, LoadingButton, Modal, PageHeader, StatusBadge, TableCard } from '../components/UI';
import { useAuth, useToast } from '../context/AppContext';
import { placeholderService } from '../services/placeholderService';

const today = () => new Date().toISOString().slice(0, 10);
const recordId = (record) => record?._id || record?.id;
const displayDate = (value) => value ? new Date(value).toLocaleDateString() : '—';
const errorMessage = (error, fallback) => error.response?.data?.message || error.message || fallback;

function usePageData(resource, filters = {}) {
  const [data, setData] = useState({ rows: [], page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const status = filters.status || '';
  const month = filters.month || '';
  useEffect(() => {
    let active = true;
    setLoading(true);
    placeholderService.listPage(resource, { page, limit, status, salaryMonth: month })
      .then((result) => {
        if (!active) return;
        setData({ rows: result.data || [], page: result.pagination?.page || page, pages: result.pagination?.pages || 1, total: result.pagination?.total || 0 });
        setError('');
      })
      .catch((requestError) => { if (active) setError(errorMessage(requestError, `Unable to load ${resource}.`)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [resource, page, limit, status, month, reloadKey]);
  return { ...data, loading, error, reload: () => setReloadKey((value) => value + 1) };
}

function Pager({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return <div className="workflow-pagination">
    <Button variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
    <span>Page {page} of {pages}</span>
    <Button variant="ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
  </div>;
}

function EmployeeForm({ open, onClose, employee, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(employee ? {
      name: employee.name || '', email: employee.email || '', phone: employee.phone || '',
      department: employee.department || '', designation: employee.designation || '',
      joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().slice(0, 10) : '',
      status: employee.status || 'Active', password: ''
    } : { name: '', email: '', phone: '', department: '', designation: '', joiningDate: '', password: '' });
  }, [open, employee]);
  const change = (event) => setForm((value) => ({ ...value, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (await onSave(form)) onClose();
    } finally {
      setSaving(false);
    }
  };
  return <Modal open={open} onClose={onClose} title={employee ? 'Edit employee' : 'Add employee'} description="Maintain an employee profile linked to their secure login.">
    <form className="modal-form people-form" onSubmit={submit}>
      <FormField label="Full name" name="name" value={form.name || ''} onChange={change} required />
      <FormField label="Email" name="email" type="email" value={form.email || ''} onChange={change} required />
      <FormField label="Phone" name="phone" value={form.phone || ''} onChange={change} />
      <FormField label="Department" name="department" value={form.department || ''} onChange={change} />
      <FormField label="Designation" name="designation" value={form.designation || ''} onChange={change} />
      <FormField label="Joining date" name="joiningDate" type="date" value={form.joiningDate || ''} onChange={change} />
      {employee && <div className="form-field"><label htmlFor="employee-status">Account status</label><select id="employee-status" name="status" value={form.status || 'Active'} onChange={change}><option>Active</option><option>Inactive</option></select></div>}
      <FormField label={employee ? 'Reset password (optional)' : 'Temporary password'} name="password" type="password" value={form.password || ''} onChange={change} required={!employee} placeholder={employee ? 'Leave blank to keep current password' : 'At least 8 characters'} />
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><LoadingButton type="submit" loading={saving}>Save employee</LoadingButton></div>
    </form>
  </Modal>;
}

export function EmployeeManagementPage() {
  const { pushToast } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [formEmployee, setFormEmployee] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const employees = usePageData('employees', { page, limit: 20, status });
  const save = async (form) => {
    setSaving(true);
    try {
      if (formEmployee) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await placeholderService.update('employees', recordId(formEmployee), payload);
        pushToast('Employee profile updated.');
      } else {
        await placeholderService.createResource('employees', form);
        pushToast('Employee account created.');
      }
      employees.reload();
      return true;
    } catch (error) {
      pushToast(errorMessage(error, 'Unable to save employee.'), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const deactivate = async () => {
    if (!deactivateTarget) return;
    setSaving(true);
    try {
      await placeholderService.remove('employees', recordId(deactivateTarget));
      pushToast('Employee deactivated. Their records have been retained.');
      setDeactivateTarget(null);
      employees.reload();
    } catch (error) {
      pushToast(errorMessage(error, 'Unable to deactivate employee.'), 'error');
    } finally {
      setSaving(false);
    }
  };
  const reactivate = async (employee) => {
    try {
      await placeholderService.update('employees', recordId(employee), { status: 'Active' });
      pushToast('Employee reactivated.');
      employees.reload();
    } catch (error) {
      pushToast(errorMessage(error, 'Unable to reactivate employee.'), 'error');
    }
  };
  return <div className="workflow-page">
    <PageHeader eyebrow="People operations" title="Employees" description="Manage employee accounts and their department and role details." actions={<Button icon="plus" onClick={() => { setFormEmployee(null); setFormOpen(true); }}>Add employee</Button>} />
    <TableCard toolbar={<div className="people-toolbar"><strong>{employees.total} employees</strong><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>}>
      {employees.error && <p role="alert">{employees.error}</p>}
      {employees.loading ? <p role="status">Loading employees…</p> : employees.rows.length ? <table className="data-table"><thead><tr><th>Employee</th><th>Department</th><th>Designation</th><th>Joining date</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {employees.rows.map((employee) => <tr key={recordId(employee)}><td><strong>{employee.name}</strong><small className="people-subtext">{employee.email}{employee.phone ? ` · ${employee.phone}` : ''}</small></td><td>{employee.department || '—'}</td><td>{employee.designation || '—'}</td><td>{displayDate(employee.joiningDate)}</td><td><StatusBadge>{employee.status}</StatusBadge></td><td className="people-actions"><Button variant="ghost" onClick={() => { setFormEmployee(employee); setFormOpen(true); }}>Edit</Button>{employee.status === 'Inactive' ? <Button variant="ghost" onClick={() => reactivate(employee)}>Reactivate</Button> : <Button variant="ghost" onClick={() => setDeactivateTarget(employee)}>Deactivate</Button>}</td></tr>)}
      </tbody></table> : <EmptyState icon="users" title="No employees found" description="Add an employee to begin managing people operations." />}
    </TableCard>
    <Pager page={employees.page} pages={employees.pages} onChange={setPage} />
    <EmployeeForm open={formOpen} onClose={() => setFormOpen(false)} employee={formEmployee} onSave={save} />
    <Modal open={Boolean(deactivateTarget)} onClose={() => setDeactivateTarget(null)} title="Deactivate employee" description={`Deactivate ${deactivateTarget?.name || 'this employee'}? They will no longer be able to sign in, and their history will be retained.`}>
      <div className="modal-actions"><Button variant="ghost" onClick={() => setDeactivateTarget(null)}>Cancel</Button><LoadingButton loading={saving} onClick={deactivate}>Deactivate employee</LoadingButton></div>
    </Modal>
  </div>;
}

export function AttendanceManagementPage() {
  const { pushToast } = useToast();
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    placeholderService.attendanceDay(date).then((result) => {
      if (active) { setRows(result.data || []); setError(''); }
    }).catch((requestError) => { if (active) setError(errorMessage(requestError, 'Unable to load attendance.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, reload]);
  const setField = (id, field, value) => setRows((current) => current.map((row) => recordId(row) === id ? { ...row, [field]: value } : row));
  const save = async () => {
    setSaving(true);
    try {
      const entries = rows.filter((row) => row.status !== 'Unmarked').map((row) => ({
        employeeId: recordId(row), status: row.status, checkIn: row.checkIn, checkOut: row.checkOut
      }));
      await placeholderService.saveAttendanceDay(date, entries);
      pushToast('Attendance saved for the selected date.');
      setReload((value) => value + 1);
    } catch (requestError) {
      pushToast(errorMessage(requestError, 'Unable to save attendance.'), 'error');
    } finally { setSaving(false); }
  };
  const marked = rows.filter((row) => row.status !== 'Unmarked').length;
  return <div className="workflow-page">
    <PageHeader eyebrow="People operations" title="Attendance register" description="Review and save one attendance status per active employee and work date." actions={<Button icon="check" onClick={save} disabled={saving || loading}>{saving ? 'Saving…' : 'Save attendance'}</Button>} />
    <TableCard toolbar={<div className="people-toolbar"><label>Work date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><span>{marked} of {rows.length} employees marked</span></div>}>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Loading attendance register…</p> : rows.length ? <table className="data-table"><thead><tr><th>Employee</th><th>Department</th><th>Status</th><th>Check in</th><th>Check out</th></tr></thead><tbody>
        {rows.map((employee) => <tr key={recordId(employee)}><td><strong>{employee.name}</strong><small className="people-subtext">{employee.email}</small></td><td>{employee.department || '—'}</td><td><select aria-label={`Attendance status for ${employee.name}`} value={employee.status} onChange={(event) => setField(recordId(employee), 'status', event.target.value)}><option>Unmarked</option><option>Present</option><option>Absent</option><option>Leave</option></select></td><td><input type="time" value={employee.checkIn || ''} onChange={(event) => setField(recordId(employee), 'checkIn', event.target.value)} disabled={employee.status !== 'Present'} /></td><td><input type="time" value={employee.checkOut || ''} onChange={(event) => setField(recordId(employee), 'checkOut', event.target.value)} disabled={employee.status !== 'Present'} /></td></tr>)}
      </tbody></table> : <EmptyState icon="clock" title="No active employees" description="Active employee accounts will appear here." />}
    </TableCard>
  </div>;
}

export function MyAttendancePage() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    placeholderService.listPage('attendance', { page, limit: 20 }).then((result) => {
      if (active) { setRows(result.data || []); setPages(result.pagination?.pages || 1); setError(''); }
    }).catch((requestError) => { if (active) setError(errorMessage(requestError, 'Unable to load attendance history.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page]);
  return <div className="workflow-page">
    <PageHeader eyebrow="Employee hub" title="My attendance" description="Your saved attendance marks." />
    <TableCard>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Loading attendance history…</p> : rows.length ? <table className="data-table"><thead><tr><th>Date</th><th>Status</th><th>Check in</th><th>Check out</th></tr></thead><tbody>
        {rows.map((item) => <tr key={recordId(item)}><td>{displayDate(item.date)}</td><td><StatusBadge>{item.status}</StatusBadge></td><td>{item.checkIn || '—'}</td><td>{item.checkOut || '—'}</td></tr>)}
      </tbody></table> : <EmptyState icon="clock" title="No attendance history" description="Your attendance marks will appear here after HR saves them." />}
    </TableCard>
    <Pager page={page} pages={pages} onChange={setPage} />
  </div>;
}

function LeaveRequestForm({ open, onClose, onSave }) {
  const [form, setForm] = useState({ from: '', to: '', reason: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm({ from: '', to: '', reason: '' }); }, [open]);
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try { if (await onSave(form)) onClose(); } finally { setSaving(false); }
  };
  return <Modal open={open} onClose={onClose} title="Request leave" description="Submit your requested dates and a short reason for HR review.">
    <form className="modal-form" onSubmit={submit}>
      <FormField label="From" name="from" type="date" value={form.from} onChange={change} required />
      <FormField label="To" name="to" type="date" value={form.to} onChange={change} required />
      <FormField label="Reason" name="reason" value={form.reason} onChange={change} required />
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><LoadingButton type="submit" loading={saving}>Submit request</LoadingButton></div>
    </form>
  </Modal>;
}

export function LeaveManagementPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [rows, setRows] = useState([]);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const manager = ['admin', 'hr'].includes(user?.role);
  useEffect(() => {
    let active = true;
    setLoading(true);
    placeholderService.listPage('leave', { page, limit: 20 }).then((result) => {
      if (active) { setRows(result.data || []); setPages(result.pagination?.pages || 1); setError(''); }
    }).catch((requestError) => { if (active) setError(errorMessage(requestError, 'Unable to load leave requests.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, reloadKey]);
  const create = async (form) => {
    try {
      await placeholderService.createResource('leave', form);
      pushToast('Leave request submitted.');
      setReloadKey((value) => value + 1);
      return true;
    } catch (requestError) {
      pushToast(errorMessage(requestError, 'Unable to submit leave request.'), 'error');
      return false;
    }
  };
  const review = async (leave, status) => {
    const id = recordId(leave);
    setBusyId(id);
    try {
      await placeholderService.reviewLeave(id, status);
      pushToast(`Leave request ${status.toLowerCase()}.`);
      setReloadKey((value) => value + 1);
    } catch (requestError) { pushToast(errorMessage(requestError, 'Unable to review leave request.'), 'error'); }
    finally { setBusyId(''); }
  };
  return <div className="workflow-page">
    <PageHeader eyebrow="People operations" title={manager ? 'Leave requests' : 'My leave'} description={manager ? 'Review requests submitted by employees.' : 'Submit requests and follow their review status.'} actions={!manager && <Button icon="plus" onClick={() => setOpen(true)}>Request leave</Button>} />
    <TableCard>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Loading leave requests…</p> : rows.length ? <table className="data-table"><thead><tr>{manager && <th>Employee</th>}<th>From</th><th>To</th><th>Reason</th><th>Status</th>{manager && <th>Actions</th>}</tr></thead><tbody>
        {rows.map((leave) => <tr key={recordId(leave)}>{manager && <td>{leave.name || 'Employee'}</td>}<td>{displayDate(leave.from)}</td><td>{displayDate(leave.to)}</td><td>{leave.reason || '—'}{leave.reviewNote && <small className="people-subtext">Review: {leave.reviewNote}</small>}</td><td><StatusBadge>{leave.status || 'Pending'}</StatusBadge></td>{manager && <td>{leave.status === 'Pending' && <div className="people-actions"><Button variant="ghost" disabled={busyId === recordId(leave)} onClick={() => review(leave, 'Approved')}>Approve</Button><Button variant="ghost" disabled={busyId === recordId(leave)} onClick={() => review(leave, 'Rejected')}>Reject</Button></div>}</td>}</tr>)}
      </tbody></table> : <EmptyState icon="calendar" title="No leave requests" description={manager ? 'Submitted employee requests will appear here.' : 'Your submitted requests will appear here.'} />}
    </TableCard>
    <Pager page={page} pages={pages} onChange={setPage} />
    <LeaveRequestForm open={open} onClose={() => setOpen(false)} onSave={create} />
  </div>;
}

function PayrollForm({ open, onClose, employees, entry, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(entry ? {
      employeeId: String(entry.employeeId?._id || entry.employeeId || ''),
      salaryMonth: entry.salaryMonth || '', basicSalary: entry.basicSalary ?? '',
      allowances: entry.allowances ?? 0, deductions: entry.deductions ?? 0,
      status: entry.status || 'Pending', payDate: entry.payDate ? new Date(entry.payDate).toISOString().slice(0, 10) : ''
    } : { employeeId: '', salaryMonth: today().slice(0, 7), basicSalary: '', allowances: 0, deductions: 0, status: 'Pending', payDate: '' });
  }, [open, entry]);
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try { if (await onSave(form)) onClose(); } finally { setSaving(false); }
  };
  return <Modal open={open} onClose={onClose} title={entry ? 'Edit payroll' : 'Create payroll'} description="Set the employee, pay period, earnings and deductions. Net pay is calculated on save.">
    <form className="modal-form people-form" onSubmit={submit}>
      <div className="form-field"><label htmlFor="payroll-employee">Employee</label><select id="payroll-employee" name="employeeId" value={form.employeeId || ''} onChange={change} required><option value="">Select employee</option>{entry && !employees.some((employee) => recordId(employee) === form.employeeId) && <option value={form.employeeId}>{entry.name} · Existing employee</option>}{employees.map((employee) => <option key={recordId(employee)} value={recordId(employee)}>{employee.name} · {employee.department || 'No department'}</option>)}</select></div>
      <FormField label="Salary month" name="salaryMonth" type="month" value={form.salaryMonth || ''} onChange={change} required />
      <FormField label="Basic salary" name="basicSalary" type="number" value={form.basicSalary ?? ''} onChange={change} required />
      <FormField label="Allowances" name="allowances" type="number" value={form.allowances ?? 0} onChange={change} />
      <FormField label="Deductions" name="deductions" type="number" value={form.deductions ?? 0} onChange={change} />
      <div className="form-field"><label htmlFor="payroll-net-salary">Net salary</label><input id="payroll-net-salary" type="number" value={Math.max(0, Number(form.basicSalary || 0) + Number(form.allowances || 0) - Number(form.deductions || 0))} readOnly /></div>
      {entry && <><div className="form-field"><label htmlFor="payroll-status">Payment status</label><select id="payroll-status" name="status" value={form.status || 'Pending'} onChange={change}><option>Pending</option><option>Processed</option><option>Paid</option></select></div><FormField label="Payment date" name="payDate" type="date" value={form.payDate || ''} onChange={change} /></>}
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><LoadingButton type="submit" loading={saving}>Save payroll</LoadingButton></div>
    </form>
  </Modal>;
}

export function PayrollManagementPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState(null);
  const payroll = usePageData('payroll', { page, limit: 20, month });
  const canManage = ['admin', 'hr'].includes(user?.role);
  useEffect(() => {
    if (!canManage) {
      setLoadingEmployees(false);
      return undefined;
    }
    let active = true;
    setLoadingEmployees(true);
    placeholderService.listPage('employees', { status: 'active', page: 1, limit: 100 }).then(async (result) => {
      const pages = result.pagination?.pages || 1;
      const laterPages = pages > 1
        ? await Promise.all(Array.from({ length: pages - 1 }, (_, index) =>
          placeholderService.listPage('employees', { status: 'active', page: index + 2, limit: 100 })))
        : [];
      if (active) setEmployees([...(result.data || []), ...laterPages.flatMap((pageResult) => pageResult.data || [])]);
    }).catch((error) => { if (active) pushToast(errorMessage(error, 'Unable to load employees.'), 'error'); })
      .finally(() => { if (active) setLoadingEmployees(false); });
    return () => { active = false; };
  }, [canManage, pushToast]);
  const save = async (form) => {
    try {
      if (entryToEdit) await placeholderService.update('payroll', recordId(entryToEdit), form);
      else await placeholderService.createResource('payroll', form);
      pushToast('Payroll record saved.');
      payroll.reload();
      return true;
    } catch (error) {
      pushToast(errorMessage(error, 'Unable to save payroll record.'), 'error');
      return false;
    }
  };
  const markPaid = async (entry) => {
    try {
      await placeholderService.update('payroll', recordId(entry), { status: 'Paid', payDate: today() });
      pushToast('Payroll marked as paid.');
      payroll.reload();
    } catch (error) {
      pushToast(errorMessage(error, 'Unable to update payroll status.'), 'error');
    }
  };
  return <div className="workflow-page">
    <PageHeader eyebrow="Finance & people" title={user?.role === 'employee' ? 'My payroll' : 'Payroll'} description={user?.role === 'employee' ? 'Review your monthly payroll records.' : 'Employee-linked monthly payroll with calculated net pay and payment tracking.'} actions={canManage && <Button icon="plus" disabled={loadingEmployees} onClick={() => { setEntryToEdit(null); setFormOpen(true); }}>New payroll</Button>} />
    <TableCard toolbar={<div className="people-toolbar"><label>Salary month<input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }} /></label><span>{payroll.total} records</span></div>}>
      {payroll.error && <p role="alert">{payroll.error}</p>}
      {payroll.loading ? <p role="status">Loading payroll…</p> : payroll.rows.length ? <table className="data-table"><thead><tr><th>Employee</th><th>Month</th><th>Basic salary</th><th>Allowances</th><th>Deductions</th><th>Net pay</th><th>Status</th>{canManage || user?.role === 'accountant' ? <th>Actions</th> : null}</tr></thead><tbody>
        {payroll.rows.map((entry) => <tr key={recordId(entry)}><td><strong>{entry.name || 'Employee'}</strong><small className="people-subtext">{entry.designation || entry.department || ''}</small></td><td>{entry.salaryMonth || '—'}</td><td>{Number(entry.basicSalary || 0).toLocaleString()}</td><td>{Number(entry.allowances || 0).toLocaleString()}</td><td>{Number(entry.deductions || 0).toLocaleString()}</td><td><strong>{Number(entry.netSalary || 0).toLocaleString()}</strong></td><td><StatusBadge>{entry.status || 'Pending'}</StatusBadge></td>{canManage ? <td><Button variant="ghost" onClick={() => { setEntryToEdit(entry); setFormOpen(true); }}>Edit</Button></td> : user?.role === 'accountant' ? <td>{entry.status !== 'Paid' && <Button variant="ghost" onClick={() => markPaid(entry)}>Mark paid</Button>}</td> : null}</tr>)}
      </tbody></table> : <EmptyState icon="wallet" title="No payroll records" description="Create a monthly payroll entry linked to an employee." />}
    </TableCard>
    <Pager page={payroll.page} pages={payroll.pages} onChange={setPage} />
    <PayrollForm open={formOpen} onClose={() => setFormOpen(false)} employees={employees} entry={entryToEdit} onSave={save} />
  </div>;
}

export function HrDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    placeholderService.dashboard('hr').then((result) => { if (active) { setData(result); setError(''); } })
      .catch((requestError) => { if (active) setError(errorMessage(requestError, 'Unable to load the HR dashboard.')); });
    return () => { active = false; };
  }, [retry]);
  return <div className="dashboard-page admin-overview hr-overview">
    <header className="admin-overview-heading"><div className="eyebrow">People operations</div><h1>HR dashboard</h1><p>Current employee, attendance and leave-request data.</p></header>
    {error ? <div role="alert"><p>{error}</p><Button onClick={() => setRetry((value) => value + 1)}>Retry</Button></div>
      : !data ? <div className="admin-metric-grid" aria-busy="true">{Array.from({ length: 5 }, (_, index) => <div className="admin-metric-card" key={index}><span className="skeleton-line skeleton-1" /><span className="skeleton-line skeleton-0" /></div>)}</div>
        : <section className="admin-metric-grid" aria-label="HR overview">{data.stats.map(([label, value, , , icon], index) => <article className={`admin-metric-card admin-metric-${index % 3}`} key={label}><span className="admin-metric-icon"><Icon name={icon} size={20} /></span><span className="admin-metric-label">{label}</span><strong className="admin-metric-value">{value}</strong></article>)}</section>}
  </div>;
}
