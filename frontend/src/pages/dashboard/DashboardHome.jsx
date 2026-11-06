import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { PageLoading, EmptyState } from '../../components/ui';
import { formatDate, formatNumber, statusLabel, timeAgo } from '../../lib/format';

function badge(status) {
  return <span className={`badge ${status}`}>{statusLabel(status)}</span>;
}

function translationHeadline(article) {
  return article.translations?.[0]?.headline || 'Untitled';
}

function StaffOverview({ data, loading }) {
  if (loading && !data) return <PageLoading label="Loading newsroom metrics" />;
  if (!data) return <EmptyState title="No dashboard data" body="The newsroom metrics could not be loaded." />;
  const m = data.metrics || {};
  const metrics = [
    ['Total articles', m.total_articles, 'All time', ''],
    ['Published', m.published, 'Public right now', 'green'],
    ['Awaiting review', m.pending, 'Editorial queue', 'red'],
    ['Total views', formatNumber(m.total_views), 'All articles', 'gold'],
    ['Reporters', m.reporters, 'Active staff', ''],
    ['Community users', m.community_users, 'Registered contributors', ''],
    ['Pending comments', m.pending_comments, 'Need moderation', 'red'],
    ['Open reports', m.open_reports, 'Reader flags', 'red'],
    ['Sponsored posts', m.sponsored_posts, 'Paid content', 'gold'],
    ['Ad revenue', `₹${formatNumber(m.total_revenue)}`, `Sponsored ₹${formatNumber(m.sponsored_revenue)}`, 'gold'],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Editorial desk</span>
          <h2>Newsroom overview</h2>
          <p>Everything waiting on the desk, at a glance.</p>
        </div>
        <div className="form-row">
          <Link className="btn" to="/dashboard/articles/new">New article</Link>
          <Link className="btn btn-outline" to="/dashboard/review">Review queue</Link>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map(([label, value, sub, tone]) => (
          <div className={`metric ${tone}`} key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value ?? 0}</div>
            <div className="metric-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Waiting for review</h3>
            <Link className="link" to="/dashboard/review">Open queue →</Link>
          </div>
          <div className="panel-body flush">
            {(data.pending || []).length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Story</th>
                      <th>Author</th>
                      <th>Status</th>
                      <th className="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pending.map((item) => (
                      <tr key={item.id}>
                        <td className="title-cell">
                          {item.headline}
                          <small>{item.language?.toUpperCase()} · submitted {timeAgo(item.created_at)}</small>
                        </td>
                        <td>{item.author_name}</td>
                        <td>{badge(item.translation_status || item.status)}</td>
                        <td className="right">
                          <Link className="btn btn-xs" to={`/dashboard/review/${item.id}`}>Review</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty" style={{ margin: 0, border: 0 }}>
                <h3>The queue is clear</h3>
                <p>No stories are waiting for editorial review.</p>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Recent activity</h3>
            <Link className="link" to="/dashboard/admin/audit">Audit log →</Link>
          </div>
          <div className="panel-body flush">
            <div className="list-check">
              {(data.recent_activity || []).map((item, index) => (
                <div className="item" key={`${item.action}-${index}`}>
                  <div>
                    <h4>{item.action.replace(/\./g, ' · ')}</h4>
                    <span className="meta">
                      {item.user_name || 'System'} · {timeAgo(item.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              {!(data.recent_activity || []).length ? (
                <div className="empty" style={{ margin: 0, border: 0 }}>No activity yet.</div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <section className="panel mt-2">
        <div className="panel-head">
          <h3>Most read stories</h3>
          <Link className="link" to="/dashboard/admin/analytics">Analytics →</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Headline</th>
                <th>Language</th>
                <th className="right">Views</th>
              </tr>
            </thead>
            <tbody>
              {(data.top_articles || []).map((item, index) => (
                <tr key={item.id}>
                  <td className="num">{String(index + 1).padStart(2, '0')}</td>
                  <td className="title-cell">
                    <a href={`/${item.language}/news/${item.slug}`}>{item.headline}</a>
                  </td>
                  <td><span className="badge gold">{item.language?.toUpperCase()}</span></td>
                  <td className="right num">{formatNumber(item.view_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ContributorOverview({ user, mine, bookmarks, loading }) {
  const { lang } = useLocale();
  const articles = mine?.items || [];
  const counts = articles.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.status === 'published') acc.published += 1;
      if (item.status === 'submitted') acc.review += 1;
      if (item.status === 'rejected') acc.rejected += 1;
      acc.views += Number(item.view_count) || 0;
      return acc;
    },
    { total: 0, published: 0, review: 0, rejected: 0, views: 0 }
  );

  if (loading && !mine) return <PageLoading label="Loading your desk" />;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Community desk</span>
          <h2>Welcome, {user?.name?.split(' ')[0]}</h2>
          <p>Write a report, follow its review, and keep your published work in one place.</p>
        </div>
        <div className="form-row">
          <Link className="btn" to="/dashboard/articles/new">Write a story</Link>
          <Link className="btn btn-outline" to="/dashboard/bookmarks">Bookmarks</Link>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <div className="metric-label">Your stories</div>
          <div className="metric-value">{counts.total}</div>
          <div className="metric-sub">Drafts and submissions</div>
        </div>
        <div className="metric gold">
          <div className="metric-label">In review</div>
          <div className="metric-value">{counts.review}</div>
          <div className="metric-sub">With the editorial desk</div>
        </div>
        <div className="metric green">
          <div className="metric-label">Published</div>
          <div className="metric-value">{counts.published}</div>
          <div className="metric-sub">Live on the site</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total views</div>
          <div className="metric-value">{formatNumber(counts.views)}</div>
          <div className="metric-sub">Across published stories</div>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Your recent stories</h3>
            <Link className="link" to="/dashboard/articles">All articles →</Link>
          </div>
          <div className="panel-body flush">
            {articles.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Story</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th className="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.slice(0, 6).map((item) => {
                      const translation = item.translations?.[0];
                      return (
                        <tr key={item.id}>
                          <td className="title-cell">
                            {translationHeadline(item)}
                            <small>{translation?.language?.toUpperCase()} · {item.category_name_en || 'Uncategorised'}</small>
                          </td>
                          <td>{badge(item.status)}</td>
                          <td className="nowrap">{formatDate(item.updated_at, lang)}</td>
                          <td className="right">
                            <Link className="btn btn-xs btn-outline" to={`/dashboard/articles/${item.id}?lang=${translation?.language || 'en'}`}>
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty" style={{ margin: 0, border: 0 }}>
                <h3>No stories yet</h3>
                <p>Start with a headline, a summary and at least one photo.</p>
                <Link className="btn mt-2" to="/dashboard/articles/new">Write your first story</Link>
              </div>
            )}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="panel">
            <div className="panel-head"><h3>How review works</h3></div>
            <div className="panel-body">
              <ol className="step-list">
                <li>
                  <span className="badge draft">1</span>
                  <div>Draft and attach a main image.</div>
                </li>
                <li>
                  <span className="badge submitted">2</span>
                  <div>Submit the language version for review.</div>
                </li>
                <li>
                  <span className="badge approved">3</span>
                  <div>An editor verifies sources and language.</div>
                </li>
                <li>
                  <span className="badge published">4</span>
                  <div>The story goes live with its own URL.</div>
                </li>
              </ol>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Saved for later</h3>
              <Link className="link" to="/dashboard/bookmarks">View all →</Link>
            </div>
            <div className="panel-body">
              {(bookmarks?.items || []).length ? (
                <div className="mini-list">
                  {bookmarks.items.slice(0, 4).map((item) => (
                    <div key={item.id}>
                      <a href={item.url}>{item.headline}</a>
                      <div className="meta">{formatDate(item.published_at, lang)} · {item.category?.name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="aside-note">Bookmark stories while reading to find them here.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export default function DashboardHome() {
  const { user, isStaff } = useAuth();
  const { lang } = useLocale();
  const staffData = useApi('/admin/dashboard', { enabled: isStaff });
  const mine = useApi('/articles?mine=true&limit=50', { enabled: !isStaff });
  const bookmarks = useApi(`/me/bookmarks?lang=${lang}`, { enabled: !isStaff });
  useDocumentTitle(isStaff ? 'Newsroom overview' : 'Dashboard');

  if (isStaff) {
    return <StaffOverview data={staffData.data} loading={staffData.loading} />;
  }
  return (
    <ContributorOverview
      user={user}
      mine={mine.data}
      bookmarks={bookmarks.data}
      loading={mine.loading}
    />
  );
}
