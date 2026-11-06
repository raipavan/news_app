import { Link } from 'react-router-dom';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { EmptyState, PageLoading } from '../../components/ui';
import { thumbnailUrl } from '../../lib/api';
import { formatDate, statusLabel, timeAgo } from '../../lib/format';
import { useLocale } from '../../context/LocaleContext';

function reviewLanguage(item) {
  return (
    item.translations?.find((row) => ['submitted', 'in_review'].includes(row.status)) ||
    item.translations?.[0]
  );
}

export default function ReviewQueue() {
  const { data, loading, error } = useApi('/admin/pending-articles');
  const { lang } = useLocale();
  useDocumentTitle('Review queue');
  const items = data?.items || [];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Editorial desk</span>
          <h2>Review queue</h2>
          <p>Every language version must be verified independently before it goes live.</p>
        </div>
      </div>

      {loading && !data ? (
        <PageLoading label="Loading the review queue" />
      ) : error ? (
        <EmptyState title="Could not load the queue" body={error.message} />
      ) : items.length ? (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Story</th>
                  <th>Author</th>
                  <th>Languages</th>
                  <th>Waiting</th>
                  <th className="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const target = reviewLanguage(item);
                  return (
                    <tr key={item.id}>
                      <td className="title-cell">
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {item.main_image_id ? (
                            <img
                              src={thumbnailUrl(item.main_image_id)}
                              alt=""
                              width="54"
                              height="40"
                              style={{ objectFit: 'cover', flex: '0 0 auto' }}
                            />
                          ) : (
                            <span
                              className="thumb-fallback"
                              style={{ width: 54, height: 40, fontSize: 16, flex: '0 0 auto' }}
                            >
                              K
                            </span>
                          )}
                          <span>
                            {target?.headline || 'Untitled'}
                            <small>
                              {item.category_name_en || 'Uncategorised'}
                              {item.district_name_en ? ` · ${item.district_name_en}` : ''}
                              {' · '}
                              {statusLabel(item.status)}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.author_name}
                        <small className="text-muted" style={{ display: 'block', fontSize: 11 }}>
                          {item.author_email}
                        </small>
                      </td>
                      <td>
                        <div className="cell-stack">
                          {item.translations.map((row) => (
                            <span key={row.id} className="status-line">
                              <span className="badge gold">{row.language.toUpperCase()}</span>
                              <span className={`badge ${row.status}`}>{statusLabel(row.status)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="nowrap">
                        {target?.submitted_at ? timeAgo(target.submitted_at, lang) : formatDate(item.created_at, lang)}
                        <small className="text-muted" style={{ display: 'block', fontSize: 11 }}>
                          created {formatDate(item.created_at, lang)}
                        </small>
                      </td>
                      <td className="right">
                        <Link
                          className="btn btn-xs"
                          to={`/dashboard/review/${item.id}?lang=${target?.language || 'en'}`}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState
          title="The queue is clear"
          body="No stories are waiting for editorial review right now."
        />
      )}
    </>
  );
}
