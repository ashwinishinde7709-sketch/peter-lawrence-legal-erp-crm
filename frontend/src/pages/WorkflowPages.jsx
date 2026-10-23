import { useEffect, useRef, useState } from 'react';
import { Button, EmptyState, FormField, LoadingButton, Modal, PageHeader, StatusBadge, TableCard } from '../components/UI';
import { useAuth, useToast } from '../context/AppContext';
import { placeholderService } from '../services/placeholderService';

function useWorkflowList(resource) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const requestSequence = useRef(0);
  const reload = async (requestedPage = page) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await placeholderService.listPage(resource, { page: requestedPage, limit: 20 });
      if (sequence === requestSequence.current) {
        setRows(result.data || []);
        setPages(Math.max(1, result.pagination?.pages || 1));
        setError('');
      }
    } catch (requestError) {
      if (sequence === requestSequence.current) setError(requestError.message || `Unable to load ${resource}.`);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  };
  useEffect(() => {
    reload(page);
    return () => { requestSequence.current += 1; };
  }, [resource, page]);
  return { rows, setRows, loading, error, reload, page, setPage, pages };
}

function WorkflowState({ loading, error, children }) {
  if (loading) return <p role="status">Loading records…</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!children) return null;
  return children;
}

function WorkflowPagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return <div className="workflow-pagination">
    <Button variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
    <span>Page {page} of {pages}</span>
    <Button variant="ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
  </div>;
}

function assignedCaseLawyer(item) {
  const lawyer = item.lawyerId?.name ? item.lawyerId : item.appointmentId?.lawyerId;
  return lawyer && typeof lawyer === 'object' ? lawyer : null;
}

function assignedCaseLawyerId(item) {
  const lawyer = assignedCaseLawyer(item);
  return String(lawyer?._id || item.lawyerId || '');
}

export function AssignedClientsPage() {
  const { rows, loading, error, page, setPage, pages } = useWorkflowList('clients');
  return <div className="workflow-page">
    <PageHeader eyebrow="Your practice" title="Assigned clients" description="Clients connected to your assigned matters." />
    <WorkflowState loading={loading} error={error}>
      <TableCard><table className="data-table"><thead><tr><th>Client</th><th>Email</th><th>Phone</th><th>Status</th></tr></thead><tbody>
        {rows.map((client) => <tr key={client._id || client.id}><td>{client.name}</td><td>{client.email}</td><td>{client.phone || '—'}</td><td><StatusBadge>{client.status || 'Active'}</StatusBadge></td></tr>)}
      </tbody></table>{!rows.length && <EmptyState icon="users" title="No assigned clients" description="Clients appear when a matter is assigned to you." />}</TableCard>
      <WorkflowPagination page={page} pages={pages} onChange={setPage} />
    </WorkflowState>
  </div>;
}

