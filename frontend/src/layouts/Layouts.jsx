import { useEffect, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { AppSidebar, AppTopbar, PublicFooter, PublicHeader } from '../components/UI';
import { useAuth } from '../context/AppContext';
import { roles } from '../utils/data';
import { setPageMeta } from '../utils/seo';

export function PublicLayout() {
  return <div className="public-layout"><PublicHeader /><main><Outlet /></main><PublicFooter /></div>;
}

export function AppLayout() {
  const { role } = useParams();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setSidebarOpen(false); setPageMeta(`${roles[role]?.label || 'Workspace'} dashboard`, 'Peter Lawrence Legal ERP & CRM System'); }, [location.pathname, role]);
  return <div className="app-layout"><AppSidebar role={role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><div className="app-content"><AppTopbar role={role} onMenu={() => setSidebarOpen(true)} /><main className="app-main"><Outlet context={{ role, user }} /></main></div>{sidebarOpen && <button className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}</div>;
}
