import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useLocale } from '../../context/LocaleContext';
import { useDocumentTitle } from '../../hooks/useApi';
import { EmptyState, PageLoading } from '../../components/ui';
import ArticleCard from '../../components/ArticleCard';

export default function Bookmarks() {
  const { lang, t } = useLocale();
  const { data, loading, error } = useApi(`/me/bookmarks?lang=${lang}`, { deps: [lang] });
  const items = data?.items || [];
  useDocumentTitle('Bookmarks');

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Reading list</span>
          <h2>Bookmarks</h2>
          <p>Stories you saved while reading, in the current {lang === 'kn' ? 'Kannada' : 'English'} edition.</p>
        </div>
      </div>

      {loading && !data ? (
        <PageLoading />
      ) : error ? (
        <EmptyState title="Could not load bookmarks" body={error.message} />
      ) : items.length ? (
        <div className="cards-grid">
          {items.map((item) => (
            <ArticleCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t('noBookmarks')}
          body="Use the bookmark button on any published story to keep it here."
          action={<Link className="btn mt-2" to="/latest">Browse latest stories</Link>}
        />
      )}
    </>
  );
}