export function MessagesWorkflowPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const cases = useWorkflowList('cases');
  const [caseId, setCaseId] = useState('');
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!caseId && cases.rows[0]) setCaseId(cases.rows[0]._id || cases.rows[0].id);
  }, [caseId, cases.rows]);

  useEffect(() => {
    if (!caseId) return undefined;
    let active = true;
    setLoading(true);
    placeholderService.list('messages', { caseId, limit: 100 })
      .then((items) => { if (active) { setMessages(items); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unable to load messages.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [caseId]);

  const send = async (event) => {
    event.preventDefault();
    if (!message.trim() || !caseId) return;
    setSending(true);
    try {
      await placeholderService.createResource('messages', { caseId, body: message.trim() });
      setMessage('');
      setMessages(await placeholderService.list('messages', { caseId, limit: 100 }));
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return <div className="workflow-page">
    <PageHeader eyebrow="Matter communication" title="Messages" description="Keep client and lawyer conversations with the relevant matter." />
    <label className="workflow-form-card">Case<select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
      <option value="">Select a case</option>{cases.rows.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.title}</option>)}
    </select></label>
    {cases.error && <p role="alert">{cases.error}</p>}
    {error && <p role="alert">{error}</p>}
    {!caseId && !cases.loading && !cases.rows.length && <EmptyState icon="folder" title="No cases available" description="Messages are available for matters assigned to you." />}
    {caseId && <section className="workflow-message-panel">
      <div className="workflow-message-list" aria-live="polite">
        {loading ? <p>Loading messages…</p> : messages.map((item) => {
          const mine = String(item.senderId) === String(user?._id || user?.id);
          return <article key={item._id || item.id} className={`workflow-message ${mine ? 'is-mine' : ''}`}>
            <small>{mine ? 'You' : 'Matter participant'} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</small>
            <p>{item.body}</p>
          </article>;
        })}
        {!loading && !messages.length && <p>No messages for this case yet.</p>}
      </div>
      <form className="workflow-message-form" onSubmit={send}>
        <label htmlFor="case-message">Message</label>
        <textarea id="case-message" required maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} />
        <Button type="submit" disabled={sending || !message.trim()}>{sending ? 'Sending…' : 'Send message'}</Button>
      </form>
    </section>}
  </div>;
}

export function CaseWorkflowPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { rows, loading, error, reload, page, setPage, pages } = useWorkflowList('cases');
  const [progress, setProgress] = useState({});
  const [saving, setSaving] = useState({});
  const [lawyers, setLawyers] = useState([]);
  const [lawyerSelection, setLawyerSelection] = useState({});
  const [assigning, setAssigning] = useState({});
  const [caseToView, setCaseToView] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') return undefined;
    let active = true;
    placeholderService.list('lawyers')
      .then((items) => { if (active) setLawyers(items.filter((lawyer) => lawyer.status !== 'Inactive')); })
      .catch((requestError) => {
        if (active) pushToast(requestError.response?.data?.message || requestError.message || 'Unable to load lawyers.', 'error');
      });
    return () => { active = false; };
  }, [user?.role, pushToast]);

  const saveProgress = async (item) => {
    const id = item._id || item.id;
    setSaving((current) => ({ ...current, [id]: true }));
    try {
      const value = Number(progress[id] ?? item.progress ?? 0);
      await placeholderService.updateCaseProgress(id, value);
      pushToast(value === 100 ? 'Case completed. Finance can now create its invoice.' : 'Case progress updated.');
      await reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    } finally {
      setSaving((current) => ({ ...current, [id]: false }));
    }
  };

  const saveLawyer = async (item) => {
    const id = item._id || item.id;
    const lawyerId = lawyerSelection[id] || assignedCaseLawyerId(item);
    setAssigning((current) => ({ ...current, [id]: true }));
    try {
      await placeholderService.reassignCaseLawyer(id, lawyerId);
      pushToast('Assigned lawyer updated.');
      await reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    } finally {
      setAssigning((current) => ({ ...current, [id]: false }));
    }
  };

  return <div className="workflow-page">
    <PageHeader eyebrow="Matters" title="Case management" description="Review assigned matters and keep case progress current." />
    <WorkflowState loading={loading} error={error}>
      <TableCard><div className="workflow-case-list">
        {rows.map((item) => {
          const id = item._id || item.id;
          const value = Number(progress[id] ?? item.progress ?? 0);
          const currentLawyer = assignedCaseLawyer(item);
          const currentLawyerId = assignedCaseLawyerId(item);
          return <article className="workflow-record" key={id}>
            <div className="workflow-record-heading">
              <div><h3>{item.title}</h3><p>{item.type || 'Legal matter'} · {item.priority || 'Medium'} priority</p></div>
              <StatusBadge>{item.status || 'Pending'}</StatusBadge>
            </div>
            <dl className="workflow-case-details">
              <div><dt>Client</dt><dd>{item.clientId?.name || '—'}</dd></div>
              <div><dt>Assigned lawyer</dt><dd>{currentLawyer?.name || 'Unassigned'}</dd></div>
              <div><dt>Created</dt><dd>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</dd></div>
            </dl>
            <p>{item.description || 'No matter summary provided.'}</p>
            <div className="workflow-actions">
              <Button variant="ghost" onClick={() => setCaseToView(item)}>View case details</Button>
            </div>
            {user?.role === 'admin' && <div className="workflow-inline-form">
              <label>Reassign lawyer<select value={lawyerSelection[id] ?? currentLawyerId}
                onChange={(event) => setLawyerSelection((current) => ({ ...current, [id]: event.target.value }))}>
                <option value="">Select lawyer</option>
                {lawyers.map((lawyer) => <option key={lawyer._id || lawyer.id} value={lawyer._id || lawyer.id}>{lawyer.name}</option>)}
              </select></label>
              <Button disabled={Boolean(assigning[id]) || !lawyerSelection[id] || String(lawyerSelection[id]) === currentLawyerId}
                onClick={() => saveLawyer(item)}>{assigning[id] ? 'Saving…' : 'Save assignment'}</Button>
            </div>}
            <div className="workflow-progress">
              <label htmlFor={`progress-${id}`}>Progress: {value}%</label>
              <input id={`progress-${id}`} type="range" min="0" max="100" step="5" value={value}
                disabled={item.status === 'Completed' || (user?.role !== 'admin' && user?.role !== 'lawyer')}
                onChange={(event) => setProgress((current) => ({ ...current, [id]: event.target.value }))} />
              {(user?.role === 'admin' || user?.role === 'lawyer') && item.status !== 'Completed' &&
                <Button disabled={Boolean(saving[id])} onClick={() => saveProgress(item)}>{saving[id] ? 'Saving…' : 'Save progress'}</Button>}
            </div>
          </article>;
        })}
        {!rows.length && <EmptyState icon="folder" title="No cases yet" description="Cases are created after a consultation is approved." />}
      </div></TableCard>
      <WorkflowPagination page={page} pages={pages} onChange={setPage} />
    </WorkflowState>
    <Modal open={Boolean(caseToView)} onClose={() => setCaseToView(null)} title={caseToView?.title || 'Case details'}>
      {caseToView && <dl className="receipt-detail-list workflow-detail-modal">
        <div><dt>Case name</dt><dd>{caseToView.title}</dd></div>
        <div><dt>Client</dt><dd>{caseToView.clientId?.name || '—'}</dd></div>
        <div><dt>Assigned lawyer</dt><dd>{assignedCaseLawyer(caseToView)?.name || 'Unassigned'}</dd></div>
        <div><dt>Status</dt><dd>{caseToView.status || 'Pending'}</dd></div>
        <div><dt>Progress</dt><dd>{Number(caseToView.progress || 0)}%</dd></div>
        <div><dt>Created date</dt><dd>{caseToView.createdAt ? new Date(caseToView.createdAt).toLocaleDateString() : '—'}</dd></div>
      </dl>}
    </Modal>
  </div>;
}

