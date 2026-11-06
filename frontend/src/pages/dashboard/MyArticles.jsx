import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useToast } from '../../context/ToastContext';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { api, thumbnailUrl } from '../../lib/api';
import { EmptyState, PageLoading } from '../../components/ui';
import { formatDate, statusLabel } from '../../lib/format';

const TABS = [
  ['', 'All'],
  ['draft', 'Drafts'],
  ['submitted', 'In review'],
  ['approved', 'Approved'],
  ['published', 'Published'],
  ['rejected', 'Rejected'],
];

function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{statusLabel(status)}</span>;
}

export default function MyArticles() {
  const { isStaff, hasPermission } = useAuth();
  const { lang, t } = useLocale();
  const { notify } = useToast();
  const [status, setStatus] = useState('');
  const [onlyMine, setOnlyMine] = useState(!isStaff);
  const [busyId, setBusyId] = useState(null);
  const query = new URLSearchParams({ limit: '50' });
  if (status) query.set('status', status);
  if (onlyMine) query.set('mine', 'true');
  const { data, loading, error, reload } = useApi(`/articles?${query.toString()}`);
  useDocumentTitle('My articles');

  const items = data?.items || [];

  const submitForReview = async (article, translation) => {
    setBusyId(`${article.id}-${translation.language}`);
    try {
      await api.post(`/articles/${article.id}/submit`, { language: translation.language });
      notify('Submitted for editorial review', 'success');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (article) => {
    if (!window.confirm('Archive this article? It will be removed from public listings.')) return;
    try {
      await api.del(`/articles/${article.id}`);
      notify('Article archived', 'success');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const remove = async (article) => {
    const title = article.translations?.[0]?.headline || 'this article';
    if (
      !window.confirm(
        `Permanently delete "${title}"? All translations, images and comments will be removed. This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await api.del(`/articles/${article.id}/permanent`);
      notify('Article deleted', 'success');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">{isStaff ? 'Editorial' : 'Community desk'}</span>
          <h2>{onlyMine ? 'My articles' : 'All articles'}</h2>
          <p>Drafts, submissions and published work with language-by-language status.</p>
        </div>
        <Link className="btn" to="/dashboard/articles/new">New article</Link>
      </div>

      <div className="filters">
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 0 }}>
          {TABS.map(([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              className={status === value ? 'active' : ''}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {isStaff ? (
          <label className="check" style={{ marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(event) => setOnlyMine(event.target.checked)}
            />
            Only my articles
          </label>
        ) : null}
      </div>

      {loading && !data ? (
        <PageLoading />
      ) : error ? (
        <EmptyState title="Could not load articles" body={error.message} />
      ) : items.length ? (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Story</th>
                  <th>Languages</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="right">Views</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((article) => {
                  const translations = article.translations || [];
                  return (
                    <tr key={article.id}>
                      <td className="title-cell">
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {article.main_image_id ? (
                            <img
                              src={thumbnailUrl(article.main_image_id)}
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
                            {translations[0]?.headline || 'Untitled'}
                            <small>
                              {article.category_name_en || 'Uncategorised'}
                              {article.district_name_en ? ` · ${article.district_name_en}` : ''}
                              {isStaff ? ` · ${article.author_name}` : ''}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          {translations.map((translation) => (
                            <span key={translation.id} className="status-line">
                              <span className="badge gold">{translation.language.toUpperCase()}</span>
                              <StatusBadge status={translation.status} />
                            </span>
                          ))}
                        </div>
                      </td>
                      <td><StatusBadge status={article.status} /></td>
                      <td className="nowrap">{formatDate(article.updated_at, lang)}</td>
                      <td className="right num">{Number(article.view_count || 0).toLocaleString('en-IN')}</td>
                      <td>
                        <div className="row-actions">
                          {translations.map((translation) => (
                            <span key={translation.id} className="row-actions">
                              {['draft', 'rejected'].includes(translation.status) ? (
                                <>
                                  <Link
                                    className="btn btn-xs btn-outline"
                                    to={`/dashboard/articles/${article.id}?lang=${translation.language}`}
                                  >
                                    Edit
                                  </Link>
                                  <button
                                    type="button"
                                    className="btn btn-xs"
                                    disabled={busyId === `${article.id}-${translation.language}`}
                                    onClick={() => submitForReview(article, translation)}
                                  >
                                    {busyId === `${article.id}-${translation.language}` ? '…' : 'Submit'}
                                  </button>
                                </>
                              ) : null}
                              {['submitted', 'in_review', 'approved'].includes(translation.status) && isStaff ? (
                                <Link
                                  className="btn btn-xs"
                                  to={`/dashboard/review/${article.id}?lang=${translation.language}`}
                                >
                                  Review
                                </Link>
                              ) : null}
                              {translation.status === 'published' ? (
                                <a
                                  className="btn btn-xs btn-outline"
                                  href={`/${translation.language}/news/${translation.slug}`}
                                >
                                  View
                                </a>
                              ) : null}
                            </span>
                          ))}
                          {isStaff ? (
                            <button type="button" className="btn btn-xs btn-danger" onClick={() => archive(article)}>
                              Archive
                            </button>
                          ) : null}
                          {hasPermission('article.delete') ? (
                            <button type="button" className="btn btn-xs btn-danger" onClick={() => remove(article)}>
                              Delete
                            </button>
                          ) : null}
                        </div>
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
          title="No articles in this view"
          body={t('noArticlesBody')}
          action={<Link className="btn mt-2" to="/dashboard/articles/new">Write a story</Link>}
        />
      )}
    </>
  );
}
