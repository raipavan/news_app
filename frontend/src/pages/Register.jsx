import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useApi';

export default function Register() {
  const { t } = useLocale();
  const { user, register, loading: booting } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useDocumentTitle(t('createAccount'));

  if (!booting && user) return <Navigate to="/dashboard" replace />;

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.email.trim() && !form.phone.trim()) {
      setError('Provide an email address or phone number.');
      return;
    }
    setBusy(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      notify('Your reader account is ready.', 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="kicker">{t('communityDesk')}</span>
        <h1>{t('registerTitle')}</h1>
        <p className="sub">{t('registerSub')}</p>

        {error ? <div className="notice error">{error}</div> : null}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">{t('name')}</label>
            <input id="name" name="name" className="input" value={form.name} onChange={change} required minLength={2} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="email">{t('email')}</label>
            <input id="email" name="email" type="email" className="input" value={form.email} onChange={change} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="phone">{t('phone')}</label>
            <input id="phone" name="phone" className="input" value={form.phone} onChange={change} autoComplete="tel" />
            <span className="hint">Email or phone is required. We will never publish your contact details.</span>
          </div>
          <div className="field">
            <label htmlFor="password">{t('password')}</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              value={form.password}
              onChange={change}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <span className="hint">At least 8 characters.</span>
          </div>
          <button className="btn btn-block" type="submit" disabled={busy}>
            {busy ? 'Creating account…' : t('createAccount')}
          </button>
        </form>

        <div className="notice info mt-2">{t('registerNote')}</div>

        <p className="switch">
          {t('haveAccount')} <Link to="/login">{t('signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
