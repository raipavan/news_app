import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';

export default function NotFound() {
  const { t } = useLocale();
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="kicker">404</span>
        <h1>{t('noResults')}</h1>
        <p className="sub">{t('noResultsBody')}</p>
        <div className="form-row">
          <Link className="btn" to="/">{t('home')}</Link>
          <Link className="btn btn-outline" to="/latest">{t('latest')}</Link>
        </div>
      </div>
    </div>
  );
}
