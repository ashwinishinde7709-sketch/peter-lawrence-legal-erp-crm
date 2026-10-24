const API = 'https://peter-lawrence-legal-erp-crm.onrender.com/api';
const getToken = () => localStorage.getItem('pl-token');
const pendingGets = new Map();

async function request(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const method = String(options.method || 'GET').toUpperCase();
  const requestKey = `${token || 'anonymous'}:${path}`;
  if (method === 'GET' && pendingGets.has(requestKey)) return pendingGets.get(requestKey);

  const pending = (async () => {
    const response = await fetch(`${API}${path}`, { ...options, headers });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // Some successful endpoints may not return a JSON body.
    }
    if (!response.ok) {
      const error = new Error(payload.message || 'Request failed');
      error.response = { status: response.status, data: payload };
      throw error;
    }
    return payload;
  })();

  if (method === 'GET') {
    pendingGets.set(requestKey, pending);
    pending.finally(() => {
      if (pendingGets.get(requestKey) === pending) pendingGets.delete(requestKey);
    }).catch(() => {});
  }
  return pending;
}

const unwrap = (payload) => payload?.data ?? payload;
const queryString = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const placeholderService = {
  dashboard: async (role) => request(`/dashboard/${role}`),
  reports: async () => request('/reports'),
  list: async (resource, filters) => unwrap(await request(`/${resource}${queryString(filters)}`)),
  listPage: async (resource, filters) => request(`/${resource}${queryString(filters)}`),
  login: async ({ email, password, role }) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, role }) }),
  registerClient: async (payload) => request('/auth/register-client', { method: 'POST', body: JSON.stringify(payload) }),
  registerCandidate: async (payload) => request('/auth/register-candidate', { method: 'POST', body: payload }),
  createUser: async (payload) => request('/users', { method: 'POST', body: JSON.stringify(payload) }),
  createResource: async (resource, payload) => request(`/${resource}`, { method: 'POST', body: JSON.stringify(payload) }),
  createClient: async (payload) => unwrap(await request('/clients', { method: 'POST', body: JSON.stringify(payload) })),
  upload: async (file, metadata = {}) => {
    const body = new FormData();
    body.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') body.append(key, value);
    });
    return request('/upload', { method: 'POST', body });
  },
  submitForm: async (payload) => request('/public/submit-form', { method: 'POST', body: JSON.stringify(payload) }),
  me: async () => request('/auth/me'),
  updateProfile: async (payload) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(payload) }),
  remove: async (resource, id) => request(`/${resource}/${id}`, { method: 'DELETE' }),
  update: async (resource, id, payload) => request(`/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateAppointment: async (id, payload) => request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  approveConsultation: async (id, payload) => request(`/appointments/${id}/approve-consultation`, { method: 'POST', body: JSON.stringify(payload) }),
  updateCaseProgress: async (id, progress) => request(`/cases/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ progress }) }),
  attendanceDay: async (date) => request(`/attendance/workday?date=${encodeURIComponent(date)}`),
  saveAttendanceDay: async (date, entries) => request('/attendance/workday', { method: 'PUT', body: JSON.stringify({ date, entries }) }),
  reviewLeave: async (id, status, reviewNote = '') => request(`/leave/${id}/review`, { method: 'PATCH', body: JSON.stringify({ status, reviewNote }) }),
  billingOptions: async () => request('/billing/options'),
  recordPayment: async (id, payload) => request(`/invoices/${id}/payments`, { method: 'POST', body: JSON.stringify(payload) }),
  rejectPayment: async (invoiceId, paymentId) => request(`/invoices/${invoiceId}/payments/${paymentId}/reject`, { method: 'PATCH', body: JSON.stringify({}) }),
  submitPayment: async (id, payload) => request(`/invoices/${id}/payment-submissions`, { method: 'POST', body: JSON.stringify(payload) }),
  cancelInvoice: async (id) => request(`/invoices/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({}) }),
  reassignCaseLawyer: async (id, lawyerId) => request(`/cases/${id}/lawyer`, { method: 'PATCH', body: JSON.stringify({ lawyerId }) }),
  settings: async () => request('/settings'),
  updateSettings: async (payload) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  downloadDocument: async (path, filename) => {
    if (!/^\/(?:api\/)?uploads\/[^/]+$/.test(path || '')) throw new Error('Invalid document path');
    const downloadPath = path.startsWith('/api/') ? path : `/api${path}`;
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(downloadPath, { headers });
    if (!response.ok) {
      let message = 'Unable to download document';
      try { message = (await response.json()).message || message; } catch {}
      throw new Error(message);
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'document';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
