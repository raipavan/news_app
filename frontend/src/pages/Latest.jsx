import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useApi, useDocumentTitle } from '../hooks/useApi';
import ArticleCard from '../components/ArticleCard';
import { EmptyState, PageLoading, Pagination } from '../components/ui';

export default function Latest() {
  const { lang, t } = useLocale();
  const { categories } = useOutletContext();
  const [page, setPage] = useState(1);
  const limit = 12;
  const { data, loading } = useApi(`/public/latest?lang=${lang}&page=${page}&limit=${limit}`);
  useDocumentTitle(t('latestNews'));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const items = data?.items || [];

  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div>
            <span className="kicker">{t('newsroom')}</span>
            <h2>{t('latestNews')}</h2>
            <p>
              {data?.total ? `${data.total} ${t(data.total === 1 ? 'story' : 'stories')}` : t('allStories')} · Kannada &amp; English
            </p>
          </div>
          <Link className="btn btn-outline btn-sm" to="/">{t('home')}</Link>
        </div>

        <div className="chips-row">
          <span className="chip active">{t('all')}</span>
          {categories.map((category) => (
            <Link className="chip" key={category.slug} to={`/category/${category.slug}`}>
              {category.name}
            </Link>
          ))}
        </div>

        {loading && !data ? (
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
          <EmptyState title={t('noArticles')} body={t('noArticlesBody')} />
        )}
      </div>
    </div>
  );
}
