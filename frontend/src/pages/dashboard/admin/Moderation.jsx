import { useState } from 'react';
import { useApi, useDocumentTitle } from '../../../hooks/useApi';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { api } from '../../../lib/api';
import { EmptyState, PageLoading } from '../../../components/ui';
import Modal from '../../../components/Modal';
import { formatDateTime, statusLabel } from '../../../lib/format';

const COMMENT_TABS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['', 'All'],
];
const REPORT_TABS = [
  ['open', 'Open'],
  ['resolved', 'Resolved'],
  ['dismissed', 'Dismissed'],
];

export default function Moderation() {
  const { notify } = useToast();
  const { lang } = useLocale();
  const [commentStatus, setCommentStatus] = useState('pending');
  const [reportStatus, setReportStatus] = useState('open');
  const commentsApi = useApi(
    `/admin/comments?limit=100${commentStatus ? `&status=${commentStatus}` : ''}`
  );
  const reportsApi = useApi(`/admin/reports?status=${reportStatus}`);
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState(null);
  const [notes, setNotes] = useState('');
  const [reportDecision, setReportDecision] = useState('resolved');
  const [formError, setFormError] = useState('');
  useDocumentTitle('Moderation');

  const moderate = async (comment, status) => {
    setBusy(comment.id);
    try {
      await api.put(`/admin/comments/${comment.id}`, { status });
      notify(`Comment ${status}`, 'success');
      commentsApi.reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const openReport = (item, decision) => {
    setReport(item);
    setReportDecision(decision);
    setNotes(item.notes || '');
    setFormError('');
  };

  const resolveReport = async () => {
    setBusy('report');
    try {
      await api.put(`/admin/reports/${report.id}`, {
        status: reportDecision,
        notes: notes.trim() || null,
      });
      notify(`Report ${reportDecision}`, 'success');
      setReport(null);
      reportsApi.reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy('');
    }
  };

  const comments = commentsApi.data?.items || [];
  const reports = reportsApi.data?.items || [];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Editorial desk</span>
          <h2>Moderation</h2>
          <p>Reader comments and reports on published stories.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Comments</h3>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 0 }}>
            {COMMENT_TABS.map(([value, label]) => (
              <button
                key={value || 'all'}
                type="button"
                className={commentStatus === value ? 'active' : ''}
                onClick={() => setCommentStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {commentsApi.loading && !commentsApi.data ? (
          <PageLoading />
        ) : commentsApi.error ? (
          <div className="panel-body"><div className="notice error">{commentsApi.error.message}</div></div>
        ) : comments.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Comment</th>
                  <th>Story</th>
                  <th>Reader</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {comments.map((comment) => (
                  <tr key={comment.id}>
                    <td className="title-cell" style={{ maxWidth: 380 }}>{comment.content}</td>
                    <td className="text-sm">
                      <a href={`/${comment.language}/news/${comment.slug}`} target="_blank" rel="noreferrer">
                        {comment.headline}
                      </a>
                    </td>
                    <td className="text-sm">{comment.user_name}</td>
                    <td><span className={`badge ${comment.status}`}>{statusLabel(comment.status)}</span></td>
                    <td className="nowrap text-sm">{formatDateTime(comment.created_at, lang)}</td>
                    <td className="right">
                      <div className="row-actions">
                        {comment.status !== 'approved' ? (
                          <button
                            type="button"
                            className="btn btn-xs"
                            disabled={busy === comment.id}
                            onClick={() => moderate(comment, 'approved')}
                          >
                            Approve
                          </button>
                        ) : null}
                        {comment.status !== 'rejected' ? (
                          <button
                            type="button"
                            className="btn btn-xs btn-danger"
                            disabled={busy === comment.id}
                            onClick={() => moderate(comment, 'rejected')}
                          >
                            Reject
                          </button>
                        ) : null}
                        {comment.status !== 'pending' ? (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline"
                            disabled={busy === comment.id}
                            onClick={() => moderate(comment, 'pending')}
                          >
                            Re-queue
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty" style={{ margin: 0, border: 0 }}>
            <h3>Nothing to moderate</h3>
            <p>No comments in this state.</p>
          </div>
        )}
      </section>

      <section className="panel mt-2">
        <div className="panel-head">
          <h3>Reader reports</h3>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 0 }}>
            {REPORT_TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={reportStatus === value ? 'active' : ''}
                onClick={() => setReportStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {reportsApi.loading && !reportsApi.data ? (
          <PageLoading />
        ) : reportsApi.error ? (
          <div className="panel-body"><div className="notice error">{reportsApi.error.message}</div></div>
        ) : reports.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Story</th>
                  <th>Reported by</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((item) => (
                  <tr key={item.id}>
                    <td className="title-cell" style={{ maxWidth: 380 }}>
                      {item.reason}
                      {item.notes ? <small>Notes: {item.notes}</small> : null}
                    </td>
                    <td className="text-sm">
                      <a href={`/${item.language}/news/${item.slug}`} target="_blank" rel="noreferrer">
                        {item.headline}
                      </a>
                    </td>
                    <td className="text-sm">{item.reporter_name || 'Anonymous'}</td>
                    <td><span className={`badge ${item.status}`}>{statusLabel(item.status)}</span></td>
                    <td className="nowrap text-sm">{formatDateTime(item.created_at, lang)}</td>
                    <td className="right">
                      <div className="row-actions">
                        {item.status === 'open' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-xs"
                              onClick={() => openReport(item, 'resolved')}
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-outline"
                              onClick={() => openReport(item, 'dismissed')}
                            >
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-muted">
                            {item.resolved_at ? formatDateTime(item.resolved_at, lang) : 'Closed'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty" style={{ margin: 0, border: 0 }}>
            <h3>No reports</h3>
            <p>No reader reports in this state.</p>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(report)}
        onClose={() => setReport(null)}
        title={reportDecision === 'resolved' ? 'Resolve report' : 'Dismiss report'}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setReport(null)}>Cancel</button>
            <button type="button" className="btn" disabled={busy === 'report'} onClick={resolveReport}>
              {busy === 'report' ? 'Saving…' : 'Confirm'}
            </button>
          </>
        }
      >
        <p>{report?.reason}</p>
        <div className="field">
          <label htmlFor="report-notes">Internal note</label>
          <textarea
            id="report-notes"
            className="textarea"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What action was taken?"
          />
        </div>
        {formError ? <div className="notice error">{formError}</div> : null}
      </Modal>
    </>
  );
}
