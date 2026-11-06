import { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useApi, useDocumentTitle } from '../hooks/useApi';
import ArticleCard from '../components/ArticleCard';
import { EmptyState, PageLoading, Pagination } from '../components/ui';

export default function SearchPage() {
  const { lang, t } = useLocale();
  const { categories, districts } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const district = params.get('district') || '';
  const page = Math.max(Number(params.get('page')) || 1, 1);
  const [term, setTerm] = useState(q);
  const limit = 12;

  useEffect(() => {
    setTerm(q);
  }, [q]);

  const query = new URLSearchParams({ lang, q, page: String(page), limit: String(limit) });
  if (category) query.set('category', category);
  if (district) query.set('district', district);
  const { data, loading, error } = useApi(`/public/search?${query.toString()}`, {
    enabled: Boolean(q),
  });
  const { data: trending } = useApi(`/public/trending?lang=${lang}`, {
    enabled: !q,
    initialData: { items: [] },
  });
  useDocumentTitle(q ? `${t('searchTitle')}: ${q}` : t('searchTitle'));

  const update = (next) => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => {
      if (value) merged.set(key, value);
      else merged.delete(key);
    });
    if (!next.page) merged.delete('page');
    setParams(merged, { replace: true });
  };

  const submit = (event) => {
    event.preventDefault();
    update({ q: term.trim(), page: '' });
  };

  const items = data?.items || [];

  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div>
            <span className="kicker">{t('searchTitle')}</span>
            <h2>{q ? `“${q}”` : t('searchTitle')}</h2>
            <p>
              {q
                ? `${data?.total || 0} ${t(data?.total === 1 ? 'resultFor' : 'resultsFor')}`
                : 'Search every Kannada and English story in the archive.'}
            </p>
          </div>
        </div>

        <form className="filters" onSubmit={submit} role="search">
          <input
            className="input"
            style={{ minWidth: 280 }}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
          />
          <select
            className="select"
            value={category}
            onChange={(event) => update({ category: event.target.value, page: '' })}
            aria-label={t('category')}
          >
            <option value="">{t('category')}: {t('all')}</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}</option>
            ))}
          </select>
          <select
            className="select"
            value={district}
            onChange={(event) => update({ district: event.target.value, page: '' })}
            aria-label={t('district')}
          >
            <option value="">{t('district')}: {t('all')}</option>
            {districts.map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}</option>
            ))}
          </select>
          <button className="btn" type="submit">{t('search')}</button>
          {category || district ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => update({ category: '', district: '', page: '' })}
            >
              {t('clearFilters')}
            </button>
          ) : null}
        </form>

        {!q ? (
          <div className="home-grid">
            <div>
              <div className="section-head">
                <div>
                  <span className="kicker">{t('trending')}</span>
                  <h2>{t('mostRead')}</h2>
                </div>
              </div>
              <div className="cards-grid cols-2">
                {(trending?.items || []).slice(0, 6).map((item) => (
                  <ArticleCard item={item} key={item.id} />
                ))}
              </div>
            </div>
            <aside className="sidebar">
              <section className="side-panel">
                <h3>{t('browseCategories')}</h3>
                <div className="chips-row">
                  {categories.map((item) => (
                    <Link className="chip" key={item.slug} to={`/category/${item.slug}`}>
                      {item.name}
                    </Link>
                  ))}
                </div>
              </section>
              <section className="side-panel">
                <h3>{t('districts')}</h3>
                <div className="chips-row">
                  {districts.slice(0, 12).map((item) => (
                    <Link className="chip" key={item.slug} to={`/district/${item.slug}`}>
                      {item.name}
                    </Link>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        ) : loading && !data ? (
          <PageLoading />
        ) : error ? (
          <EmptyState title="Search failed" body={error.message} />
        ) : items.length ? (
          <>
            <div className="cards-grid">
              {items.map((item) => (
                <ArticleCard item={item} key={item.id} />
              ))}
            </div>
            <Pagination
              page={page}
              total={data?.total || 0}
              limit={limit}
              onChange={(next) => update({ page: String(next) })}
            />
          </>
        ) : (
          <EmptyState
            title={t('noResults')}
            body={t('noResultsBody')}
            action={<Link className="btn mt-2" to="/latest">{t('allStories')}</Link>}
          />
        )}
      </div>
    </div>
  );
}