export function AppointmentsWorkflowPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { rows, loading, error, reload, page, setPage, pages } = useWorkflowList('appointments');
  const [clients, setClients] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const [form, setForm] = useState({ title: '', date: '', time: '', type: 'Consultation', clientId: '', lawyerId: '' });
  const [assignments, setAssignments] = useState({});
  const [caseForms, setCaseForms] = useState({});
  const [busy, setBusy] = useState(false);
  const canAssign = ['admin', 'reception'].includes(user?.role);
  const canSchedule = canAssign || user?.role === 'lawyer';
  const canApprove = ['admin', 'lawyer'].includes(user?.role);

  useEffect(() => {
    if (!canSchedule) return undefined;
    let active = true;
    Promise.all([
      placeholderService.list('clients'),
      canAssign ? placeholderService.list('lawyers') : Promise.resolve([])
    ])
      .then(([clientRows, lawyerRows]) => {
        if (active) { setClients(clientRows); setLawyers(lawyerRows); }
      })
      .catch((requestError) => { if (active) pushToast(requestError.message || 'Unable to load assignment lists.', 'error'); });
    return () => { active = false; };
  }, [canAssign, canSchedule, pushToast]);

  const createAppointment = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = { title: form.title, date: form.date, time: form.time, type: form.type };
      if (canSchedule) Object.assign(payload, { clientId: form.clientId, status: 'Scheduled' });
      if (canAssign) payload.lawyerId = form.lawyerId;
      await placeholderService.createResource('appointments', payload);
      setForm({ title: '', date: '', time: '', type: 'Consultation', clientId: '', lawyerId: '' });
      pushToast(user?.role === 'client' ? 'Appointment request submitted.' : 'Appointment booked.');
      await reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const assign = async (item) => {
    const id = item._id || item.id;
    const value = assignments[id] || {};
    try {
      await placeholderService.updateAppointment(id, { clientId: value.clientId, lawyerId: value.lawyerId, status: 'Scheduled' });
      pushToast('Appointment assigned.');
      await reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    }
  };

  const markConsultationComplete = async (item) => {
    try {
      await placeholderService.updateAppointment(item._id || item.id, { status: 'Completed' });
      pushToast('Consultation marked complete. You can now approve it to open a case.');
      await reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    }
  };

  const approve = async (item) => {
    const id = item._id || item.id;
    const values = caseForms[id] || {};
    try {
      await placeholderService.approveConsultation(id, {
        title: values.title || item.title || 'New legal matter',
        type: item.type || 'Consultation',
        fee: Number(values.fee || 0)
      });
      pushToast('Consultation approved and case created.');
      await reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    }
  };

  return <div className="workflow-page">
    <PageHeader eyebrow="Client services" title="Appointments" description="Clients request a consultation; reception schedules it and a lawyer records the outcome." />
    <details className="workflow-form-card"><summary>{user?.role === 'client' ? 'Request an appointment' : 'Book an appointment'}</summary>
      <form onSubmit={createAppointment} className="workflow-form">
        <label>Appointment title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label>Time<input required type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
        {canSchedule && <label>Client<select required value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
            <option value="">Select a client</option>{clients.map((client) => <option key={client._id || client.id} value={client._id || client.id}>{client.name}</option>)}
          </select></label>}
        {canAssign && <>
          <label>Lawyer<select required value={form.lawyerId} onChange={(event) => setForm({ ...form, lawyerId: event.target.value })}>
            <option value="">Select a lawyer</option>{lawyers.map((lawyer) => <option key={lawyer._id || lawyer.id} value={lawyer._id || lawyer.id}>{lawyer.name}</option>)}
          </select></label>
        </>}
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : user?.role === 'client' ? 'Send request' : 'Book appointment'}</Button>
      </form>
    </details>
    <WorkflowState loading={loading} error={error}>
      <TableCard><div className="workflow-case-list">
        {rows.map((item) => {
          const id = item._id || item.id;
          const assignment = assignments[id] || { clientId: item.clientId || '', lawyerId: item.lawyerId || '' };
          const caseForm = caseForms[id] || { title: item.title || '', fee: '' };
          return <article className="workflow-record" key={id}>
            <div className="workflow-record-heading"><div><h3>{item.title || 'Consultation'}</h3><p>{item.client || 'Client request'} · {item.date ? new Date(item.date).toLocaleDateString() : 'Date not set'} {item.time || ''}</p></div><StatusBadge>{item.status || 'Requested'}</StatusBadge></div>
            {canAssign && !item.caseId && <div className="workflow-inline-form">
              <label>Client<select value={assignment.clientId} onChange={(event) => setAssignments({ ...assignments, [id]: { ...assignment, clientId: event.target.value } })}><option value="">Select a client</option>{clients.map((client) => <option key={client._id || client.id} value={client._id || client.id}>{client.name}</option>)}</select></label>
              <label>Lawyer<select value={assignment.lawyerId} onChange={(event) => setAssignments({ ...assignments, [id]: { ...assignment, lawyerId: event.target.value } })}><option value="">Select a lawyer</option>{lawyers.map((lawyer) => <option key={lawyer._id || lawyer.id} value={lawyer._id || lawyer.id}>{lawyer.name}</option>)}</select></label>
              <Button onClick={() => assign(item)} disabled={!assignment.clientId || !assignment.lawyerId}>Assign</Button>
            </div>}
            {user?.role === 'lawyer' && item.status !== 'Completed' && <Button onClick={() => markConsultationComplete(item)}>Mark consultation complete</Button>}
            {canApprove && item.status === 'Completed' && !item.consultationApproved && <div className="workflow-inline-form">
              <label>Case title<input value={caseForm.title} onChange={(event) => setCaseForms({ ...caseForms, [id]: { ...caseForm, title: event.target.value } })} /></label>
              <label>Fee<input type="number" min="0" step="0.01" value={caseForm.fee} onChange={(event) => setCaseForms({ ...caseForms, [id]: { ...caseForm, fee: event.target.value } })} /></label>
              <Button onClick={() => approve(item)}>Approve consultation & create case</Button>
            </div>}
            {item.consultationApproved && <p className="workflow-success">Consultation approved · Case {String(item.caseId || '').slice(-8)}</p>}
          </article>;
        })}
        {!rows.length && <EmptyState icon="calendar" title="No appointments yet" description="Appointment requests and bookings will appear here." />}
      </div></TableCard>
      <WorkflowPagination page={page} pages={pages} onChange={setPage} />
    </WorkflowState>
  </div>;
}

