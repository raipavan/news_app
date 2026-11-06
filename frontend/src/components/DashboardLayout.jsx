import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { roleLabel } from '../lib/format';

function titleFor(pathname) {
  if (pathname === '/dashboard') return ['Overview', 'Newsroom'];
  if (pathname === '/dashboard/articles') return ['Articles', 'Newsroom'];
  if (pathname === '/dashboard/articles/new') return ['New article', 'Newsroom'];
  if (/^\/dashboard\/articles\/[^/]+$/.test(pathname)) return ['Article editor', 'Newsroom'];
  if (pathname === '/dashboard/review') return ['Review queue', 'Editorial desk'];
  if (/^\/dashboard\/review\/[^/]+$/.test(pathname)) return ['Review article', 'Editorial desk'];
  if (pathname === '/dashboard/bookmarks') return ['Bookmarks', 'Reading list'];
  if (pathname === '/dashboard/admin') return ['Admin dashboard', 'Administration'];
  if (pathname === '/dashboard/admin/users') return ['Users & roles', 'Administration'];
  if (pathname === '/dashboard/admin/taxonomy') return ['Sections & districts', 'Administration'];
  if (pathname === '/dashboard/admin/ads') return ['Advertisements', 'Revenue'];
  if (pathname === '/dashboard/admin/moderation') return ['Moderation', 'Editorial desk'];
  if (pathname === '/dashboard/admin/analytics') return ['Analytics', 'Administration'];
  if (pathname === '/dashboard/admin/audit') return ['Audit log', 'Administration'];
  return ['Newsroom', 'Thaja Suddi'];
}

export default function DashboardLayout() {
  const { user, logout, hasPermission, isStaff, hasRole } = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [title, subtitle] = titleFor(location.pathname);

  const canWrite = hasPermission('article.create');
  const admin = hasRole('super_admin');
  const editor = isStaff;
  const initials = (user?.name || 'TS')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const signOut = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="dash-shell">
      <aside className="dash-side">
        <Link to="/dashboard" className="brand" aria-label="Thaja Suddi newsroom">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>
            <span className="brand-name">Thaja <span>Suddi</span></span>
            <span className="brand-kn">ತಾಜಾ ಸುದ್ದಿ</span>
          </span>
        </Link>

        <nav className="dash-nav" aria-label="Newsroom">
          <span className="nav-label">Workspace</span>
          <NavLink to="/dashboard" end>Overview</NavLink>
          {canWrite ? <NavLink to="/dashboard/articles" end>My articles</NavLink> : null}
          {canWrite ? <NavLink to="/dashboard/articles/new" end>New article</NavLink> : null}
          {editor ? <NavLink to="/dashboard/review">Review queue</NavLink> : null}
          <NavLink to="/dashboard/bookmarks">Bookmarks</NavLink>

          {editor ? (
            <>
              <span className="nav-label">Editorial</span>
              <NavLink to="/dashboard/admin/moderation">Moderation</NavLink>
              <NavLink to="/dashboard/admin/analytics">Analytics</NavLink>
            </>
          ) : null}

          {admin ? (
            <>
              <span className="nav-label">System</span>
              <NavLink to="/dashboard/admin" end>Admin overview</NavLink>
              <NavLink to="/dashboard/admin/users">Users &amp; roles</NavLink>
              <NavLink to="/dashboard/admin/taxonomy">Sections &amp; districts</NavLink>
              <NavLink to="/dashboard/admin/ads">Advertisements</NavLink>
              <NavLink to="/dashboard/admin/audit">Audit log</NavLink>
            </>
          ) : null}
        </nav>

        <div className="dash-side-foot">
          <Link to="/">← {t('home')}</Link>
          <p style={{ marginTop: 8 }}>Kannada &amp; English edition</p>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <div>
            <h1>{title}</h1>
            <span className="topbar-sub">{subtitle}</span>
          </div>
          <div className="dash-topbar-right">
            <Link className="btn btn-ghost btn-sm" to="/">View site</Link>
            <div className="user-chip">
              <span className="avatar">{initials}</span>
              <span>
                <strong style={{ display: 'block', fontSize: 12 }}>{user?.name}</strong>
                <span className="text-sm text-muted">
                  {(user?.roles || []).map(roleLabel).join(' · ')}
                </span>
              </span>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        <div className="dash-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
