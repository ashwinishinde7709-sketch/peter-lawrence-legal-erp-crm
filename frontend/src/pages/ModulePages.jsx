import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FiCalendar, FiCheck, FiChevronDown, FiClock, FiCreditCard, FiDownload, FiEdit3, FiEye, FiFileText, FiFilter, FiMoreHorizontal, FiPlus, FiSearch, FiUploadCloud, FiUserPlus, FiUsers } from 'react-icons/fi';
import { Button, ChartCard, EmptyState, FilterSelect, FormField, Icon, LoadingButton, Modal, PageHeader, Pagination, SearchBar, StatusBadge, TableCard, Avatar } from '../components/UI';
import { useAuth, useToast } from '../context/AppContext';
import { placeholderService } from '../services/placeholderService';
import { getStatusTone } from '../utils/helpers';
import { useCollection } from '../hooks/useCollection';

const clients = []; const lawyers = []; const cases = []; const appointments = []; const documents = []; const invoices = []; const candidates = []; const employees = []; const payroll = [];

const tooltipStyle = { background: '#1E293B', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12 };

const collectionConfig = {
  clients: { key: 'clients', fallback: [], title: 'Client management' },
  lawyers: { key: 'lawyers', fallback: [], title: 'Lawyer management' },
  cases: { key: 'cases', fallback: [], title: 'Case management' },
  appointments: { key: 'appointments', fallback: [], title: 'Appointments' },
  documents: { key: 'documents', fallback: [], title: 'Documents' },
  billing: { key: 'invoices', fallback: [], title: 'Billing & invoices' },
  invoices: { key: 'invoices', fallback: [], title: 'Invoices' },
  recruitment: { key: 'candidates', fallback: [], title: 'Recruitment' },
  payroll: { key: 'payroll', fallback: [], title: 'Payroll' },
  users: { key: 'employees', fallback: [], title: 'Users' },
  employees: { key: 'employees', fallback: [], title: 'Employees' },
  attendance: { key: 'employees', fallback: [], title: 'Attendance' },
};

function useListData(key, fallback = []) {
  const [state, setState] = useState({ items: fallback, loading: Boolean(key), error: false });
  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    setState({ items: fallback, loading: true, error: false });
    placeholderService.list(key).then((items) => live && setState({ items, loading: false, error: false })).catch(() => live && setState({ items: [], loading: false, error: true }));
    return () => { live = false; };
  }, [key]);
  return state;
}

function ModuleLoading({ title }) { return <div><PageHeader eyebrow="Workspace" title={title} description="Loading the latest workspace data…" /><div className="module-loading-grid"><div className="surface-card"><div className="skeleton-stack"><span className="skeleton-line skeleton-1" /><span className="skeleton-line skeleton-0" /><span className="skeleton-line skeleton-2" /></div></div><div className="surface-card"><div className="skeleton-stack"><span className="skeleton-line skeleton-1" /><span className="skeleton-line skeleton-2" /><span className="skeleton-line skeleton-0" /></div></div></div></div>; }
function ModuleFailure({ title }) { return <EmptyState icon="file" title={`Could not load ${title.toLowerCase()}`} description="The demo service did not return a response. Try again from the workspace navigation." action={<Button icon="arrow">Retry connection</Button>} />; }

function CreateModal({ open, onClose, title, resource, fields, onCreated }) { const { pushToast } = useToast(); const [form, setForm] = useState({}); const [saving, setSaving] = useState(false); useEffect(() => { if (open) setForm({}); }, [open]); if (!open) return null; const submit = async (event) => { event.preventDefault(); const missing = fields.filter(field => field.required && !String(form[field.name] ?? '').trim()); if (missing.length) { pushToast(`Please complete: ${missing.map(field => field.label).join(', ')}`, 'error'); return; } setSaving(true); try { const { data } = await placeholderService.createResource(resource, form); await onCreated?.(data); pushToast(`${title} created successfully.`); onClose(); } catch (error) { pushToast(error.response?.data?.message || `Unable to create ${title.toLowerCase()}.`, 'error'); } finally { setSaving(false); } }; return <Modal open={open} onClose={onClose} title={`Add ${title}`} description="Enter the required details and save this record to MongoDB."><form onSubmit={submit} className="modal-form">{fields.map(field => field.type === 'select' ? <div className="form-field" key={field.name}><label htmlFor={field.name}>{field.label}</label><select id={field.name} value={form[field.name] || ''} onChange={event => setForm({ ...form, [field.name]: event.target.value })} required={field.required}><option value="">Select {field.label}</option>{field.options.map(option => { const value = typeof option === 'string' ? option : option.value; const label = typeof option === 'string' ? option : option.label; return <option key={value} value={value}>{label}</option>; })}</select></div> : <FormField key={field.name} label={field.label} name={field.name} type={field.type || 'text'} value={form[field.name] || ''} onChange={event => setForm({ ...form, [field.name]: event.target.value })} required={field.required} placeholder={field.placeholder || ''} />)}<div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><LoadingButton type="submit" loading={saving} icon="check">Save record</LoadingButton></div></form></Modal>; }

