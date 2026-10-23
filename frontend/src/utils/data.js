export const roles = {
  admin: { label: 'Admin', eyebrow: 'Operations command center', initials: 'AD', accent: 'gold', description: 'Full visibility across the firm' },
  client: { label: 'Client', eyebrow: 'Client portal', initials: 'CL', accent: 'blue', description: 'Your matters, documents, and next steps' },
  lawyer: { label: 'Lawyer', eyebrow: 'Practice workspace', initials: 'LW', accent: 'teal', description: 'Your caseload, hearings, and priorities' },
  accountant: { label: 'Accountant', eyebrow: 'Finance workspace', initials: 'AC', accent: 'orange', description: 'Revenue, billing, and firm performance' },
  reception: { label: 'Reception', eyebrow: 'Client services', initials: 'RE', accent: 'violet', description: 'Client registration and appointment booking' },
  hr: { label: 'HR', eyebrow: 'People operations', initials: 'HR', accent: 'violet', description: 'Talent, attendance, and employee care' },
  employee: { label: 'Employee', eyebrow: 'Employee hub', initials: 'EM', accent: 'green', description: 'Your daily work, leave, and attendance' }
};

export const navByRole = {
  admin: [['Dashboard', '', 'grid'], ['Users', 'users', 'users'], ['Clients', 'clients', 'briefcase'], ['Lawyers', 'lawyers', 'scale'], ['Cases', 'cases', 'folder'], ['Appointments', 'appointments', 'calendar'], ['Documents', 'documents', 'file'], ['Billing', 'billing', 'wallet'], ['Recruitment', 'recruitment', 'userPlus'], ['Payroll', 'payroll', 'card'], ['Reports', 'reports', 'chart'], ['Settings', 'settings', 'settings']],
  client: [['Dashboard', '', 'grid'], ['Cases', 'cases', 'folder'], ['Documents', 'documents', 'file'], ['Appointments', 'appointments', 'calendar'], ['Messages', 'messages', 'mail'], ['Invoices & receipts', 'billing', 'wallet'], ['Profile', 'profile', 'user']],
  lawyer: [['Dashboard', '', 'grid'], ['Clients', 'clients', 'briefcase'], ['Cases', 'cases', 'folder'], ['Appointments', 'appointments', 'calendar'], ['Documents', 'documents', 'file'], ['Messages', 'messages', 'mail'], ['Hearings', 'hearings', 'calendar'], ['Tasks', 'tasks', 'check']],
  accountant: [['Dashboard', '', 'grid'], ['Billing & receipts', 'billing', 'wallet'], ['Payroll', 'payroll', 'card'], ['Expenses', 'expenses', 'receipt'], ['Reports', 'reports', 'chart']],
  reception: [['Dashboard', '', 'grid'], ['Clients', 'clients', 'briefcase'], ['Appointments', 'appointments', 'calendar']],
  hr: [['Dashboard', '', 'grid'], ['Recruitment', 'recruitment', 'userPlus'], ['Employees', 'employees', 'users'], ['Attendance', 'attendance', 'clock'], ['Leave Requests', 'leave', 'calendar'], ['Payroll', 'payroll', 'card']],
  employee: [['Dashboard', '', 'grid'], ['Attendance', 'attendance', 'clock'], ['Leave', 'leave', 'calendar'], ['Payroll', 'payroll', 'card'], ['Profile', 'profile', 'user']]
};
