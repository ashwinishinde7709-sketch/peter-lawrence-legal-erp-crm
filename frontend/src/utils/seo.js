const siteName = 'Peter Lawrence Legal ERP & CRM';

export function setPageMeta(title, description) {
  document.title = `${title} | ${siteName}`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', description);
}
