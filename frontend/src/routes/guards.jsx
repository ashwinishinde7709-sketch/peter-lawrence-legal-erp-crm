import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AppContext';
import { navByRole } from '../utils/data';
import { rolePath } from '../utils/helpers';

export function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RoleGuard() {
  const { user } = useAuth();
  const { role } = useParams();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (role !== user.role) return <Navigate to={rolePath(user.role)} replace />;
  const allowed = (navByRole[role] || []).some(([, path]) => path ? location.pathname === rolePath(role, path) : location.pathname === rolePath(role));
  if (!allowed) return <Navigate to={rolePath(user.role)} replace />;
  return <Outlet />;
}
