export const titleCase = (value = '') => value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const initials = (value = '') => value.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

export const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value);

export const getStatusTone = (status = '') => {
  const normalized = status.toLowerCase();
  if (['active', 'paid', 'processed', 'present', 'available', 'won', 'offer', 'success'].some((word) => normalized.includes(word))) return 'success';
  if (['pending', 'onboarding', 'screening', 'outstanding', 'remote', 'interview'].some((word) => normalized.includes(word))) return 'warning';
  if (['overdue', 'high', 'on hold', 'on leave', 'inactive'].some((word) => normalized.includes(word))) return 'danger';
  return 'neutral';
};

export const rolePath = (role, path = '') => `/app/${role}${path ? `/${path}` : ''}`;