export function DocumentsWorkflowPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { rows, loading, error, reload, page, setPage, pages } = useWorkflowList('documents');
  const { rows: cases, page: casePage, setPage: setCasePage, pages: casePages } = useWorkflowList('cases');
  const [caseId, setCaseId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [requestName, setRequestName] = useState('');
  const [busy, setBusy] = useState(false);
  const isLawyer = user?.role === 'lawyer';
  const canUpload = ['admin', 'client', 'lawyer'].includes(user?.role);

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (documentId && files.length !== 1) {
      pushToast('Upload one file at a time when fulfilling a document request.', 'error');
      return;
    }
    setBusy(true);
    try {
      await Promise.all(files.map((file) => placeholderService.upload(file, { caseId, documentId })));
      pushToast(`${files.length} document(s) uploaded for review.`);
      setDocumentId('');
      event.target.value = '';
      await reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const requestDocument = async (event) => {
    event.preventDefault();
    try {
      await placeholderService.createResource('documents', { name: requestName, caseId, status: 'Requested', category: 'Requested document' });
      setRequestName('');
      pushToast('Document request sent to the client.');
      await reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    }
  };

  const review = async (item, reviewStatus) => {
    const reviewNote = window.prompt(reviewStatus === 'Approved' ? 'Optional review note' : 'Reason or instructions for the client') || '';
    try {
      await placeholderService.update('documents', item._id || item.id, { reviewStatus, reviewNote });
      pushToast(`Document ${reviewStatus.toLowerCase()}.`);
      await reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    }
  };

  const download = async (item) => {
    try {
      await placeholderService.downloadDocument(item.path, item.name);
    } catch (requestError) {
      pushToast(requestError.message || 'Unable to download this document.', 'error');
    }
  };

  return <div className="workflow-page">
    <PageHeader eyebrow="Matter files" title="Documents" description="Request, upload, and review case documents in one place." />
    {(canUpload || isLawyer) && <div className="workflow-form-card">
      <label>Case<select value={caseId} required onChange={(event) => setCaseId(event.target.value)}><option value="">Select a case</option>{cases.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.title}</option>)}</select></label>
      <WorkflowPagination page={casePage} pages={casePages} onChange={setCasePage} />
      {user?.role === 'client' && <label>Fulfill a document request<select value={documentId} onChange={(event) => setDocumentId(event.target.value)}><option value="">Optional — upload a new document</option>{rows.filter((item) => item.caseId === caseId && (item.status === 'Requested' || item.reviewStatus === 'Re-upload requested')).map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}</select></label>}
      {isLawyer && <form className="workflow-inline-form" onSubmit={requestDocument}>
        <label>Document to request<input required value={requestName} onChange={(event) => setRequestName(event.target.value)} /></label>
        <Button type="submit" disabled={!caseId}>Request document</Button>
      </form>}
      {canUpload && <label className="workflow-upload">Upload documents<input type="file" multiple disabled={!caseId || busy} onChange={uploadFiles} /><small>Maximum file size: 10 MB</small></label>}
    </div>}
    <WorkflowState loading={loading} error={error}>
      <div className="workflow-document-grid">
        {rows.map((item) => <article className="workflow-record" key={item._id || item.id}>
          <div className="workflow-record-heading"><div><h3>{item.name || 'Requested document'}</h3><p>{item.category || 'Case file'} · {item.status || item.reviewStatus || 'Pending'}</p></div><StatusBadge>{item.reviewStatus || item.status || 'Pending'}</StatusBadge></div>
          {item.reviewNote && <p>{item.reviewNote}</p>}
          {item.path && <div className="workflow-actions"><Button variant="outline-gold" onClick={() => download(item)}>Download</Button></div>}
          {isLawyer && item.path && item.reviewStatus === 'Pending' && <div className="workflow-actions">
            <Button onClick={() => review(item, 'Approved')}>Approve</Button>
            <Button variant="outline-gold" onClick={() => review(item, 'Rejected')}>Reject</Button>
            <Button variant="ghost" onClick={() => review(item, 'Re-upload requested')}>Request re-upload</Button>
          </div>}
        </article>)}
        {!rows.length && <EmptyState icon="file" title="No documents yet" description="Upload a case document or wait for your lawyer to request one." />}
      </div>
      <WorkflowPagination page={page} pages={pages} onChange={setPage} />
    </WorkflowState>
  </div>;
}

