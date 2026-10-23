import { useEffect, useState } from 'react';
import { Button, Icon, Skeleton } from '../components/UI';
import { placeholderService } from '../services/placeholderService';

export function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    placeholderService.dashboard('admin')
      .then((result) => { if (active) setData(result); })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to load the admin overview.');
      });
    return () => { active = false; };
  }, [retry]);

  if (error) {
    return <div className="dashboard-page admin-overview" role="alert">
      <header className="admin-overview-heading"><div className="eyebrow">Operations command center</div><h1>Admin overview</h1></header>
      <p>{error}</p><Button onClick={() => setRetry((attempt) => attempt + 1)}>Retry</Button>
    </div>;
  }

  if (!data) {
    return <div className="dashboard-page admin-overview" aria-busy="true">
      <div className="dashboard-greeting"><Skeleton lines={3} /></div>
      <div className="admin-metric-grid">{Array.from({ length: 10 }, (_, index) =>
        <div className="admin-metric-card" key={index}><Skeleton lines={3} /></div>
      )}</div>
    </div>;
  }

  return <div className="dashboard-page admin-overview">
    <header className="admin-overview-heading">
      <div className="eyebrow">Operations command center</div>
      <h1>Admin overview</h1>
      <p>Current workload and items awaiting action.</p>
    </header>
    <section className="admin-metric-grid" aria-label="Firm overview">
      {data.stats.map(([label, value, , , icon], index) => (
        <article className={`admin-metric-card admin-metric-${index % 3}`} key={label}>
          <span className="admin-metric-icon"><Icon name={icon} size={20} /></span>
          <span className="admin-metric-label">{label}</span>
          <strong className="admin-metric-value">{value}</strong>
        </article>
      ))}
    </section>
  </div>;
}
