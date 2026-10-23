import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FiArrowRight, FiBarChart2, FiBell, FiBookOpen, FiBriefcase, FiCalendar, FiCheck, FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronRight, FiClock, FiCreditCard, FiDownload, FiEdit3, FiExternalLink, FiFileText, FiFolder, FiGrid, FiLogOut, FiMenu, FiMoreHorizontal, FiPlus, FiSearch, FiSettings, FiShield, FiSliders, FiUploadCloud, FiUser, FiUserPlus, FiUsers, FiX } from 'react-icons/fi';
import brandMark from '../assets/brand-mark.svg';
import { useAuth, useToast } from '../context/AppContext';
import { navByRole, roles } from '../utils/data';
import { getStatusTone, rolePath } from '../utils/helpers';

const iconMap = { grid: FiGrid, users: FiUsers, briefcase: FiBriefcase, scale: FiBookOpen, folder: FiFolder, calendar: FiCalendar, file: FiFileText, wallet: FiCreditCard, userPlus: FiUserPlus, card: FiCreditCard, chart: FiBarChart2, settings: FiSettings, user: FiUser, clock: FiClock, receipt: FiFileText, check: FiCheckCircle, shield: FiShield, plus: FiPlus, arrow: FiArrowRight, download: FiDownload, edit: FiEdit3, upload: FiUploadCloud };

export function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  const Component = iconMap[name] || FiGrid;
  return <Component size={size} strokeWidth={strokeWidth} />;
}

export function Logo({ compact = false, light = false }) {
  return <Link to="/" className={`brand-lockup ${light ? 'brand-light' : ''}`}><img src={brandMark} alt="Peter Lawrence mark" /><span><strong>Peter Lawrence</strong>{!compact && <small>LEGAL ERP & CRM</small>}</span></Link>;
}

