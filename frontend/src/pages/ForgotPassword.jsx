import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useApi';

export default function ForgotPassword() {
  const { t } = useLocale();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useDocumentTitle(t('resetTitle'));

  const requestReset = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() }, { auth: false });
      setMessage(res.message || t('resetSent'));
      if (res.devResetToken) {
        setToken(res.devResetToken);
        setMessage(
          'Development mode: a reset token has been generated below. In production this is delivered by email.'
        );
      }
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token: token.trim(), password }, { auth: false });
      notify('Password updated. Please sign in.', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="kicker">{t('signIn')}</span>
        <h1>{t('resetTitle')}</h1>
        <p className="sub">{step === 1 ? t('resetSub') : message}</p>

        {error ? <div className="notice error">{error}</div> : null}
        {step === 2 && message ? <div className="notice info">{message}</div> : null}

        {step === 1 ? (
          <form onSubmit={requestReset}>
            <div className="field">
              <label htmlFor="email">{t('email')}</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <button className="btn btn-block" type="submit" disabled={busy}>
              {busy ? 'Sending…' : t('sendReset')}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword}>
            <div className="field">
              <label htmlFor="token">{t('resetToken')}</label>
              <input
                id="token"
                className="input"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
              />
              <span className="hint">Paste the token from your reset email.</span>
            </div>
            <div className="field">
              <label htmlFor="new-password">{t('newPassword')}</label>
              <input
                id="new-password"
                type="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <button className="btn btn-block" type="submit" disabled={busy}>
              {busy ? 'Updating…' : t('resetPassword')}
            </button>
          </form>
        )}

        <p className="switch">
          <Link to="/login">← {t('backToSignIn')}</Link>
        </p>
      </div>
    </div>
  );
}