export function ModulePage({ type }) {
  const { user } = useAuth();
  const config = collectionConfig[type];
  const { items, loading, error } = useListData(config?.key, config?.fallback || []);
  if (config && loading) return <ModuleLoading title={config.title} />;
  if (config && error) return <ModuleFailure title={config.title} />;
  if (type === 'clients') return <ClientsModule initialItems={items} />;
  if (type === 'users') return <UsersModule items={items} />;
  if (type === 'lawyers') return <LawyersModule items={items} />;
  if (type === 'cases') return <CasesModule items={items} role={user?.role} />;
  if (type === 'appointments') return <AppointmentsModule items={items} />;
  if (type === 'documents') return <DocumentsModule initialItems={items} />;
  if (['billing', 'invoices'].includes(type)) return <BillingModule items={items} />;
  if (type === 'recruitment') return <RecruitmentModule items={items} />;
  if (type === 'payroll') return <PayrollModule items={items} />;
  if (type === 'reports') return <ReportsModule />;
  if (type === 'hearings') return <HearingsModule />;
  if (type === 'employees') return <DirectoryModule title="Employees" eyebrow="People operations" description="The people and teams that make the firm move." items={items} type="employees" />;
  if (type === 'attendance') return <AttendanceModule items={items} />;
  if (type === 'leave') return <LeaveModule />;
  if (type === 'tasks') return <TasksModule />;
  if (type === 'profile') return <ProfileModule />;
  if (type === 'settings') return <SettingsModule />;
  if (type === 'expenses') return <ExpensesModule />;
  return <EmptyState title="Module coming into view" description="This workspace is ready for the next layer of your operating model." action={<Button to=".." icon="arrow">Back to dashboard</Button>} />;
}

function ClientsModule({ initialItems = clients }) {
  const { pushToast } = useToast(); const [items, setItems] = useState(initialItems); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [form, setForm] = useState({ name: '', email: '', phone: '', company: '' }); const collection = useCollection(items, ['name', 'company', 'email', 'id']);
  const submit = async (event) => { event.preventDefault(); setLoading(true); const created = await placeholderService.createClient(form); setItems((current) => [created, ...current]); setLoading(false); setOpen(false); setForm({ name: '', email: '', phone: '', company: '' }); pushToast('Client added to the directory.'); };
  return <div><PageHeader eyebrow="Relationships" title="Client management" description="A clear view of the people and organisations we represent." actions={<Button icon="plus" onClick={() => setOpen(true)}>Add client</Button>} /><div className="module-summary-row"><div className="mini-summary"><span className="summary-icon summary-gold"><FiUsers size={18} /></span><div><strong>{items.length.toLocaleString()}</strong><span>Total clients</span></div></div><div className="mini-summary"><span className="summary-icon summary-teal"><FiCheck size={18} /></span><div><strong>{items.length}</strong><span>Active relationships</span></div></div><div className="mini-summary"><span className="summary-icon summary-blue"><FiClock size={18} /></span><div><strong>0</strong><span>New this month</span></div></div></div><TableCard toolbar={<><SearchBar value={collection.query} onChange={collection.setQuery} placeholder="Search clients, companies, or ID…" /><div className="toolbar-actions"><FilterSelect value={collection.filter} onChange={collection.setFilter} options={['Active', 'Onboarding', 'Inactive']} /><button className="icon-button"><FiDownload size={16} /></button></div></>} footer={<Pagination page={collection.page} pageCount={collection.pageCount} onChange={collection.setPage} />}><table className="data-table"><thead><tr><th>Client</th><th>Contact</th><th>Matters</th><th>Status</th><th>Joined</th><th /></tr></thead><tbody>{collection.current.map((client) => <tr key={client.id}><td><div className="person-cell"><Avatar initials={client.avatar} color="gold" size="sm" /><div><strong>{client.name}</strong><small>{client.id} · {client.company}</small></div></div></td><td><span className="table-primary">{client.email}</span><small className="table-secondary">{client.phone}</small></td><td><strong>{client.cases}</strong><small className="table-secondary">open matters</small></td><td><StatusBadge>{client.status}</StatusBadge></td><td><span className="table-primary">{client.joined}</span></td><td><button className="row-menu" aria-label={`Actions for ${client.name}`}><FiMoreHorizontal size={18} /></button></td></tr>)}</tbody></table></TableCard><Modal open={open} onClose={() => setOpen(false)} title="Add a new client" description="Create a relationship record and keep the next step visible."><form onSubmit={submit} className="modal-form"><FormField label="Full name / organisation" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Northstar Holdings" /><FormField label="Company / descriptor" name="company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company or Independent" /><div className="form-row"><FormField label="Email" name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="legal@company.com" /><FormField label="Phone" name="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 212…" /></div><div className="modal-actions"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><LoadingButton type="submit" loading={loading} icon="plus">Add client</LoadingButton></div></form></Modal></div>;
}

