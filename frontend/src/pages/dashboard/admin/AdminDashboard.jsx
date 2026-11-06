import { Link } from 'react-router-dom';
import { useApi } from '../../../hooks/useApi';
import { useDocumentTitle } from '../../../hooks/useApi';
import { EmptyState, PageLoading } from '../../../components/ui';
import { formatNumber, timeAgo } from '../../../lib/format';

const TOOLS = [
  ['Users & roles', 'Create staff accounts, change roles and publisher rights.', '/dashboard/admin/users'],
  ['Sections & districts', 'Manage the taxonomy used by every story and URL.', '/dashboard/admin/taxonomy'],
  ['Advertisements', 'Book ad placements, sponsorships and campaign dates.', '/dashboard/admin/ads'],
  ['Audit log', 'Every editorial and administrative action, in order.', '/dashboard/admin/audit'],
];

export default function AdminDashboard() {
  const { data, loading, error } = useApi('/admin/dashboard');
  useDocumentTitle('Admin overview');

  if (loading && !data) return <PageLoading label="Loading administration" />;
  if (error) return <EmptyState title="Could not load admin metrics" body={error.message} />;

  const metrics = data?.metrics || {};
  const cards = [
    ['Articles', metrics.total_articles, 'Excluding archived', ''],
    ['Published', metrics.published, 'Live on the site', 'green'],
    ['Review queue', metrics.pending, 'Language versions waiting', 'red'],
    ['Views', formatNumber(metrics.total_views), 'All time', 'gold'],
    ['Reporters', metrics.reporters, 'Active staff accounts', ''],
    ['Community', metrics.community_users, 'Contributors registered', ''],
    ['Comments', metrics.pending_comments, 'Pending moderation', 'red'],
    ['Reports', metrics.open_reports, 'Open reader flags', 'red'],
    ['Ad revenue', `₹${formatNumber(metrics.total_revenue)}`, `Sponsored ₹${formatNumber(metrics.sponsored_revenue)}`, 'gold'],
    ['Sponsored posts', metrics.sponsored_posts, 'Marked as paid content', 'gold'],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Administration</span>
          <h2>Admin overview</h2>
          <p>Platform health, revenue and the controls that keep the newsroom running.</p>
        </div>
        <Link className="btn btn-outline" to="/dashboard/admin/users">Manage users</Link>
      </div>

      <div className="metric-grid">
        {cards.map(([label, value, sub, tone]) => (
          <div className={`metric ${tone}`} key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value ?? 0}</div>
            <div className="metric-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid even">
        <section className="panel">
          <div className="panel-head"><h3>Administration tools</h3></div>
          <div className="panel-body">
            <div className="quick-actions">
              {TOOLS.map(([title, body, to]) => (
                <Link className="quick-action" to={to} key={to}>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Recent activity</h3>
            <Link className="link" to="/dashboard/admin/audit">Full log →</Link>
          </div>
          <div className="panel-body flush">
            <div className="list-check">
              {(data?.recent_activity || []).map((entry, index) => (
                <div className="item" key={`${entry.action}-${index}`}>
                  <div>
                    <h4>{entry.action.replace(/\./g, ' · ')}</h4>
                    <span className="meta">
                      {entry.user_name || 'System'} · {entry.entity || 'platform'} · {timeAgo(entry.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              {!(data?.recent_activity || []).length ? (
                <div className="empty" style={{ margin: 0, border: 0 }}>No recorded activity.</div>
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
              {(data?.top_articles || []).map((item, index) => (
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
