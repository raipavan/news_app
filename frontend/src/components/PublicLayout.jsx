import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { AdSlot } from './ui';
import { formatDate, timeAgo } from '../lib/format';

export function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">T</span>
      <span>
        <span className="brand-name">Thaja <span>Suddi</span></span>
        <span className="brand-kn">ತಾಜಾ ಸುದ್ದಿ</span>
      </span>
    </span>
  );
}

export function BrandLink({ dark = false }) {
  return (
    <Link to="/" className={`brand ${dark ? 'brand-dark' : ''}`} aria-label="Thaja Suddi home">
      <span className="brand-mark" aria-hidden="true">T</span>
      <span>
        <span className="brand-name">Thaja <span>Suddi</span></span>
        <span className="brand-kn">ತಾಜಾ ಸುದ್ದಿ</span>
      </span>
    </Link>
  );
}

function Ticker({ items }) {
  const { t } = useLocale();
  if (!items?.length) return null;
  return (
    <div className="ticker" aria-label={t('breaking')}>
      <div className="ticker-label">{t('breaking')}</div>
      <div className="ticker-window">
        <div className="ticker-track">
          {[0, 1].map((copy) => (
            <div className="ticker-group" key={copy} aria-hidden={copy === 1 ? 'true' : undefined}>
              {items.map((item) => (
                <a className="ticker-item" href={item.url} key={`${copy}-${item.url}`}>
                  {item.headline}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Header({ categories, ticker }) {
  const { lang, setLang, t } = useLocale();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const isCategoryActive = (slug) => location.pathname === `/category/${slug}`;
  const today = formatDate(new Date().toISOString(), lang);

  const submitSearch = (event) => {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
  };

  return (
    <header className="site-header">
      <div className="header-top">
        <div className="container">
          <div>
            {t('topbarTag')} <span className="dot">◆</span> {today}
          </div>
          <div className="header-top-right">
            <a href="/about">{t('about')}</a>
            <a href="/editorial-policy">{t('editorialPolicy')}</a>
            {user ? (
              <>
                <Link to="/dashboard">{t('newsroom')}</Link>
                <Link to="/dashboard">{user.name.split(' ')[0]}</Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="masthead">
        <div className="container">
          <div className="masthead-left">
            <BrandLink />
          </div>
          <div className="masthead-tag">
            <strong>{t('edition')}</strong>
            {t('cities')}
          </div>
          <div className="masthead-right">
            <div className="lang-switch" role="group" aria-label={t('language')}>
              <button
                type="button"
                className={lang === 'en' ? 'active' : ''}
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
              <button
                type="button"
                className={lang === 'kn' ? 'active' : ''}
                onClick={() => setLang('kn')}
                aria-pressed={lang === 'kn'}
              >
                ಕನ್ನಡ
              </button>
            </div>
            {user ? (
              <>
                <Link className="btn btn-sm btn-outline" to="/dashboard">
                  {t('dashboard')}
                </Link>
                <Link className="btn btn-sm" to="/dashboard/articles/new">
                  {t('submitNews')}
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="nav-wrap">
        <div className="container">
          <nav className="main-nav" aria-label={t('sections')}>
            <Link className={`nav-home ${location.pathname === '/' ? 'active' : ''}`} to="/">
              {t('home')}
            </Link>
            {categories.map((category) => (
              <Link
                key={category.slug}
                to={`/category/${category.slug}`}
                className={isCategoryActive(category.slug) ? 'active' : ''}
              >
                {category.name}
              </Link>
            ))}
            <Link
              to="/latest"
              className={location.pathname === '/latest' ? 'active' : ''}
            >
              {t('latest')}
            </Link>
            <div className="nav-search">
              <form onSubmit={submitSearch} role="search">
                <input
                  name="q"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('searchPlaceholder')}
                  aria-label={t('searchPlaceholder')}
                />
                <button type="submit" aria-label={t('search')}>⌕</button>
              </form>
            </div>
          </nav>
        </div>
      </div>

      <Ticker items={ticker} />
    </header>
  );
}

function Footer({ categories, districts }) {
  const { t, lang, setLang } = useLocale();
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main">
          <div>
            <BrandLink dark />
            <p className="mt-2">{t('footerAbout')}</p>
            <p className="status-line">
              <span>Bengaluru, Karnataka</span>
              <span className="sep">·</span>
              <span>newsroom@thajasuddi.in</span>
            </p>
            <div className="lang-switch mt-2" role="group" aria-label={t('language')}>
              <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
                English
              </button>
              <button type="button" className={lang === 'kn' ? 'active' : ''} onClick={() => setLang('kn')}>
                ಕನ್ನಡ
              </button>
            </div>
          </div>
          <div>
            <h4>{t('sections')}</h4>
            <ul className="footer-links">
              {categories.slice(0, 6).map((category) => (
                <li key={category.slug}>
                  <Link to={`/category/${category.slug}`}>{category.name}</Link>
                </li>
              ))}
              <li><Link to="/latest">{t('latest')}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t('districts')}</h4>
            <ul className="footer-links">
              {districts.slice(0, 6).map((district) => (
                <li key={district.slug}>
                  <Link to={`/district/${district.slug}`}>{district.name}</Link>
                </li>
              ))}
              <li><Link to="/latest">{t('browseDistrict')}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t('company')}</h4>
            <ul className="footer-links">
              <li><Link to="/about">{t('about')}</Link></li>
              <li><Link to="/editorial-policy">{t('editorialPolicy')}</Link></li>
              <li><Link to="/corrections">{t('corrections')}</Link></li>
              <li><Link to="/privacy-policy">{t('privacy')}</Link></li>
              <li><Link to="/terms">{t('terms')}</Link></li>
              <li><a href="mailto:ads@thajasuddi.in">{t('advertise')}</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {year} {t('copyright')}</span>
          <span>
            <span className="dot">◆</span> Made in Karnataka · Kannada &amp; English
          </span>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const { lang } = useLocale();
  const { data: categoriesData } = useApi(`/public/categories?lang=${lang}`, { initialData: { items: [] } });
  const { data: districtsData } = useApi(`/public/districts?lang=${lang}`, { initialData: { items: [] } });
  const { data: tickerData } = useApi(`/public/ticker?lang=${lang}`, { initialData: { items: [] } });
  const location = useLocation();
  const contentPath = location.pathname;
  const scopeMatch = contentPath.match(/^\/(category|district)\/([^/]+)/);
  const adParams = new URLSearchParams({ path: contentPath });
  if (scopeMatch) adParams.set(scopeMatch[1], scopeMatch[2]);
  const adsPath = `/public/ads?${adParams.toString()}`;
  const { data: adsData } = useApi(adsPath, { initialData: { items: [] } });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  const categories = categoriesData?.items || [];
  const districts = districtsData?.items || [];
  const pageAds = adsData?.items || [];
  let pagePlacements = [];
  if (contentPath === '/latest') {
    pagePlacements = ['latest_top', 'category', 'home_top', 'article_top'];
  } else if (contentPath.startsWith('/search')) {
    pagePlacements = ['search_top', 'category', 'home_top', 'article_top'];
  } else if (contentPath.startsWith('/district/')) {
    pagePlacements = ['district_top', 'category', 'home_top', 'article_top'];
  } else if (contentPath.startsWith('/category/')) {
    pagePlacements = ['category', 'home_top', 'article_top'];
  }
  let pageAdList = [];
  for (const placement of pagePlacements) {
    const matches = pageAds.filter((ad) => ad.placement === placement);
    if (matches.length) {
      pageAdList = matches;
      break;
    }
  }
  const bottomPlacement =
    contentPath === '/latest'
      ? 'latest_bottom'
      : contentPath.startsWith('/search')
        ? 'search_bottom'
        : contentPath.startsWith('/category/')
          ? 'category_bottom'
          : contentPath.startsWith('/district/')
            ? 'district_bottom'
            : null;
  const bottomAdList = bottomPlacement
    ? pageAds.filter((ad) => ad.placement === bottomPlacement)
    : [];
  const globalTopAds = pageAds.filter((ad) => ad.placement === 'global_top');
  const globalBottomAds = pageAds.filter((ad) => ad.placement === 'global_bottom');
  const footerAds = pageAds.filter((ad) => ad.placement === 'footer');

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header categories={categories} ticker={tickerData?.items || []} />
      <main id="main-content">
        {globalTopAds.length ? (
          <div className="container global-top-ad">
            <AdSlot ads={globalTopAds} wide />
          </div>
        ) : null}
        {pageAdList.length ? (
          <div className="container page-banner-ad">
            <AdSlot ads={pageAdList} wide />
          </div>
        ) : null}
        <Outlet context={{ categories, districts }} />
      </main>
      {bottomAdList.length ? (
        <div className="container page-bottom-ad">
          <AdSlot ads={bottomAdList} wide />
        </div>
      ) : null}
      {globalBottomAds.length ? (
        <div className="container global-bottom-ad">
          <AdSlot ads={globalBottomAds} wide />
        </div>
      ) : null}
      {footerAds.length ? (
        <div className="container footer-ad">
          <AdSlot ads={footerAds} wide />
        </div>
      ) : null}
      <Footer categories={categories} districts={districts} />
    </>
  );
}

export { timeAgo };
