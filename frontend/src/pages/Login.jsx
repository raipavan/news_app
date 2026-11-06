import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useApi';
import { api } from '../lib/api';
import { safeNextPath } from '../lib/nextPath';

export default function Login() {
  const { t } = useLocale();
  const { user, login, devLogin, loading: booting } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devAccounts, setDevAccounts] = useState([]);
  const [devBusy, setDevBusy] = useState('');
  useDocumentTitle(t('signIn'));

  useEffect(() => {
    let alive = true;
    api
      .get('/auth/dev-accounts', { auth: false })
      .then((res) => {
        if (alive && res?.enabled) setDevAccounts(res.accounts || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const quickLogin = async (role) => {
    setError('');
    setDevBusy(role);
    try {
      const nextUser = await devLogin(role);
      notify(`Dev sign-in: ${nextUser.name}`, 'success');
      navigate(safeNextPath(params.get('next')), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setDevBusy('');
    }
  };

  if (!booting && user) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const nextUser = await login(identifier.trim(), password);
      notify(`Signed in as ${nextUser.name}`, 'success');
      navigate(safeNextPath(params.get('next')), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="kicker">{t('newsroom')}</span>
        <h1>{t('signInTitle')}</h1>
        <p className="sub">{t('signInSub')}</p>

        {error ? <div className="notice error">{error}</div> : null}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="identifier">{t('identifier')}</label>
            <input
              id="identifier"
              className="input"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t('password')}</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="form-row" style={{ justifyContent: 'space-between' }}>
            <Link to="/forgot-password" className="link-btn">{t('forgot')}</Link>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : t('signIn')}
            </button>
          </div>
        </form>

        <p className="switch">
          {t('noAccount')} <Link to="/register">{t('createAccount')}</Link>
        </p>

        {devAccounts.length ? (
          <div className="dev-switch">
            <span className="dev-switch-label">Dev only — sign in as</span>
            <div className="dev-switch-row">
              {devAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={Boolean(devBusy)}
                  onClick={() => quickLogin(account.role)}
                >
                  {devBusy === account.role ? 'Signing in…' : account.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
