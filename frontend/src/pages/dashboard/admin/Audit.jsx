import { useMemo, useState } from 'react';
import { useApi, useDocumentTitle } from '../../../hooks/useApi';
import { EmptyState, PageLoading } from '../../../components/ui';
import { formatDateTime, titleCase } from '../../../lib/format';

export default function Audit() {
  const { data, loading, error } = useApi('/admin/audit-logs?limit=200');
  const [filter, setFilter] = useState('');
  useDocumentTitle('Audit log');

  const items = useMemo(() => {
    const rows = data?.items || [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.action, row.entity, row.user_name, row.entity_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [data, filter]);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Administration</span>
          <h2>Audit log</h2>
          <p>An immutable trail of editorial, moderation and administrative actions.</p>
        </div>
      </div>

      <div className="filters">
        <input
          className="input"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by action, user or entity"
          aria-label="Filter audit log"
        />
        <span className="spacer" />
        <span className="text-sm text-muted">{items.length} entries</span>
      </div>

      {loading && !data ? (
        <PageLoading />
      ) : error ? (
        <EmptyState title="Could not load the audit log" body={error.message} />
      ) : items.length ? (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="nowrap text-sm">{formatDateTime(row.created_at)}</td>
                    <td className="text-sm">{row.user_name || 'System'}</td>
                    <td>
                      <span className="badge draft">{row.action}</span>
                    </td>
                    <td className="text-sm">
                      {titleCase(row.entity || '—')}
                      {row.entity_id ? (
                        <small className="text-muted" style={{ display: 'block', fontSize: 10 }}>
                          {row.entity_id}
                        </small>
                      ) : null}
                    </td>
                    <td className="text-sm" style={{ maxWidth: 360 }}>
                      {row.details && Object.keys(row.details).length ? (
                        <details>
                          <summary className="link-btn">View payload</summary>
                          <pre
                            className="text-sm"
                            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '6px 0 0' }}
                          >
                            {JSON.stringify(row.details, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState title="No matching entries" body="Try a different filter." />
      )}
    </>
  );
}
