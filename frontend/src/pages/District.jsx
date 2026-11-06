import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useApi, useDocumentTitle } from '../hooks/useApi';
import ArticleCard from '../components/ArticleCard';
import { EmptyState, PageLoading, Pagination } from '../components/ui';

export default function District() {
  const { slug } = useParams();
  const { lang, t } = useLocale();
  const { districts } = useOutletContext();
  const [page, setPage] = useState(1);
  const limit = 12;
  const { data, loading, error } = useApi(
    `/public/district/${slug}?lang=${lang}&page=${page}&limit=${limit}`
  );
  useDocumentTitle(data?.district?.name || t('districts'));

  useEffect(() => {
    setPage(1);
  }, [slug, lang]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const items = data?.items || [];
  const district = data?.district;

  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div>
            <span className="kicker">{t('districtNews')}</span>
            <h2>{district?.name || '…'}</h2>
            <p>{data?.total ? `${data.total} ${t(data.total === 1 ? 'story' : 'stories')}` : ''}</p>
          </div>
          <Link className="btn btn-outline btn-sm" to="/latest">{t('allStories')}</Link>
        </div>

        <div className="chips-row">
          {districts.map((item) => (
            <Link
              className={`chip ${item.slug === slug ? 'active' : ''}`}
              key={item.slug}
              to={`/district/${item.slug}`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {error ? (
          <EmptyState
            title={t('noResults')}
            body={error.message}
            action={<Link className="btn mt-2" to="/">{t('home')}</Link>}
          />
        ) : loading && !data ? (
          <PageLoading />
        ) : items.length ? (
          <>
            <div className="cards-grid">
              {items.map((item) => (
                <ArticleCard item={item} key={item.id} />
              ))}
            </div>
            <Pagination page={page} total={data?.total || 0} limit={limit} onChange={setPage} />
          </>
        ) : (
          <EmptyState
            title={t('noArticles')}
            body={t('noArticlesBody')}
            action={<Link className="btn mt-2" to="/latest">{t('allStories')}</Link>}
          />
        )}
      </div>
    </div>
  );
}
