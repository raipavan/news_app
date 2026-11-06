import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useLocale } from '../context/LocaleContext';
import { getVisitorId } from '../lib/api';

export function SectionHead({ kicker, title, to, linkLabel }) {
  const { t } = useLocale();
  return (
    <div className="section-head">
      <div>
        {kicker ? <span className="kicker">{kicker}</span> : null}
        <h2>{title}</h2>
      </div>
      {to ? (
        <Link className="section-more" to={to}>
          {linkLabel || t('viewAll')} →
        </Link>
      ) : null}
    </div>
  );
}

function AdLink({ ad, wide = false, stacked = false }) {
  useEffect(() => {
    if (!ad?.id) return;
    fetch(`/api/v1/public/ads/${ad.id}/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor_id: getVisitorId() }),
    }).catch(() => {});
  }, [ad?.id]);

  if (!ad) return null;
  const width = Math.min(100, Math.max(25, Number(ad.display_width) || 100));
  const maxHeight = Number(ad.max_height) || null;
  const slotStyle = { width: `${width}%` };
  if (width < 100) {
    slotStyle.marginLeft = 'auto';
    slotStyle.marginRight = 'auto';
  }
  const imageStyle = maxHeight
    ? { height: `${maxHeight}px`, objectFit: ad.image_fit === 'contain' ? 'contain' : 'cover' }
    : undefined;
  const clickHref = `${ad.click_url}${ad.click_url.includes('?') ? '&' : '?'}visitor_id=${encodeURIComponent(getVisitorId())}`;
  return (
    <a
      className={`ad-slot ${wide && !stacked ? 'ad-wide' : ''}`}
      style={slotStyle}
      href={clickHref}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`${ad.advertiser_name || ad.title} — advertisement`}
    >
      {ad.image?.optimized || ad.image?.thumb ? (
        <img
          src={ad.image.optimized || ad.image.thumb}
          alt={ad.title}
          loading="lazy"
          style={imageStyle}
        />
      ) : (
        <span className="ad-fallback">{ad.title}</span>
      )}
      <span className="ad-label">Advertisement</span>
    </a>
  );
}

export function AdSlot({ ad, ads, wide = false }) {
  const list = (ads?.length ? ads : ad ? [ad] : []).filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) return <AdLink ad={list[0]} wide={wide} />;
  return (
    <div className={`ad-stack ${wide ? 'ad-stack-wide' : ''}`}>
      {list.map((item) => (
        <AdLink key={item.id} ad={item} wide={wide} stacked />
      ))}
    </div>
  );
}

export function PageLoading({ label }) {
  const { t } = useLocale();
  return (
    <div className="page-loading">
      <div className="spinner" />
      <span>{label || t('loading')}…</span>
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}

export function Pagination({ page, total, limit, onChange }) {
  const { t } = useLocale();
  const pages = Math.max(1, Math.ceil((total || 0) / (limit || 12)));
  if (pages <= 1) return null;
  const numbers = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, start + 4);
  for (let i = start; i <= end; i += 1) numbers.push(i);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        ← {t('prev')}
      </button>
      {start > 1 ? (
        <>
          <button type="button" onClick={() => onChange(1)}>1</button>
          {start > 2 ? <span>…</span> : null}
        </>
      ) : null}
      {numbers.map((number) => (
        <button
          type="button"
          key={number}
          className={number === page ? 'active' : ''}
          onClick={() => onChange(number)}
          aria-current={number === page ? 'page' : undefined}
        >
          {number}
        </button>
      ))}
      {end < pages ? (
        <>
          {end < pages - 1 ? <span>…</span> : null}
          <button type="button" onClick={() => onChange(pages)}>{pages}</button>
        </>
      ) : null}
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages}>
        {t('next')} →
      </button>
    </nav>
  );
}
