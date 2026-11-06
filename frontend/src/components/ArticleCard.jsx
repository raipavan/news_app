import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { formatDate } from '../lib/format';

export function Thumb({ item, ratio = 'card' }) {
  if (item.image?.thumb || item.image?.optimized) {
    return (
      <img
        src={item.image.thumb || item.image.optimized}
        alt=""
        loading="lazy"
        width="480"
        height="300"
      />
    );
  }
  return (
    <span className="thumb-fallback" aria-hidden="true">
      {item.language === 'kn' ? 'ಕ' : 'K'}
    </span>
  );
}

export default function ArticleCard({ item, showSummary = true }) {
  const { t } = useLocale();
  if (!item) return null;
  return (
    <article className="card">
      <a className="card-media" href={item.url} aria-label={item.headline} tabIndex={-1}>
        <Thumb item={item} />
      </a>
      {item.sponsored ? (
        <span className="sponsored-tag mt-1">{item.sponsor_label || t('sponsored')}</span>
      ) : item.category ? (
        <Link className="card-tag" to={`/category/${item.category.slug}`}>
          {item.category.name}
        </Link>
      ) : null}
      <h3>
        <a href={item.url}>{item.headline}</a>
      </h3>
      {showSummary && item.summary ? <p>{item.summary}</p> : null}
      <div className="meta">
        <span>{formatDate(item.published_at, item.language)}</span>
        {item.district ? (
          <>
            <span className="sep">·</span>
            <Link to={`/district/${item.district.slug}`}>{item.district.name}</Link>
          </>
        ) : null}
        {item.view_count ? (
          <>
            <span className="sep">·</span>
            <span>{item.view_count.toLocaleString('en-IN')} {t('views')}</span>
          </>
        ) : null}
      </div>
    </article>
  );
}

export function HeroMini({ item }) {
  const { t } = useLocale();
  if (!item) return null;
  return (
    <article className="hero-mini">
      <div>
        {item.category ? (
          <Link className="card-tag" to={`/category/${item.category.slug}`}>
            {item.category.name}
          </Link>
        ) : null}
        <h3>
          <a href={item.url}>{item.headline}</a>
        </h3>
        <div className="meta">
          <span>{formatDate(item.published_at, item.language)}</span>
          <span className="sep">·</span>
          <span>{item.view_count.toLocaleString('en-IN')} {t('views')}</span>
        </div>
      </div>
      <a href={item.url} aria-hidden="true" tabIndex={-1}>
        <Thumb item={item} />
      </a>
    </article>
  );
}

export function RelatedItem({ item }) {
  if (!item) return null;
  return (
    <article className="related-item">
      <a href={item.url} aria-hidden="true" tabIndex={-1}>
        <Thumb item={item} />
      </a>
      <div>
        <h4>
          <a href={item.url}>{item.headline}</a>
        </h4>
        <div className="meta">
          <span>{formatDate(item.published_at, item.language)}</span>
        </div>
      </div>
    </article>
  );
}
