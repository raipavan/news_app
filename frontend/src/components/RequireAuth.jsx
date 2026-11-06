import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoading } from './ui';

export default function RequireAuth({ children, staff = false, admin = false, permission }) {
  const { user, loading, isStaff, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-boot">
        <div className="spinner" />
        <span>Opening newsroom…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (admin && !hasRole('super_admin')) return <Navigate to="/dashboard" replace />;
  if (staff && !isStaff) return <Navigate to="/dashboard" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/dashboard" replace />;

  return children;
}
