import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useDocumentTitle } from '../../../hooks/useApi';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import { EmptyState, PageLoading } from '../../../components/ui';
import Modal from '../../../components/Modal';
import { formatDate, formatNumber, timeAgo } from '../../../lib/format';

const TOOLS = [
  ['Users & roles', 'Create staff accounts, change roles and publisher rights.', '/dashboard/admin/users'],
  ['Sections & districts', 'Manage the taxonomy used by every story and URL.', '/dashboard/admin/taxonomy'],
  ['Advertisements', 'Book ad placements, sponsorships and campaign dates.', '/dashboard/admin/ads'],
  ['Audit log', 'Every editorial and administrative action, in order.', '/dashboard/admin/audit'],
];

const FLUSH_MODES = [
  ['older_than_30d', 'Monthly cleanup: regular news images older than retention days (Recommended)'],
  ['all_news', 'Flush ALL regular news images (Keep only Advertisements & Sponsored posts)'],
  ['orphans_only', 'Flush unused / orphan news images only'],
  ['cache_only', 'Purge Cloudflare CDN Edge Cache only'],
];

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function AdminDashboard() {
  const { notify } = useToast();
  const { data, loading, error } = useApi('/admin/dashboard');
  const storageApi = useApi('/admin/storage');
  const [autoMonthly, setAutoMonthly] = useState(true);
  const [retentionDays, setRetentionDays] = useState(30);
  const [flushMode, setFlushMode] = useState('older_than_30d');
  const [savingSettings, setSavingSettings] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  useDocumentTitle('Admin overview');

  useEffect(() => {
    const s = storageApi.data?.settings;
    if (!s) return;
    setAutoMonthly(Boolean(s.autoMonthly));
    setRetentionDays(Number(s.retentionDays) || 30);
  }, [storageApi.data]);

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

  const storage = storageApi.data;
  const news = storage?.flushableNews || {};
  const ads = storage?.protectedAds || {};
  const settings = storage?.settings || {};

  const saveStorageSettings = async (event) => {
    event.preventDefault();
    setSavingSettings(true);
    try {
      await api.put('/admin/storage/settings', {
        autoMonthly,
        retentionDays: Number(retentionDays) || 30,
      });
      notify('Monthly Cloudflare flush schedule updated', 'success');
      storageApi.reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const runFlush = async () => {
    setFlushing(true);
    try {
      const res = await api.post('/admin/storage/flush', {
        mode: flushMode,
        retentionDays: Number(retentionDays) || 30,
      });
      const r = res.result || {};
      notify(
        r.mode === 'cache_only'
          ? 'Cloudflare CDN edge cache purged'
          : `Flushed ${r.filesDeleted || 0} news files (${formatBytes(r.bytesFreed)}) · Ads preserved`,
        'success'
      );
      setConfirmOpen(false);
      storageApi.reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setFlushing(false);
    }
  };

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

      <section className="panel mt-2">
        <div className="panel-head">
          <div>
            <h3>Cloudflare Storage &amp; Monthly Flush</h3>
            <span className="text-sm text-muted">
              Flushes regular news media from Cloudflare R2 &amp; DB while keeping article text/URLs and all
              Advertisements / Sponsored posts untouched.
            </span>
          </div>
          <span className={`badge ${storage?.r2Enabled ? 'green' : 'gold'}`}>
            {storage?.r2Enabled ? 'Cloudflare R2 Active' : 'Local PostgreSQL Mode'}
          </span>
        </div>
        <div className="panel-body">
          {storageApi.loading && !storage ? (
            <PageLoading label="Loading Cloudflare storage usage" />
          ) : storageApi.error ? (
            <div className="notice error">{storageApi.error.message}</div>
          ) : (
            <>
              <div className="metric-grid cols-3" style={{ marginBottom: 16 }}>
                <div className="metric">
                  <div className="metric-label">Regular News Media (Flushable)</div>
                  <div className="metric-value">{formatBytes(news.totalBytes)}</div>
                  <div className="metric-sub">
                    {formatNumber(news.totalFiles)} files · {formatNumber(news.olderThanRetentionRoots)} stories &gt;{' '}
                    {settings.retentionDays || 30}d ({formatBytes(news.olderThanRetentionBytes)})
                  </div>
                </div>
                <div className="metric gold">
                  <div className="metric-label">Ads &amp; Sponsored Posts</div>
                  <div className="metric-value">{formatBytes(ads.bytes)}</div>
                  <div className="metric-sub">
                    {formatNumber(ads.files)} files · Protected (never flushed automatically)
                  </div>
                </div>
                <div className="metric green">
                  <div className="metric-label">Last Monthly Flush</div>
                  <div className="metric-value" style={{ fontSize: 18 }}>
                    {settings.lastFlushedAt ? formatDate(settings.lastFlushedAt) : 'Not flushed yet'}
                  </div>
                  <div className="metric-sub">
                    {settings.lastResult
                      ? `${formatNumber(settings.lastResult.filesDeleted)} files · ${formatBytes(
                          settings.lastResult.bytesFreed
                        )} freed (${settings.lastResult.trigger === 'monthly_auto' ? 'Auto' : 'Manual'})`
                      : `${formatNumber(news.orphanRoots)} orphan news uploads detected`}
                  </div>
                </div>
              </div>

              <div className="dash-grid even">
                <form onSubmit={saveStorageSettings} className="form-grid">
                  <label className="check span-2">
                    <input
                      type="checkbox"
                      checked={autoMonthly}
                      onChange={(event) => setAutoMonthly(event.target.checked)}
                    />
                    <span>
                      Auto-flush regular news media every month (keeps article text &amp; all ads safe)
                    </span>
                  </label>
                  <div className="field">
                    <label htmlFor="flush-retention">Keep regular news images for (days)</label>
                    <input
                      id="flush-retention"
                      type="number"
                      min="1"
                      max="365"
                      className="input"
                      value={retentionDays}
                      onChange={(event) => setRetentionDays(event.target.value)}
                    />
                  </div>
                  <div className="field" style={{ justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-outline" disabled={savingSettings}>
                      {savingSettings ? 'Saving…' : 'Save schedule'}
                    </button>
                  </div>
                </form>

                <div className="form-grid">
                  <div className="field span-2">
                    <label htmlFor="flush-mode">Manual flush action</label>
                    <select
                      id="flush-mode"
                      className="select"
                      value={flushMode}
                      onChange={(event) => setFlushMode(event.target.value)}
                    >
                      {FLUSH_MODES.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field span-2">
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={flushing}
                      onClick={() => setConfirmOpen(true)}
                    >
                      {flushing ? 'Flushing…' : 'Flush Cloudflare Storage Now'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="dash-grid even mt-2">
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

      <Modal
        open={confirmOpen}
        onClose={() => !flushing && setConfirmOpen(false)}
        title="Confirm Cloudflare Storage Flush"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              disabled={flushing}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className="btn btn-danger" disabled={flushing} onClick={runFlush}>
              {flushing ? 'Flushing…' : 'Confirm flush'}
            </button>
          </>
        }
      >
        <p>
          Action: <strong>{FLUSH_MODES.find(([value]) => value === flushMode)?.[1]}</strong>
        </p>
        <p className="text-sm text-muted mt-1">
          Regular news article text and SEO links stay intact, and all{' '}
          <strong>{formatNumber(ads.files)} protected advertisement &amp; sponsored post files</strong> remain
          100% untouched.
        </p>
      </Modal>
    </>
  );
}
