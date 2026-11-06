import { useApi, useDocumentTitle } from '../../../hooks/useApi';
import { EmptyState, PageLoading } from '../../../components/ui';
import { formatNumber, titleCase } from '../../../lib/format';

export default function Analytics() {
  const { data, loading, error } = useApi('/admin/analytics');
  useDocumentTitle('Analytics');

  if (loading && !data) return <PageLoading label="Crunching the numbers" />;
  if (error) return <EmptyState title="Could not load analytics" body={error.message} />;

  const views = data?.views_by_day || [];
  const categories = data?.top_categories || [];
  const articles = data?.top_articles || [];
  const shares = data?.shares_by_platform || [];
  const engagement = data?.engagement || {};
  const revenue = data?.revenue || {};

  const maxViews = Math.max(1, ...views.map((row) => Number(row.views) || 0));
  const maxCategory = Math.max(1, ...categories.map((row) => Number(row.views) || 0));
  const shareTotal = shares.reduce((sum, row) => sum + Number(row.count), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Performance</span>
          <h2>Analytics</h2>
          <p>Views, engagement and revenue across the last two weeks.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <div className="metric-label">Tracked views</div>
          <div className="metric-value">{formatNumber(engagement.views)}</div>
          <div className="metric-sub">All recorded sessions</div>
        </div>
        <div className="metric green">
          <div className="metric-label">Likes</div>
          <div className="metric-value">{formatNumber(engagement.likes)}</div>
          <div className="metric-sub">Across published stories</div>
        </div>
        <div className="metric">
          <div className="metric-label">Comments</div>
          <div className="metric-value">{formatNumber(engagement.comments)}</div>
          <div className="metric-sub">Approved only</div>
        </div>
        <div className="metric gold">
          <div className="metric-label">Bookmarks</div>
          <div className="metric-value">{formatNumber(engagement.bookmarks)}</div>
          <div className="metric-sub">Saved by readers</div>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Views · last 14 days</h3>
            <span className="text-sm text-muted">{formatNumber(engagement.views)} total</span>
          </div>
          <div className="panel-body">
            {views.length ? (
              <div className="bar-chart">
                {views.map((row) => (
                  <div className="bar-wrap" key={row.day} title={`${row.day}: ${row.views} views`}>
                    <div
                      className="bar"
                      style={{ height: `${Math.max(3, (Number(row.views) / maxViews) * 100)}%` }}
                    />
                    <span className="bar-label">{String(row.day).slice(5)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="aside-note">No view activity has been recorded yet.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Revenue</h3></div>
          <div className="panel-body">
            <div className="metric-grid cols-2" style={{ marginBottom: 0 }}>
              <div className="metric gold" style={{ borderTopWidth: 2 }}>
                <div className="metric-label">Total booked</div>
                <div className="metric-value">₹{formatNumber(revenue.total)}</div>
                <div className="metric-sub">Active, paused and expired campaigns</div>
              </div>
              <div className="metric" style={{ borderTopWidth: 2 }}>
                <div className="metric-label">Sponsored</div>
                <div className="metric-value">₹{formatNumber(revenue.sponsored)}</div>
                <div className="metric-sub">Marked as paid content</div>
              </div>
            </div>
            <div className="form-section">
              <h3>Shares</h3>
              {shares.length ? (
                shares.map((row) => (
                  <div className="hbar" key={row.platform}>
                    <span className="label">{titleCase(row.platform)}</span>
                    <div className="track">
                      <div
                        className="fill"
                        style={{ width: `${shareTotal ? (row.count / shareTotal) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="value">{formatNumber(row.count)}</span>
                  </div>
                ))
              ) : (
                <p className="aside-note">No shares recorded yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="dash-grid even mt-2">
        <section className="panel">
          <div className="panel-head"><h3>Sections by views</h3></div>
          <div className="panel-body">
            {categories.length ? (
              categories.map((row) => (
                <div className="hbar" key={row.name_en}>
                  <span className="label">{row.name_en}</span>
                  <div className="track">
                    <div
                      className="fill"
                      style={{ width: `${(Number(row.views) / maxCategory) * 100}%` }}
                    />
                  </div>
                  <span className="value">{formatNumber(row.views)}</span>
                </div>
              ))
            ) : (
              <p className="aside-note">No section data yet.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Most read stories</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Headline</th>
                  <th>Lang</th>
                  <th className="right">Views</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((item) => (
                  <tr key={item.id}>
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
      </div>
    </>
  );
}