function UsersModule({ items = [] }) { const [rows, setRows] = useState(items); const [open, setOpen] = useState(false); const reload = async () => setRows(await placeholderService.list('users')); return <div><PageHeader eyebrow="Administration" title="User management" description="Keep roles, access, and activity clear across the firm." actions={<Button icon="userPlus" onClick={() => setOpen(true)}>Add user</Button>} /><TableCard toolbar={<><SearchBar value="" onChange={() => {}} placeholder="Search users…" /><FilterSelect value="All" onChange={() => {}} options={['Admin', 'Lawyer', 'Reception', 'HR', 'Accountant', 'Employee', 'Client']} /></>}><table className="data-table"><thead><tr><th>User</th><th>Email</th><th>Access</th><th>Status</th><th /></tr></thead><tbody>{rows.map((item) => <tr key={item._id || item.id || item.email}><td><div className="person-cell"><Avatar initials={item.initials || item.avatar || 'U'} color="blue" size="sm" /><strong>{item.name}</strong></div></td><td>{item.email}</td><td><span className="type-chip">{item.role || 'User'}</span></td><td><StatusBadge>{item.active === false ? 'Inactive' : 'Active'}</StatusBadge></td><td /></tr>)}</tbody></table>{!rows.length && <EmptyState icon="users" title="No users yet" description="Create the first team or client account." />}</TableCard><CreateModal open={open} onClose={() => setOpen(false)} title="user" resource="users" fields={[{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'password', label: 'Temporary password', type: 'password', required: true }, { name: 'role', label: 'Role', type: 'select', options: ['reception', 'hr', 'accountant', 'employee', 'lawyer', 'client'], required: true }, { name: 'phone', label: 'Phone' }, { name: 'address', label: 'Address' }, { name: 'company', label: 'Company' }, { name: 'title', label: 'Title' }, { name: 'specialty', label: 'Specialty' }, { name: 'team', label: 'Department / team' }]} onCreated={reload} /></div>; }
function LawyersModule({ items = [] }) { const [rows, setRows] = useState(items); const [open, setOpen] = useState(false); const reload = async () => setRows(await placeholderService.list('lawyers')); return <div><PageHeader eyebrow="The team" title="Lawyer management" description="The expertise, capacity, and focus behind every matter." actions={<Button icon="plus" onClick={() => setOpen(true)}>Add lawyer</Button>} /><div className="lawyer-grid">{rows.map((lawyer) => <div className="lawyer-card surface-card" key={lawyer._id || lawyer.id || lawyer.name}><div className="lawyer-card-top"><Avatar initials={lawyer.initials || 'LW'} color="blue" size="lg" /></div><div className="lawyer-identity"><h3>{lawyer.name}</h3><p>{lawyer.title}</p><StatusBadge tone={getStatusTone(lawyer.status)}>{lawyer.status}</StatusBadge></div><div className="lawyer-specialty"><span>Specialisation</span><strong>{lawyer.specialty}</strong></div></div>)}{!rows.length && <EmptyState icon="users" title="No lawyers yet" description="Add the first lawyer to your firm directory." />}</div><CreateModal open={open} onClose={() => setOpen(false)} title="lawyer" resource="users" fields={[{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'password', label: 'Temporary password', type: 'password', required: true }, { name: 'role', label: 'Role', type: 'select', options: ['lawyer'], required: true }, { name: 'title', label: 'Title' }, { name: 'specialty', label: 'Specialty' }]} onCreated={reload} /></div>; }
function CasesModule({ items = [], role }) { const { pushToast } = useToast(); const [rows, setRows] = useState(items); const [open, setOpen] = useState(false); const [clients, setClients] = useState([]); const [lawyers, setLawyers] = useState([]); useEffect(() => { if (role !== 'admin') return undefined; let live = true; Promise.all([placeholderService.list('clients'), placeholderService.list('lawyers')]).then(([clientRows, lawyerRows]) => { if (!live) return; setClients(clientRows); setLawyers(lawyerRows); }).catch(() => { if (live) pushToast('Unable to load clients and lawyers for case assignment.', 'error'); }); return () => { live = false; }; }, [role]); const reload = async () => setRows(await placeholderService.list('cases')); const fields = [{ name: 'title', label: 'Case title', required: true }, { name: 'type', label: 'Case type', required: true }, { name: 'description', label: 'Description' }, ...(role === 'admin' ? [{ name: 'clientId', label: 'Client', type: 'select', options: clients.map(client => ({ value: client._id || client.id, label: client.name })) }, { name: 'lawyerId', label: 'Assigned lawyer', type: 'select', options: lawyers.map(lawyer => ({ value: lawyer._id || lawyer.id, label: lawyer.name })) }] : []), { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Urgent'], required: true }, { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'In Progress', 'Closed'], required: true }]; return <div><PageHeader eyebrow="Matters" title="Case management" description="Every matter, deadline, and next action in one operating view." actions={<Button icon="plus" onClick={() => setOpen(true)}>New case</Button>} /><TableCard><table className="data-table"><thead><tr><th>Case</th><th>Type</th><th>Status</th><th>Priority</th></tr></thead><tbody>{rows.map(item => <tr key={item._id || item.id}><td><strong>{item.title}</strong></td><td>{item.type}</td><td><StatusBadge>{item.status}</StatusBadge></td><td><StatusBadge>{item.priority}</StatusBadge></td></tr>)}</tbody></table>{!rows.length && <EmptyState icon="folder" title="No cases yet" description="Create the first case record." />}</TableCard><CreateModal open={open} onClose={() => setOpen(false)} title="case" resource="cases" fields={fields} onCreated={reload} /></div>; }
function AppointmentsModule({ items = appointments }) { const [rows,setRows]=useState(items); const [open,setOpen]=useState(false); const reload=async()=>setRows(await placeholderService.list('appointments')); return <div><PageHeader eyebrow="Your calendar" title="Appointments" description="A calm view of conversations, hearings, and time that matters." actions={<Button icon="plus" onClick={()=>setOpen(true)}>Book appointment</Button>} /><TableCard><table className="data-table"><thead><tr><th>Appointment</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>{rows.map(item=><tr key={item._id||item.id}><td><strong>{item.title||'Client meeting'}</strong><small className="table-secondary">{item.client||item.person||'—'}</small></td><td>{item.date?new Date(item.date).toLocaleDateString():'—'}</td><td>{item.time||'—'}</td><td><StatusBadge>{item.status||'Scheduled'}</StatusBadge></td></tr>)}</tbody></table>{!rows.length&&<EmptyState icon="calendar" title="No appointments yet" description="Book the first appointment." />}</TableCard><CreateModal open={open} onClose={()=>setOpen(false)} title="appointment" resource="appointments" fields={[{name:'title',label:'Title',required:true},{name:'client',label:'Client / attendee',required:true},{name:'date',label:'Date',type:'date',required:true},{name:'time',label:'Time',type:'time',required:true},{name:'location',label:'Location'},{name:'status',label:'Status',type:'select',options:['Scheduled','Completed','Cancelled'],required:true}]} onCreated={reload}/></div>; }
function DocumentsModule({ initialItems = [] }) {
  const { pushToast } = useToast();
  const [items, setItems] = useState(Array.isArray(initialItems) ? initialItems : []);
  const [drag, setDrag] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');

  const visible = items.filter((item = {}) => {
    const name = String(item.name || '').toLowerCase();
    const type = item.type || 'FILE';
    return (!query || name.includes(query.toLowerCase())) &&
      (filter === 'All' || type === filter);
  });

  const addFiles = async (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;

    try {
      const uploaded = await Promise.all(
        selected.map((file) => placeholderService.upload(file))
      );

      const records = uploaded.map((response, index) => {
        const file = response?.data?.file || {};
        return {
          name: file.name || selected[index].name,
          type: file.mimeType?.split('/')?.pop()?.toUpperCase() || 'FILE',
          size: `${Math.max(1, Math.round(selected[index].size / 1024))} KB`,
          updated: 'Just now',
          owner: 'You',
          color: 'blue'
        };
      });

      setItems((current) => [...records, ...current]);
      pushToast(`${records.length} document(s) added to your workspace.`);
    } catch (error) {
      console.error(error);
      pushToast('Unable to upload the selected document.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge base"
        title="Documents"
        description="Keep the right version close, searchable, and ready when it matters."
        actions={<Button icon="download">Export index</Button>}
      />

      <label
        className={`upload-dropzone ${drag ? 'is-dragging' : ''}`}
        onDragOver={(e)=>{e.preventDefault();setDrag(true);}}
        onDragLeave={()=>setDrag(false)}
        onDrop={(e)=>{
          e.preventDefault();
          setDrag(false);
          addFiles({target:{files:e.dataTransfer.files}});
        }}
      >
        <input type="file" multiple onChange={addFiles}/>
        <span className="drop-icon"><FiUploadCloud size={25}/></span>
        <strong>Drop files here or <em>browse</em></strong>
        <small>PDF, DOCX, XLSX, PNG · up to 25 MB each</small>
      </label>

      <div className="document-toolbar">
        <div>
          <h3>Recent documents</h3>
          <p>{visible.length} files across your active matters</p>
        </div>
        <div className="toolbar-actions">
          <SearchBar value={query} onChange={setQuery} placeholder="Search documents…"/>
          <FilterSelect value={filter} onChange={setFilter} options={['PDF','DOCX','XLSX']}/>
        </div>
      </div>

      <div className="document-grid">
        {visible.map((doc, index)=>(
          <div className="document-card surface-card" key={doc.name || index}>
            <div className="document-card-top">
              <span className={`file-icon file-${doc.color || 'blue'}`}>
                <FiFileText size={21}/>
              </span>
              <button className="more-btn"><FiMoreHorizontal size={18}/></button>
            </div>
            <h3>{doc.name || 'Untitled document'}</h3>
            <p>{doc.type || 'FILE'} · {doc.size || '0 KB'}</p>
            <div className="document-meta">
              <Avatar
                initials={
                  doc.owner
                    ? doc.owner.split(' ').map((part)=>part[0]).join('').slice(0,2)
                    : 'U'
                }
                color="gold"
                size="xs"
              />
              <span>{doc.owner || 'Unknown'}</span>
              <small>{doc.updated || '-'}</small>
            </div>
          </div>
        ))}
        {!visible.length &&
          <EmptyState icon="file" title="No documents match" description="Try another file name or upload a document."/>
        }
      </div>
    </div>
  );
}

function BillingModule({ items = [] }) { const [rows, setRows] = useState(items); const [open, setOpen] = useState(false); const reload = async () => setRows(await placeholderService.list('invoices')); return <div><PageHeader eyebrow="Finance" title="Billing & invoices" description="Make the commercial side of great legal work feel effortless." actions={<Button icon="plus" onClick={() => setOpen(true)}>Create invoice</Button>} /><TableCard><table className="data-table"><thead><tr><th>Invoice</th><th>Amount</th><th>Due date</th><th>Status</th></tr></thead><tbody>{rows.map(item => <tr key={item._id || item.id}><td><strong>{item.id || item.number}</strong></td><td>{item.amount}</td><td>{item.due}</td><td><StatusBadge>{item.status}</StatusBadge></td></tr>)}</tbody></table>{!rows.length && <EmptyState icon="file" title="No invoices yet" description="Create the first invoice record." />}</TableCard><CreateModal open={open} onClose={() => setOpen(false)} title="invoice" resource="invoices" fields={[{ name: 'number', label: 'Invoice number', required: true }, { name: 'amount', label: 'Amount', type: 'number', required: true }, { name: 'dueAt', label: 'Due date', type: 'date', required: true }, { name: 'status', label: 'Status', type: 'select', options: ['Outstanding', 'Paid', 'Overdue'], required: true }]} onCreated={reload} /></div>; }
function RecruitmentModule({ items = [] }) { const [rows, setRows] = useState(items); const [open, setOpen] = useState(false); const reload = async () => setRows(await placeholderService.list('candidates')); return <div><PageHeader eyebrow="People operations" title="Recruitment" description="A thoughtful pipeline for the people who will shape what comes next." actions={<Button icon="userPlus" onClick={() => setOpen(true)}>Add candidate</Button>} /><div className="pipeline-board">{['Applied', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected'].map(stage => <div className="pipeline-column" key={stage}><div className="pipeline-heading"><div><span className="pipeline-dot" />{stage}</div><span>{rows.filter(item => item.stage === stage).length}</span></div><div className="pipeline-cards">{rows.filter(item => item.stage === stage).map(candidate => <div className="candidate-card surface-card" key={candidate._id || candidate.name}><h3>{candidate.name}</h3><p>{candidate.email}</p></div>)}</div></div>)}</div>{!rows.length && <EmptyState icon="users" title="No candidates yet" description="Add the first candidate application." />}<CreateModal open={open} onClose={() => setOpen(false)} title="candidate" resource="candidates" fields={[{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', required: true }, { name: 'stage', label: 'Status', type: 'select', options: ['Applied', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected'], required: true }]} onCreated={reload} /></div>; }
function PayrollModule({ items = [] }) { const [rows, setRows] = useState(items); const [open, setOpen] = useState(false); const reload = async () => setRows(await placeholderService.list('payroll')); return <div><PageHeader eyebrow="Finance" title="Payroll" description="A clear, respectful view of the numbers behind the people." actions={<Button icon="plus" onClick={() => setOpen(true)}>Add payroll record</Button>} /><TableCard><table className="data-table"><thead><tr><th>Employee</th><th>Salary</th><th>Pay date</th><th>Status</th></tr></thead><tbody>{rows.map(item => <tr key={item._id || item.id}><td>{item.name}</td><td>{item.salary}</td><td>{item.payDate || '—'}</td><td><StatusBadge>{item.status}</StatusBadge></td></tr>)}</tbody></table>{!rows.length && <EmptyState icon="users" title="No payroll records yet" description="Add the first payroll record." />}</TableCard><CreateModal open={open} onClose={() => setOpen(false)} title="payroll record" resource="payroll" fields={[{ name: 'salary', label: 'Salary', type: 'number', required: true }, { name: 'payDate', label: 'Pay date', type: 'date', required: true }, { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Processed'], required: true }]} onCreated={reload} /></div>; }
function ReportsModule() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setReport(null);
    setError('');
    placeholderService.reports()
      .then((result) => { if (active) setReport(result); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unable to load reports.'); });
    return () => { active = false; };
  }, [retry]);
  if (error) return <div role="alert"><PageHeader eyebrow="Intelligence" title="Reports & analytics" /><p>{error}</p><Button onClick={() => setRetry((value) => value + 1)}>Retry</Button></div>;
  if (!report) return <ModuleLoading title="Reports & analytics" />;
  const summary = report.totalRevenue === undefined ? report : {
    totalRevenue: report.totalRevenue,
    monthlyRevenue: report.monthlyRevenue,
    pendingPayments: report.pendingPayments,
    totalInvoices: report.totalInvoices
  };
  const trends = report.revenueTrend || [];
  return <div>
    <PageHeader eyebrow="Intelligence" title="Reports & analytics" description="See the signals behind the work—generated from your database records." actions={<Button variant="outline-gold" icon="download">Export report</Button>} />
    <section className="report-summary" aria-label="Revenue statistics">
      {[['Total Revenue', summary.totalRevenue], ['Monthly Revenue', summary.monthlyRevenue],
        ['Pending Payments', summary.pendingPayments], ['Total Invoices', summary.totalInvoices]].map(([label, value]) =>
        <article className="surface-card" key={label}><span>{label}</span><strong>{label === 'Total Invoices' ? Number(value || 0).toLocaleString() : label === 'Total Revenue' && !Number(value) ? '₹0 Revenue' : `₹${Number(value || 0).toLocaleString('en-IN')}`}</strong></article>)}
    </section>
    <div className="report-grid">
      <ChartCard title="Revenue trend" subtitle="Confirmed payments and paid invoices by month">
        <ResponsiveContainer width="100%" height={275}><LineChart data={trends} margin={{ top: 12, right: 8, left: -18 }}>
          <CartesianGrid vertical={false} stroke="#E7EBF2" /><XAxis dataKey="name" axisLine={false} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`₹${Number(value || 0).toLocaleString('en-IN')}`, 'Revenue']} />
          <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} />
        </LineChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Case status" subtitle="Current database records"><ResponsiveContainer width="100%" height={275}><BarChart data={report.caseStatus || []}><CartesianGrid vertical={false} stroke="#E7EBF2" /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" fill="#1E293B" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Lawyer performance" subtitle="Closed matter percentage"><ResponsiveContainer width="100%" height={275}><BarChart data={report.lawyerPerformance || []}><CartesianGrid vertical={false} stroke="#E7EBF2" /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} domain={[0, 100]} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Recruitment statistics" subtitle="Candidate pipeline"><ResponsiveContainer width="100%" height={275}><PieChart><Pie data={report.recruitment || []} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>{(report.recruitment || []).map((entry, index) => <Cell key={entry.name} fill={['#1E293B', '#2563EB', '#22C55E', '#F59E0B', '#EF6A6A'][index % 5]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></ChartCard>
    </div>
  </div>;
}
function PracticeBar({ label, value }) { return <div className="practice-bar"><div><span>{label}</span><strong>{value}</strong></div><div><span style={{ width: value }} /></div></div>; }

function HearingsModule() { const [rows, setRows] = useState([]); const [open, setOpen] = useState(false); const reload = async () => setRows(await placeholderService.list('hearings')); useEffect(() => { reload(); }, []); return <div><PageHeader eyebrow="Court calendar" title="Hearings" description="The dates, documents, and preparation that keep a matter moving." actions={<Button icon="plus" onClick={() => setOpen(true)}>Add hearing</Button>} /><div className="hearing-list">{rows.map(item => <div className="surface-card hearing-card" key={item._id}><div><h3>{item.title}</h3><p>{item.court}</p><StatusBadge>{item.status}</StatusBadge></div><div className="hearing-meta"><span>{item.date ? new Date(item.date).toLocaleDateString() : '—'}</span></div></div>)}</div>{!rows.length && <EmptyState icon="calendar" title="No hearings yet" description="Add the first court or hearing record." />}<CreateModal open={open} onClose={() => setOpen(false)} title="hearing" resource="hearings" fields={[{ name: 'title', label: 'Hearing title', required: true }, { name: 'court', label: 'Court / venue', required: true }, { name: 'date', label: 'Date', type: 'date', required: true }, { name: 'status', label: 'Status', required: true }]} onCreated={reload} /></div>; }
function DirectoryModule({ title, eyebrow, description, items = [] }) { const [rows,setRows]=useState(items); const [open,setOpen]=useState(false); const reload=async()=>setRows(await placeholderService.list('employees')); return <div><PageHeader eyebrow={eyebrow} title={title} description={description} actions={<Button icon="plus" onClick={()=>setOpen(true)}>Add employee</Button>} /><TableCard><table className="data-table"><thead><tr><th>Employee</th><th>Team</th><th>Role</th><th>Status</th></tr></thead><tbody>{rows.map(item=><tr key={item._id||item.id||item.email}><td><div className="person-cell"><Avatar initials={item.initials||'EM'} color="blue" size="sm" /><strong>{item.name}</strong></div></td><td>{item.team||'—'}</td><td>{item.role||'employee'}</td><td><StatusBadge>{item.status||'Active'}</StatusBadge></td></tr>)}</tbody></table>{!rows.length&&<EmptyState icon="users" title="No employees yet" description="Add the first employee account." />}</TableCard><CreateModal open={open} onClose={()=>setOpen(false)} title="employee" resource="users" fields={[{name:'name',label:'Full name',required:true},{name:'email',label:'Email',type:'email',required:true},{name:'password',label:'Temporary password',type:'password',required:true},{name:'role',label:'Role',type:'select',options:['hr','accountant','employee'],required:true},{name:'team',label:'Department / team'},{name:'title',label:'Designation'},{name:'phone',label:'Phone'}]} onCreated={reload}/></div>; }
function AttendanceModule({ items = employees }) { return <div><PageHeader eyebrow="People operations" title="Attendance" description="A healthy rhythm is visible in the details." actions={<Button icon="download">Export report</Button>} /><div className="attendance-summary"><div className="attendance-hero surface-card"><div className="attendance-big">0<span>%</span></div><div><h3>Firm attendance today</h3><p>No attendance records yet.</p><div className="progress-track"><span style={{ width: '0%' }} /></div></div></div><div className="attendance-stat surface-card"><span className="summary-icon summary-teal"><FiClock size={18} /></span><strong>0</strong><small>Remote today</small></div><div className="attendance-stat surface-card"><span className="summary-icon summary-gold"><FiCalendar size={18} /></span><strong>0</strong><small>On leave today</small></div></div><DirectoryModule title="Team attendance" eyebrow="Daily register" description="A quick view of where the firm is working today." items={items} /></div>; }

function LeaveModule() { const [rows,setRows]=useState([]); const [open,setOpen]=useState(false); const reload=async()=>setRows(await placeholderService.list('leave')); useEffect(()=>{reload();},[]); return <div><PageHeader eyebrow="Time away" title="Leave" description="Plan rest well, return ready, and keep teams informed." actions={<Button icon="plus" onClick={()=>setOpen(true)}>Request leave</Button>} /><TableCard><table className="data-table"><thead><tr><th>Name</th><th>From</th><th>To</th><th>Status</th></tr></thead><tbody>{rows.map(item=><tr key={item._id||item.id}><td>{item.name||'—'}</td><td>{item.from?new Date(item.from).toLocaleDateString():'—'}</td><td>{item.to?new Date(item.to).toLocaleDateString():'—'}</td><td><StatusBadge>{item.status||'Pending'}</StatusBadge></td></tr>)}</tbody></table>{!rows.length&&<EmptyState icon="calendar" title="No leave requests yet" description="Submitted requests will appear here." />}</TableCard><CreateModal open={open} onClose={()=>setOpen(false)} title="leave request" resource="leave" fields={[{name:'name',label:'Employee name',required:true},{name:'from',label:'From',type:'date',required:true},{name:'to',label:'To',type:'date',required:true},{name:'reason',label:'Reason',required:true},{name:'status',label:'Status',type:'select',options:['Pending','Approved','Rejected'],required:true}]} onCreated={reload}/></div>; }
function TasksModule() { const [rows,setRows]=useState([]); const [open,setOpen]=useState(false); const reload=async()=>setRows(await placeholderService.list('tasks')); useEffect(()=>{reload();},[]); return <div><PageHeader eyebrow="Work queue" title="Tasks" description="The small actions that create meaningful momentum." actions={<Button icon="plus" onClick={()=>setOpen(true)}>New task</Button>} /><TableCard><table className="data-table"><thead><tr><th>Task</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead><tbody>{rows.map(item=><tr key={item._id||item.id}><td><strong>{item.title}</strong></td><td>{item.priority||'—'}</td><td>{item.dueAt?new Date(item.dueAt).toLocaleDateString():'—'}</td><td><StatusBadge>{item.status||'Pending'}</StatusBadge></td></tr>)}</tbody></table>{!rows.length&&<EmptyState icon="check" title="No tasks yet" description="Assigned tasks will appear here." />}</TableCard><CreateModal open={open} onClose={()=>setOpen(false)} title="task" resource="tasks" fields={[{name:'title',label:'Task title',required:true},{name:'priority',label:'Priority',type:'select',options:['Low','Medium','High'],required:true},{name:'dueAt',label:'Due date',type:'date',required:true},{name:'status',label:'Status',type:'select',options:['Pending','In Progress','Completed'],required:true}]} onCreated={reload}/></div>; }
function ProfileModule() { const user = JSON.parse(localStorage.getItem('pl-user') || '{}'); return <div><PageHeader eyebrow="Your account" title="Profile" description="Keep your details and preferences current." /><div className="profile-layout"><div className="surface-card profile-card-large"><Avatar initials={(user.name || 'User').slice(0, 2).toUpperCase()} color="blue" size="xl" /><div className="profile-name"><h2>{user.name || 'Your profile'}</h2><p>{user.role || 'Account'}</p><StatusBadge>Active</StatusBadge></div><div className="profile-details"><div><span>Email</span><strong>{user.email || '—'}</strong></div><div><span>Role</span><strong>{user.role || '—'}</strong></div></div></div></div></div>; }
function SettingsModule() {
  const { pushToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    placeholderService.settings()
      .then((result) => { if (active) setSettings(result.data); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || requestError.message || 'Unable to load firm settings.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const change = (field, value) => setSettings((current) => ({ ...current, [field]: value }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await placeholderService.updateSettings(settings);
      setSettings(result.data);
      pushToast('Firm settings saved.');
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message || 'Unable to save firm settings.', 'error');
    } finally {
      setSaving(false);
    }
  };
  if (loading) return <ModuleLoading title="Settings" />;
  if (error) return <div role="alert"><PageHeader eyebrow="Workspace controls" title="Settings" /><p>{error}</p><Button onClick={() => setRetry((value) => value + 1)}>Retry</Button></div>;
  if (!settings) return null;
  return <div>
    <PageHeader eyebrow="Workspace controls" title="Settings" description="Manage firm identity and system-wide defaults." actions={<Button icon="check" disabled={saving} onClick={() => document.getElementById('firm-settings-form')?.requestSubmit()}>{saving ? 'Saving…' : 'Save changes'}</Button>} />
    <form id="firm-settings-form" className="settings-grid" onSubmit={save}>
      <div className="settings-nav surface-card"><button type="button" className="active">Firm & system settings</button></div>
      <div className="surface-card settings-panel">
        <div className="card-heading"><div><h3>Firm settings</h3><p>Details used across the firm workspace and receipts.</p></div></div>
        <FormField label="Firm name" name="firmName" value={settings.firmName || ''} onChange={(event) => change('firmName', event.target.value)} required />
        <FormField label="Firm address" name="address" value={settings.address || ''} onChange={(event) => change('address', event.target.value)} />
        <div className="form-row">
          <FormField label="Phone" name="phone" value={settings.phone || ''} onChange={(event) => change('phone', event.target.value)} />
          <FormField label="Email" name="email" type="email" value={settings.email || ''} onChange={(event) => change('email', event.target.value)} />
        </div>
        <FormField label="Website" name="website" type="url" value={settings.website || ''} onChange={(event) => change('website', event.target.value)} />
        <FormField label="Logo URL" name="logoUrl" type="url" value={settings.logoUrl || ''} onChange={(event) => change('logoUrl', event.target.value)} />
        <div className="card-heading"><div><h3>System settings</h3><p>Currency, timezone, and branding defaults.</p></div></div>
        <div className="form-field"><label htmlFor="settings-currency">Default currency</label><select id="settings-currency" value={settings.currency || 'INR'} onChange={(event) => change('currency', event.target.value)}>{['INR', 'USD', 'GBP', 'EUR'].map((currency) => <option key={currency}>{currency}</option>)}</select></div>
        <FormField label="Timezone (IANA)" name="timezone" value={settings.timezone || ''} onChange={(event) => change('timezone', event.target.value)} placeholder="Asia/Kolkata" required />
        <FormField label="Branding" name="branding" value={settings.branding || ''} onChange={(event) => change('branding', event.target.value)} />
        <div className="modal-actions"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button></div>
      </div>
    </form>
  </div>;
}

function ExpensesModule() { const [rows,setRows]=useState([]); const [open,setOpen]=useState(false); const reload=async()=>setRows(await placeholderService.list('expenses')); useEffect(()=>{reload();},[]); const total=rows.reduce((s,x)=>s+Number(x.amount||0),0); return <div><PageHeader eyebrow="Finance" title="Expenses" description="Keep spend visible, categorised, and accountable." actions={<Button icon="plus" onClick={()=>setOpen(true)}>Add expense</Button>} /><div className="expense-grid"><div className="surface-card expense-card"><small>Total recorded</small><strong>${total.toLocaleString()}</strong><span>{rows.length} expense records</span></div></div><TableCard><table className="data-table"><thead><tr><th>Expense</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead><tbody>{rows.map(item=><tr key={item._id||item.id}><td>{item.title}</td><td>{item.category||'—'}</td><td>${Number(item.amount||0).toLocaleString()}</td><td><StatusBadge>{item.status||'Recorded'}</StatusBadge></td></tr>)}</tbody></table>{!rows.length&&<EmptyState icon="file" title="No expenses yet" description="Expense records will appear here when created." />}</TableCard><CreateModal open={open} onClose={()=>setOpen(false)} title="expense" resource="expenses" fields={[{name:'title',label:'Expense title',required:true},{name:'category',label:'Category',required:true},{name:'amount',label:'Amount',type:'number',required:true},{name:'status',label:'Status',type:'select',options:['Recorded','Approved','Paid'],required:true}]} onCreated={reload}/></div>; }