export function BillingWorkflowPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const invoices = useWorkflowList('invoices');
  const receipts = useWorkflowList('receipts');
  const payments = useWorkflowList('payments');
  const [methods, setMethods] = useState({});
  const [references, setReferences] = useState({});
  const [paymentDates, setPaymentDates] = useState({});
  const [busy, setBusy] = useState({});
  const [billingOptions, setBillingOptions] = useState({ clients: [], cases: [] });
  const [optionsError, setOptionsError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    clientId: '', caseId: '', number: '', amount: '',
    invoiceDate: new Date().toISOString().slice(0, 10), dueAt: '', description: '', notes: ''
  });
  const [receiptToView, setReceiptToView] = useState(null);
  const canRecord = ['admin', 'accountant'].includes(user?.role);
  const canCreate = ['admin', 'accountant'].includes(user?.role);
  const paymentMethods = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

  useEffect(() => {
    if (!canCreate) return undefined;
    let active = true;
    placeholderService.billingOptions()
      .then((result) => { if (active) { setBillingOptions(result.data || { clients: [], cases: [] }); setOptionsError(''); } })
      .catch((error) => { if (active) setOptionsError(error.response?.data?.message || error.message || 'Unable to load invoice options.'); });
    return () => { active = false; };
  }, [canCreate]);

  const recordPayment = async (invoice, submittedMethod = '') => {
    const id = invoice._id || invoice.id;
    setBusy((current) => ({ ...current, [id]: true }));
    try {
      await placeholderService.recordPayment(id, {
        method: methods[id] || submittedMethod || 'Bank Transfer',
        transactionReference: references[id] || '',
        paidAt: paymentDates[id] || undefined
      });
      pushToast('Payment confirmed and receipt generated.');
      await Promise.all([invoices.reload(), receipts.reload(), payments.reload()]);
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    } finally {
      setBusy((current) => ({ ...current, [id]: false }));
    }
  };
  const rejectPayment = async (invoice, payment) => {
    const invoiceId = invoice._id || invoice.id;
    const paymentId = payment._id || payment.id;
    setBusy((current) => ({ ...current, [invoiceId]: true }));
    try {
      await placeholderService.rejectPayment(invoiceId, paymentId);
      pushToast('Payment details rejected. The client can submit updated details.');
      await payments.reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    } finally {
      setBusy((current) => ({ ...current, [invoiceId]: false }));
    }
  };
  const submitPayment = async (invoice) => {
    const id = invoice._id || invoice.id;
    setBusy((current) => ({ ...current, [id]: true }));
    try {
      await placeholderService.submitPayment(id, {
        method: methods[id] || 'UPI',
        reference: references[id] || '',
        paidAt: paymentDates[id] || undefined
      });
      pushToast('Payment details submitted for confirmation.');
      await payments.reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    } finally {
      setBusy((current) => ({ ...current, [id]: false }));
    }
  };
  const cancelInvoice = async (invoice) => {
    const id = invoice._id || invoice.id;
    setBusy((current) => ({ ...current, [id]: true }));
    try {
      await placeholderService.cancelInvoice(id);
      pushToast('Invoice cancelled.');
      await invoices.reload();
    } catch (requestError) {
      pushToast(requestError.response?.data?.message || requestError.message, 'error');
    } finally {
      setBusy((current) => ({ ...current, [id]: false }));
    }
  };
  const completedCases = billingOptions.cases.filter((item) => !form.clientId || item.clientId === form.clientId);
  const createInvoice = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      await placeholderService.createResource('invoices', {
        ...form,
        amount: Number(form.amount),
        number: form.number.trim() || `PL-${Date.now()}`
      });
      pushToast('Invoice created and linked to the completed case.');
      setCreateOpen(false);
      setForm({
        clientId: '', caseId: '', number: '', amount: '',
        invoiceDate: new Date().toISOString().slice(0, 10), dueAt: '', description: '', notes: ''
      });
      await Promise.all([
        invoices.reload(),
        placeholderService.billingOptions().then((result) => setBillingOptions(result.data || { clients: [], cases: [] }))
      ]);
    } catch (error) {
      pushToast(error.response?.data?.message || error.message || 'Unable to create invoice.', 'error');
    } finally {
      setCreating(false);
    }
  };
  const printReceipt = () => {
    document.body.classList.add('printing-receipt');
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-receipt'), { once: true });
    window.print();
  };

  return <div className="workflow-page">
    <PageHeader eyebrow="Finance" title="Billing & receipts" description={user?.role === 'client'
      ? 'View your invoices, submit payment details, and access confirmed receipts.'
      : 'Create invoices for completed matters and confirm received settlements to issue receipts.'}
    actions={canCreate && <Button icon="plus" onClick={() => setCreateOpen(true)}>Create invoice</Button>} />
    {optionsError && canCreate && <p role="alert">{optionsError}</p>}
    <WorkflowState loading={invoices.loading} error={invoices.error}>
      <TableCard><div className="workflow-case-list">
        {invoices.rows.map((invoice) => {
          const id = invoice._id || invoice.id;
          const clientName = typeof invoice.clientId === 'object' ? invoice.clientId?.name : invoice.client;
          const caseTitle = typeof invoice.caseId === 'object' ? invoice.caseId?.title : '';
          const payment = payments.rows.find((item) => String(item.invoiceId?._id || item.invoiceId) === String(id));
          const overdue = String(invoice.status).toLowerCase() === 'overdue';
          return <article className="workflow-record" key={id}>
            <div className="workflow-record-heading"><div><h3>{invoice.number || 'Invoice'}</h3><p>{clientName || 'Client'}{caseTitle ? ` · ${caseTitle}` : ''} · Amount: ₹{Number(invoice.amount || 0).toLocaleString('en-IN')} · Due {invoice.due || (invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : '—')}</p></div><StatusBadge tone={overdue ? 'danger' : undefined}>{invoice.status || 'Pending'}</StatusBadge></div>
            {invoice.description && <p>{invoice.description}</p>}
            {user?.role === 'client' && String(invoice.status).toLowerCase() !== 'paid' && String(invoice.status).toLowerCase() !== 'cancelled' &&
              (payment?.status === 'Pending' ? <p className="people-subtext" role="status">Payment submitted · awaiting confirmation</p> : <>
                {payment?.status === 'Failed' && <p className="people-subtext" role="status">The previous payment details were not confirmed. You can submit updated details.</p>}
                <div className="workflow-inline-form">
                <label>Payment method<select value={methods[id] || 'UPI'} onChange={(event) => setMethods({ ...methods, [id]: event.target.value })}>
                  {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                </select></label>
                <label>Payment date<input type="date" value={paymentDates[id] || ''} onChange={(event) => setPaymentDates({ ...paymentDates, [id]: event.target.value })} /></label>
                <label>Reference number<input value={references[id] || ''} onChange={(event) => setReferences({ ...references, [id]: event.target.value })} placeholder="Optional transaction reference" /></label>
                <Button disabled={Boolean(busy[id])} onClick={() => submitPayment(invoice)}>{busy[id] ? 'Submitting…' : 'Submit payment details'}</Button>
                </div>
              </>)}
            {canRecord && String(invoice.status).toLowerCase() !== 'paid' && String(invoice.status).toLowerCase() !== 'cancelled' && <div className="workflow-inline-form">
              <label>Payment method<select value={methods[id] || payment?.method || 'Bank Transfer'} onChange={(event) => setMethods({ ...methods, [id]: event.target.value })}>
                {paymentMethods.map((method) => <option key={method}>{method}</option>)}
              </select></label>
              <label>Payment date<input type="date" value={paymentDates[id] || ''} onChange={(event) => setPaymentDates({ ...paymentDates, [id]: event.target.value })} /></label>
              <label>Transaction reference<input value={references[id] ?? payment?.transactionReference ?? payment?.reference ?? ''} onChange={(event) => setReferences({ ...references, [id]: event.target.value })} placeholder="Optional reference" /></label>
              <Button disabled={Boolean(busy[id])} onClick={() => recordPayment(invoice, payment?.method)}>{busy[id] ? 'Saving…' : payment?.status === 'Pending' ? 'Confirm payment & issue receipt' : 'Record received payment'}</Button>
              {payment?.status === 'Pending' && <Button variant="ghost" disabled={Boolean(busy[id])} onClick={() => rejectPayment(invoice, payment)}>Reject submission</Button>}
            </div>}
            {canCreate && !['Paid', 'Cancelled'].includes(invoice.status) && <div className="workflow-actions">
              <Button variant="ghost" disabled={Boolean(busy[id])} onClick={() => cancelInvoice(invoice)}>Cancel invoice</Button>
            </div>}
          </article>;
        })}
        {!invoices.rows.length && <EmptyState icon="file" title="No invoices yet" description="Invoices become available after a case reaches completed status." />}
      </div></TableCard>
      <WorkflowPagination page={invoices.page} pages={invoices.pages} onChange={invoices.setPage} />
    </WorkflowState>
    <section className="workflow-receipts"><h2>Payment history</h2>
      <WorkflowState loading={payments.loading} error={payments.error}>
        {!payments.rows.length ? <p>No payment records have been submitted.</p> : <TableCard><table className="data-table"><thead><tr><th>Invoice</th><th>Client</th><th>Case</th><th>Amount</th><th>Method</th><th>Date</th><th>Status</th></tr></thead><tbody>
          {payments.rows.map((payment) => <tr key={payment._id || payment.id}>
            <td>{payment.invoiceId?.number || '—'}</td><td>{payment.clientId?.name || '—'}</td><td>{payment.caseId?.title || '—'}</td>
            <td>₹{Number(payment.amount || 0).toLocaleString('en-IN')}</td><td>{payment.method}</td>
            <td>{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '—'}</td><td><StatusBadge>{payment.status || 'Pending'}</StatusBadge></td>
          </tr>)}
        </tbody></table></TableCard>}
        <WorkflowPagination page={payments.page} pages={payments.pages} onChange={payments.setPage} />
      </WorkflowState>
    </section>
    <section className="workflow-receipts"><h2>Receipts</h2>
      <WorkflowState loading={receipts.loading} error={receipts.error}>
        {!receipts.rows.length ? <p>No receipts have been issued.</p> : <><TableCard><table className="data-table"><thead><tr><th>Receipt</th><th>Amount</th><th>Issued</th><th>Details</th></tr></thead><tbody>
          {receipts.rows.map((receipt) => <tr key={receipt._id || receipt.id}><td>{receipt.number}</td><td>{Number(receipt.amount || 0).toLocaleString()}</td><td>{receipt.paidAt || receipt.issuedAt ? new Date(receipt.paidAt || receipt.issuedAt).toLocaleDateString() : '—'}</td><td><Button variant="ghost" onClick={() => setReceiptToView(receipt)}>View / print</Button></td></tr>)}
        </tbody></table></TableCard><WorkflowPagination page={receipts.page} pages={receipts.pages} onChange={receipts.setPage} /></>}
      </WorkflowState>
    </section>
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create invoice" description="Invoices can be created only for a completed case without an existing invoice.">
      <form className="modal-form" onSubmit={createInvoice}>
        <FormField label="Invoice number" name="invoice-number" value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} required />
        <div className="form-field"><label htmlFor="invoice-client">Client</label><select id="invoice-client" required value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value, caseId: '' })}><option value="">Select client</option>{billingOptions.clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.email}</option>)}</select></div>
        <div className="form-field"><label htmlFor="invoice-case">Completed case</label><select id="invoice-case" required value={form.caseId} onChange={(event) => { const item = completedCases.find((candidate) => candidate.id === event.target.value); setForm({ ...form, caseId: event.target.value, number: item?.invoiceNumber || form.number, amount: item?.invoiceAmount ?? item?.fee ?? form.amount, invoiceDate: item?.invoiceDate ? new Date(item.invoiceDate).toISOString().slice(0, 10) : form.invoiceDate, dueAt: item?.dueAt ? new Date(item.dueAt).toISOString().slice(0, 10) : form.dueAt, description: item?.description || form.description }); }}><option value="">Select completed case</option>{completedCases.map((item) => <option key={item.id} value={item.id}>{item.title} · ₹{item.invoiceAmount ?? item.fee ?? 0}</option>)}</select></div>
        <FormField label="Amount" name="invoice-amount" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
        <FormField label="Invoice date" name="invoice-date" type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} required />
        <FormField label="Due date" name="invoice-due" type="date" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} required />
        <FormField label="Description" name="invoice-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
        <FormField label="Notes" name="invoice-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        {!completedCases.length && form.clientId && <p className="people-subtext">No uninvoiced completed cases are available for this client.</p>}
        <div className="modal-actions"><Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button><LoadingButton type="submit" loading={creating} disabled={!completedCases.length}>Create invoice</LoadingButton></div>
      </form>
    </Modal>
    <Modal open={Boolean(receiptToView)} onClose={() => setReceiptToView(null)} title="Payment receipt" description="Generated automatically when the invoice payment was recorded.">
      {receiptToView && <div className="receipt-print-view">
        <div className="receipt-brand">Peter Lawrence <small>LEGAL ERP & CRM</small></div>
        <h2>Payment receipt</h2>
        <dl className="receipt-detail-list">
          <div><dt>Receipt number</dt><dd>{receiptToView.number || '—'}</dd></div>
          <div><dt>Invoice</dt><dd>{receiptToView.invoiceId?.number || '—'}</dd></div>
          <div><dt>Client</dt><dd>{receiptToView.clientId?.name || '—'}</dd></div>
          <div><dt>Case</dt><dd>{receiptToView.caseId?.title || receiptToView.invoiceId?.caseId?.title || '—'}</dd></div>
          <div><dt>Amount received</dt><dd>{Number(receiptToView.amount || 0).toLocaleString()}</dd></div>
          <div><dt>Payment method</dt><dd>{receiptToView.method || receiptToView.paymentId?.method || '—'}</dd></div>
          <div><dt>Transaction reference</dt><dd>{receiptToView.paymentId?.transactionReference || receiptToView.paymentId?.reference || '—'}</dd></div>
          <div><dt>Payment date</dt><dd>{receiptToView.paidAt || receiptToView.paymentId?.paidAt ? new Date(receiptToView.paidAt || receiptToView.paymentId?.paidAt).toLocaleDateString() : '—'}</dd></div>
          <div><dt>Payment status</dt><dd>{receiptToView.status || 'Paid'}</dd></div>
        </dl>
        <div className="modal-actions no-print"><Button variant="ghost" onClick={() => setReceiptToView(null)}>Close</Button><Button icon="file" onClick={printReceipt}>Print receipt</Button></div>
      </div>}
    </Modal>
  </div>;
}