export function Button({ children, variant = 'primary', icon, to, type = 'button', className = '', onClick, disabled = false }) {
  const classes = `btn btn-${variant} d-inline-flex align-items-center justify-content-center gap-2 ${className}`;
  const content = <>{icon && <Icon name={icon} size={16} />}{children}</>;
  if (to) return <Link to={to} className={classes}>{content}</Link>;
  return <button type={type} className={classes} onClick={onClick} disabled={disabled}>{content}</button>;
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const links = [['About', '/about'], ['Services', '/#services'], ['Practice areas', '/#practice'], ['Careers', '/careers']];
  return <header className="public-header"><div className="container-xl header-inner"><Logo /><button className="mobile-menu-btn" onClick={() => setOpen(!open)} aria-label="Toggle navigation"><FiMenu size={22} /></button><nav className={`public-nav ${open ? 'is-open' : ''}`}>{links.map(([label, href]) => href.startsWith('/#') ? <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a> : <NavLink key={href} to={href} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}<span className="nav-divider" /><Button to="/contact" variant="outline-gold" className="nav-cta">Talk to us <FiArrowRight size={15} /></Button><Button to="/login" variant="dark" className="nav-login">Sign in</Button></nav></div></header>;
}

export function PublicFooter() {
  return <footer className="public-footer"><div className="container-xl"><div className="footer-grid"><div className="footer-brand"><Logo light /><p>Legal operations with clarity, confidence, and care.</p><div className="footer-socials"><span>in</span><span>𝕏</span><span>◎</span></div></div><div><div className="footer-label">Explore</div><Link to="/about">About the firm</Link><Link to="/#services">Services</Link><Link to="/careers">Careers</Link></div><div><div className="footer-label">Resources</div><Link to="/contact">Contact us</Link><Link to="/login">Client portal</Link><a href="mailto:hello@peterlawrence.legal">Email the team</a></div><div className="footer-contact"><div className="footer-label">New York · London · Singapore</div><p>hello@peterlawrence.legal<br />+1 212 555 0198</p><Link to="/contact" className="footer-arrow">Start a conversation <FiArrowRight size={15} /></Link></div></div><div className="footer-bottom"><span>© 2024 Peter Lawrence LLP. All rights reserved.</span><span>Privacy · Terms · Accessibility</span></div></div></footer>;
}

export function PublicLayout({ children }) { return <div className="public-layout"><PublicHeader />{children}<PublicFooter /></div>; }

export function Avatar({ initials = 'PL', color = 'gold', size = 'md' }) { return <span className={`avatar avatar-${color} avatar-${size}`}>{initials}</span>; }

export function StatusBadge({ children, tone }) { return <span className={`status-badge status-${tone || getStatusTone(children)}`}><span className="status-dot" />{children}</span>; }

export function PageHeader({ eyebrow, title, description, actions, back }) {
  return <div className="page-heading"><div>{back && <Link to={back} className="back-link"><FiChevronLeft size={15} /> Back</Link>}<div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function SectionHeading({ eyebrow, title, description, align = 'left', action }) { return <div className={`section-heading text-${align}`}><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{description && <p>{description}</p>}{action}</div>; }

export function StatCard({ label, value, trend, trendType = 'up', icon, accent = 'gold', meta }) { return <div className={`stat-card stat-${accent}`}><div className="stat-card-top"><span className="stat-icon"><Icon name={icon} size={18} /></span><button className="more-btn" aria-label="More options"><FiMoreHorizontal size={18} /></button></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className={`stat-trend trend-${trendType}`}>{trendType === 'up' && <span>↗</span>}{trendType === 'down' && <span>↘</span>}{trendType === 'warning' && <span>!</span>} {trend}{meta && <span className="trend-meta"> · {meta}</span>}</div></div>; }

export function ChartCard({ title, subtitle, children, action }) { return <div className="surface-card chart-card"><div className="card-heading"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action || <button className="more-btn" aria-label={`${title} options`}><FiMoreHorizontal size={18} /></button>}</div>{children}</div>; }

export function EmptyState({ icon = 'folder', title = 'Nothing here yet', description = 'When new items arrive, they will show up here.', action }) { return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={22} /></span><h3>{title}</h3><p>{description}</p>{action}</div>; }

export function Skeleton({ lines = 3 }) { return <div className="skeleton-stack">{Array.from({ length: lines }).map((_, index) => <span key={index} className={`skeleton-line skeleton-${index % 3}`} />)}</div>; }

export function SearchBar({ value, onChange, placeholder = 'Search...' }) { return <label className="search-bar"><FiSearch size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>; }

export function FilterSelect({ value, onChange, options }) { return <label className="filter-select"><FiSliders size={15} /><select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Filter"><option value="All">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><FiChevronDown size={14} /></label>; }

export function Pagination({ page, pageCount, onChange }) { return <div className="pagination-row"><span>Page <strong>{page}</strong> of <strong>{pageCount}</strong></span><div className="pagination-buttons"><button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><FiChevronLeft size={16} /></button><button disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Next page"><FiChevronRight size={16} /></button></div></div>; }

export function TableCard({ children, toolbar, footer, className = '' }) { return <div className={`surface-card table-card ${className}`}>{toolbar && <div className="table-toolbar">{toolbar}</div>}<div className="table-responsive">{children}</div>{footer && <div className="table-footer">{footer}</div>}</div>; }

export function Modal({ open, onClose, title, description, children, size = '' }) {
  if (!open) return null;
  return <div className="modal-backdrop-custom" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className={`modal-card ${size}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button onClick={onClose} className="modal-close" aria-label="Close modal"><FiX size={18} /></button></div>{children}</div></div>;
}

export function FormField({ label, name, type = 'text', value, onChange, placeholder, required = false, error, children }) { return <div className="form-field"><label htmlFor={name}>{label}{required && <span className="required">*</span>}</label>{children || <input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} />}{error && <small className="field-error">{error}</small>}</div>; }

export function LoadingButton({ children, loading, ...props }) { return <Button {...props} disabled={loading || props.disabled}>{loading ? <><span className="spinner-border spinner-border-sm" /> Saving…</> : children}</Button>; }

export function DashboardGreeting({ role, data }) { const roleInfo = roles[role]; return <div className="dashboard-greeting"><div><div className="eyebrow">{roleInfo.eyebrow}</div><h1>{data.greeting}</h1><p>{data.summary}</p></div><div className="greeting-actions"><button className="icon-button notification-button" aria-label="Notifications"><FiBell size={18} /><span /></button><Button variant="primary" icon="plus">Create new</Button></div></div>; }

export function ToastlessNotice({ title, meta, tone = 'info' }) { return <div className={`notice notice-${tone}`}><span className="notice-icon"><Icon name={tone === 'warning' || tone === 'danger' ? 'calendar' : tone === 'success' ? 'check' : 'file'} size={17} /></span><div><strong>{title}</strong><span>{meta}</span></div><button aria-label="Open notice"><FiExternalLink size={15} /></button></div>; }

export function SidebarBrand({ role }) { return <div className="sidebar-brand"><Logo compact light /><span className="sidebar-role">{roles[role].label} workspace</span></div>; }

export function UserMenu({ role }) { const { user, logout } = useAuth(); const info = roles[role]; const [open, setOpen] = useState(false); return <div className="user-menu-wrap"><button className="user-menu" onClick={() => setOpen(!open)}><Avatar initials={info.initials} color={info.accent} size="sm" /><span><strong>{user?.name || info.label}</strong><small>{info.label}</small></span><FiChevronDown size={15} /></button>{open && <div className="user-menu-popover"><button onClick={() => setOpen(false)}><FiUser size={15} /> My profile</button><button onClick={() => setOpen(false)}><FiSettings size={15} /> Preferences</button><button onClick={logout} className="danger-action"><FiLogOut size={15} /> Sign out</button></div>}</div>; }

export function AppSidebar({ role, open, onClose }) { const current = useLocation(); const items = (roles[role] && role) ? (navByRole[role] || navByRole.admin) : []; return <aside className={`app-sidebar ${open ? 'is-open' : ''}`}><div className="sidebar-top"><SidebarBrand role={role} /><button className="sidebar-close" onClick={onClose}><FiX size={18} /></button></div><div className="sidebar-rule" /><nav className="sidebar-nav">{items.map(([label, path, icon]) => <NavLink key={label} to={rolePath(role, path)} end={!path} className={({ isActive }) => `sidebar-link ${isActive || (path && current.pathname.endsWith(`/${path}`)) ? 'active' : ''}`} onClick={onClose}><Icon name={icon} size={18} /><span>{label}</span>{label === 'Reports' && <span className="nav-pill">New</span>}</NavLink>)}</nav><div className="sidebar-bottom"><div className="sidebar-help"><span className="help-icon"><FiShield size={17} /></span><div><strong>Need a hand?</strong><small>Visit the support centre</small></div><FiArrowRight size={15} /></div><div className="sidebar-version">Peter Lawrence OS <span>v1.0</span></div></div></aside>; }


export function AppTopbar({ role, onMenu }) { return <header className="app-topbar"><button className="mobile-menu-btn topbar-menu" onClick={onMenu} aria-label="Open sidebar"><FiMenu size={21} /></button><div className="topbar-search"><FiSearch size={17} /><input placeholder="Search clients, cases, documents…" /><span className="search-shortcut">⌘ K</span></div><div className="topbar-actions"><button className="icon-button" aria-label="Help"><FiShield size={17} /></button><button className="icon-button notification-button" aria-label="Notifications"><FiBell size={18} /><span /></button><div className="topbar-divider" /><UserMenu role={role} /></div></header>; }
