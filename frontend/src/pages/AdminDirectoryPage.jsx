import { useEffect, useRef, useState } from 'react';
import { FiEdit3, FiRefreshCw, FiSlash, FiUserPlus } from 'react-icons/fi';
import { Avatar, Button, EmptyState, FilterSelect, FormField, LoadingButton, Modal, PageHeader, Pagination, SearchBar, StatusBadge, TableCard } from '../components/UI';
import { useToast } from '../context/AppContext';
import { placeholderService } from '../services/placeholderService';

const pageSize = 10;

const directoryInfo = {
  clients: { title: 'Client management', singular: 'client', description: 'Update client details and manage portal access.' },
  lawyers: { title: 'Lawyer management', singular: 'lawyer', description: 'Manage lawyer profiles and account access.' },
  users: { title: 'User management', singular: 'user', description: 'Manage user profiles, roles, and account access.' }
};

const userRoles = ['reception', 'lawyer', 'accountant', 'hr', 'employee', 'client'];

function fieldsFor(resource, editing) {
  if (resource === 'clients') return [
    { name: 'name', label: 'Full name', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone' },
    { name: 'company', label: 'Company' },
    { name: 'address', label: 'Address' },
    ...(editing ? [{ name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }] : [])
  ];
  if (resource === 'lawyers') return [
    { name: 'name', label: 'Full name', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    ...(!editing ? [{ name: 'password', label: 'Temporary password', type: 'password', required: true }] : []),
    ...(editing ? [{ name: 'password', label: 'New password (optional)', type: 'password' }] : []),
    { name: 'phone', label: 'Phone' },
    { name: 'title', label: 'Title' },
    { name: 'specialty', label: 'Specialty' },
    ...(editing ? [{ name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }] : [])
  ];
  return [
    { name: 'name', label: 'Full name', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    ...(!editing ? [{ name: 'password', label: 'Temporary password', type: 'password', required: true }] : []),
    ...(editing ? [{ name: 'password', label: 'New password (optional)', type: 'password' }] : []),
    { name: 'role', label: 'Role', type: 'select', options: userRoles, required: true },
    { name: 'phone', label: 'Phone' },
    { name: 'address', label: 'Address' },
    { name: 'company', label: 'Company' },
    { name: 'title', label: 'Title' },
    { name: 'specialty', label: 'Specialty' },
    { name: 'team', label: 'Department / team' },
    ...(editing ? [{ name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }] : [])
  ];
}

function recordId(record) {
  return record._id || record.id;
}

export function AdminDirectoryPage({ resource }) {
  const info = directoryInfo[resource];
  const { pushToast } = useToast();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState(null);
  const [deactivation, setDeactivation] = useState(null);
  const [saving, setSaving] = useState(false);
  const requestSequence = useRef(0);

  const loadRows = async (requestedPage = page) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await placeholderService.listPage(resource, {
        page: requestedPage,
        limit: pageSize,
        search,
        status: statusFilter
      });
      if (sequence === requestSequence.current) {
        setRows(result.data || []);
        setPages(Math.max(1, result.pagination?.pages || 1));
        setLoadError('');
      }
    } catch (error) {
      if (sequence === requestSequence.current) {
        setLoadError(error.response?.data?.message || error.message || `Unable to load ${info.title.toLowerCase()}.`);
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadRows(page);
    return () => { requestSequence.current += 1; };
  }, [resource, page, search, statusFilter]);

  const beginCreate = () => setEditor({ mode: 'create', record: null, form: resource === 'lawyers' ? { role: 'lawyer' } : {} });
  const beginEdit = (record) => {
    const form = { ...record, status: record.status || (record.active === false ? 'Inactive' : 'Active') };
    delete form._id;
    delete form.id;
    delete form.__v;
    delete form.createdAt;
    delete form.updatedAt;
    setEditor({ mode: 'edit', record, form });
  };

  const save = async (event) => {
    event.preventDefault();
    const fields = fieldsFor(resource, editor.mode === 'edit');
    const missing = fields.filter((field) => field.required && !String(editor.form[field.name] ?? '').trim());
    if (missing.length) {
      pushToast(`Please complete: ${missing.map((field) => field.label).join(', ')}`, 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...editor.form };
      if (!payload.password) delete payload.password;
      if (resource === 'lawyers') payload.role = 'lawyer';
      if (editor.mode === 'create') {
        const createResource = resource === 'lawyers' ? 'users' : resource;
        await placeholderService.createResource(createResource, payload);
        pushToast(`${info.singular[0].toUpperCase()}${info.singular.slice(1)} created.`);
      } else {
        await placeholderService.update(resource, recordId(editor.record), payload);
        pushToast(`${info.singular[0].toUpperCase()}${info.singular.slice(1)} updated.`);
      }
      setEditor(null);
      await loadRows();
    } catch (error) {
      pushToast(error.response?.data?.message || error.message || `Unable to save ${info.singular}.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setSaving(true);
    try {
      await placeholderService.remove(resource, recordId(deactivation));
      pushToast(`${info.singular[0].toUpperCase()}${info.singular.slice(1)} deactivated. Related records were retained.`);
      setDeactivation(null);
      await loadRows();
    } catch (error) {
      pushToast(error.response?.data?.message || error.message || `Unable to deactivate ${info.singular}.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (record) => {
    setSaving(true);
    try {
      await placeholderService.update(resource, recordId(record), { status: 'Active' });
      pushToast(`${info.singular[0].toUpperCase()}${info.singular.slice(1)} reactivated.`);
      await loadRows();
    } catch (error) {
      pushToast(error.response?.data?.message || error.message || `Unable to reactivate ${info.singular}.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const fields = fieldsFor(resource, editor?.mode === 'edit');
  const rowsForTable = rows.filter((row) => resource !== 'users' || row.role !== 'admin');

  return <div className="admin-directory-page">
    <PageHeader eyebrow="Administration" title={info.title} description={info.description}
      actions={<Button icon="userPlus" onClick={beginCreate}>Add {info.singular}</Button>} />
    <TableCard toolbar={<div className="admin-directory-toolbar">
      <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={`Search ${info.singular}s…`} />
      <FilterSelect value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={['Active', 'Inactive']} />
    </div>} footer={<Pagination page={page} pageCount={pages} onChange={setPage} />}>
      {loadError ? <div className="admin-directory-error" role="alert">{loadError}<Button variant="outline-gold" onClick={() => loadRows()}>Retry</Button></div>
        : loading ? <div className="admin-directory-loading" role="status">Loading {info.title.toLowerCase()}…</div>
          : <table className="data-table"><thead><tr>
            <th>{resource === 'clients' ? 'Client' : resource === 'lawyers' ? 'Lawyer' : 'User'}</th>
            <th>Contact</th>
            {resource === 'clients' && <th>Company</th>}
            {resource === 'users' && <th>Role</th>}
            {resource === 'lawyers' && <th>Specialty</th>}
            <th>Status</th><th>Actions</th>
          </tr></thead><tbody>
            {rowsForTable.map((row) => <tr key={recordId(row)}>
              <td><div className="person-cell"><Avatar initials={row.initials || row.avatar || String(row.name || 'U').slice(0, 2).toUpperCase()} color={resource === 'clients' ? 'gold' : 'blue'} size="sm" /><div><strong>{row.name}</strong><small>{row.title || ''}</small></div></div></td>
              <td><span className="table-primary">{row.email}</span><small className="table-secondary">{row.phone || '—'}</small></td>
              {resource === 'clients' && <td>{row.company || '—'}</td>}
              {resource === 'users' && <td><span className="type-chip">{row.role}</span></td>}
              {resource === 'lawyers' && <td>{row.specialty || '—'}</td>}
              <td><StatusBadge>{row.active === false ? 'Inactive' : row.status || 'Active'}</StatusBadge></td>
              <td><div className="admin-row-actions">
                <Button variant="outline-gold" onClick={() => beginEdit(row)}><FiEdit3 size={14} /> Edit</Button>
                {row.active === false || row.status === 'Inactive'
                  ? <Button variant="ghost" disabled={saving} onClick={() => reactivate(row)}><FiRefreshCw size={14} /> Reactivate</Button>
                  : <Button variant="ghost" className="admin-deactivate-button" onClick={() => setDeactivation(row)}><FiSlash size={14} /> Delete</Button>}
              </div></td>
            </tr>)}
            {!rowsForTable.length && <tr><td colSpan={5}><EmptyState icon="users" title={`No ${info.singular}s found`} description="Try changing the search or status filter." /></td></tr>}
          </tbody></table>}
    </TableCard>

    <Modal open={Boolean(editor)} onClose={() => !saving && setEditor(null)}
      title={`${editor?.mode === 'edit' ? 'Edit' : 'Add'} ${info.singular}`}
      description={editor?.mode === 'edit' ? 'Update this record. Set status to Inactive to disable access without removing records.' : `Create a ${info.singular} record.`}>
      {editor && <form className="modal-form" onSubmit={save}>
        {fields.map((field) => field.type === 'select'
          ? <div className="form-field" key={field.name}><label htmlFor={`admin-${field.name}`}>{field.label}</label>
            <select id={`admin-${field.name}`} value={editor.form[field.name] ?? ''} required={field.required}
              onChange={(event) => setEditor({ ...editor, form: { ...editor.form, [field.name]: event.target.value } })}>
              <option value="">Select {field.label.toLowerCase()}</option>
              {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select></div>
          : <FormField key={field.name} label={field.label} name={`admin-${field.name}`} type={field.type || 'text'}
            value={editor.form[field.name] ?? ''} required={field.required}
            onChange={(event) => setEditor({ ...editor, form: { ...editor.form, [field.name]: event.target.value } })} />)}
        <div className="modal-actions"><Button variant="ghost" type="button" disabled={saving} onClick={() => setEditor(null)}>Cancel</Button>
          <LoadingButton type="submit" loading={saving} icon="check">{editor.mode === 'edit' ? 'Save changes' : `Create ${info.singular}`}</LoadingButton></div>
      </form>}
    </Modal>

    <Modal open={Boolean(deactivation)} onClose={() => !saving && setDeactivation(null)}
      title={`Delete ${info.singular}?`}
      description={`${deactivation?.name || 'This account'} will be soft-deleted by setting status to Inactive and will no longer be able to sign in. Existing cases, documents, appointments, and billing records will be retained.`}>
      <div className="modal-actions"><Button variant="ghost" disabled={saving} onClick={() => setDeactivation(null)}>Cancel</Button>
        <LoadingButton loading={saving} onClick={deactivate}>Confirm delete</LoadingButton></div>
    </Modal>
  </div>;
}
