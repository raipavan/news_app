import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useLocale } from '../../context/LocaleContext';
import { api, thumbnailUrl } from '../../lib/api';
import { EmptyState, PageLoading } from '../../components/ui';
import Modal from '../../components/Modal';
import { formatDateTime, statusLabel } from '../../lib/format';

export default function ReviewDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { notify } = useToast();
  const { lang } = useLocale();
  const { data, loading, error, reload } = useApi(`/articles/${id}`);
  const article = data?.article;

  const requested = searchParams.get('lang');
  const language =
    requested === 'kn' || requested === 'en'
      ? requested
      : article?.translations?.[0]?.language || 'en';
  const translation = article?.translations?.find((row) => row.language === language);
  const main = (article?.images || []).find((image) => image.image_type === 'main');
  const gallery = (article?.images || []).filter((image) => image.image_type === 'gallery');
  useDocumentTitle(translation ? `Review · ${translation.headline}` : 'Review');

  const [busy, setBusy] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comments, setComments] = useState('');
  const [actionError, setActionError] = useState('');

  if (loading && !data) return <PageLoading label="Opening the review desk" />;
  if (error) return <EmptyState title="Could not open this story" body={error.message} />;
  if (!article) return <EmptyState title="Article not found" />;

  const categoryName =
    language === 'kn' ? article.category_name_kn : article.category_name_en;
  const districtName =
    language === 'kn' ? article.district_name_kn : article.district_name_en;

  const history = (article.reviews || []).filter(
    (review) => !translation || review.translation_id === translation.id
  );
  const corrections = (article.revisions || []).filter(
    (revision) =>
      revision.snapshot?.correction_reason &&
      (!translation || revision.translation_id === translation.id)
  );

  const checklist = [
    ['Headline is clear and publishable', (translation?.headline || '').length >= 5],
    ['Summary explains the story', (translation?.summary || '').length >= 20],
    ['Main image attached', Boolean(main)],
    ['Body has substantial content', (translation?.content || '').replace(/<[^>]*>/g, '').length > 120],
    ['Source or credit recorded', Boolean(translation?.source)],
  ];

  const decide = async (decision) => {
    if (busy) return;
    setActionError('');
    setBusy(decision);
    try {
      if (decision === 'reject') {
        if (comments.trim().length < 5) {
          setActionError('Write a short reason so the author knows what to fix.');
          setBusy('');
          return;
        }
        await api.post(`/articles/${id}/reject`, { language, comments: comments.trim() });
        setRejectOpen(false);
        setComments('');
        notify('Language version rejected', 'success');
      } else if (decision === 'approve') {
        await api.post(`/articles/${id}/approve`, { language });
        notify('Approved — ready to publish', 'success');
      } else {
        await api.post(`/articles/${id}/publish`, { language });
        notify('Published to the site', 'success');
      }
      reload();
    } catch (err) {
      setActionError(err.message);
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const applyCorrection = async (revisionId) => {
    if (busy) return;
    if (!window.confirm('Apply this correction to the live language version?')) return;
    setBusy(`revision-${revisionId}`);
    try {
      await api.post(`/articles/${id}/revisions/${revisionId}/apply`);
      notify('Correction applied', 'success');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="mb-2">
        <Link className="back-link" to="/dashboard/review">← Review queue</Link>
      </div>

      <div className="page-head">
        <div>
          <span className="kicker">Editorial review</span>
          <h2>{translation?.headline || 'Untitled story'}</h2>
          <p>
            {article.author_name} · {article.author_email}
            {translation?.submitted_at
              ? ` · submitted ${formatDateTime(translation.submitted_at, lang)}`
              : ''}
          </p>
        </div>
        <div className="form-row">
          <Link className="btn btn-outline" to={`/dashboard/articles/${article.id}?lang=${language}`}>
            Open editor
          </Link>
          {translation?.status === 'published' ? (
            <a
              className="btn"
              href={`/${translation.language}/news/${translation.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              View live
            </a>
          ) : null}
        </div>
      </div>

      {actionError ? <div className="notice error">{actionError}</div> : null}

      <div className="tabs review-language-tabs">
        {article.translations.map((row) => (
          <button
            key={row.id}
            type="button"
            className={row.language === language ? 'active' : ''}
            onClick={() => setSearchParams({ lang: row.language })}
          >
            {row.language.toUpperCase()} · {statusLabel(row.status)}
          </button>
        ))}
      </div>

      <div className="review-layout">
        <div>
          <article className="preview-card">
            <span className="kicker">
              {categoryName || 'Uncategorised'}
              {districtName ? ` · ${districtName}` : ''}
            </span>
            <h1 className={language === 'kn' ? 'lang-kn' : ''}>{translation?.headline || 'Untitled'}</h1>
            {translation?.summary ? (
              <p className={`summary ${language === 'kn' ? 'lang-kn' : ''}`}>{translation.summary}</p>
            ) : null}

            <div className="preview-flag">
              <span className={`badge ${translation?.status || 'draft'}`}>
                {statusLabel(translation?.status)}
              </span>
              <span className="badge gold">{language.toUpperCase()}</span>
              {article.is_featured ? <span className="badge submitted">Featured</span> : null}
              {article.is_sponsored ? (
                <span className="sponsored-tag">{article.sponsor_label || 'Sponsored'}</span>
              ) : null}
            </div>

            {main ? (
              <figure className="article-figure">
                <img src={thumbnailUrl(main.id, 'optimized')} alt="" />
                {translation?.caption ? <figcaption>{translation.caption}</figcaption> : null}
              </figure>
            ) : (
              <div className="notice info">No main image has been attached to this story.</div>
            )}

            <div
              className={`preview-body ${language === 'kn' ? 'lang-kn' : ''}`}
              dangerouslySetInnerHTML={{ __html: translation?.content || '<p>No content yet.</p>' }}
            />

            {gallery.length ? (
              <div className="form-section">
                <h3>Gallery</h3>
                <div className="gallery-grid">
                  {gallery.map((image) => (
                    <img key={image.id} src={thumbnailUrl(image.id, 'thumb')} alt="" />
                  ))}
                </div>
              </div>
            ) : null}

            {(article.tags || []).length ? (
              <div className="article-tags">
                {article.tags.map((tag) => (
                  <span className="tag" key={tag.id}>{tag.name}</span>
                ))}
              </div>
            ) : null}

            {translation?.source ? (
              <p className="aside-note mt-2">Source: {translation.source}</p>
            ) : null}
          </article>

          {corrections.length ? (
            <section className="panel mt-2">
              <div className="panel-head"><h3>Correction requests</h3></div>
              <div className="panel-body">
                {corrections.map((revision) => (
                  <div className="correction-box" key={revision.id}>
                    <strong>{revision.note || 'Correction requested'}</strong>
                    <p>{revision.snapshot.correction_reason}</p>
                    <div className="status-line">
                      <span>{revision.editor_name || 'Author'}</span>
                      <span className="sep">·</span>
                      <span>{formatDateTime(revision.created_at, lang)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm mt-1"
                      disabled={busy === `revision-${revision.id}`}
                      onClick={() => applyCorrection(revision.id)}
                    >
                      {busy === `revision-${revision.id}` ? 'Applying…' : 'Apply correction'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel mt-2">
            <div className="panel-head"><h3>Review history</h3></div>
            <div className="panel-body flush">
              {history.length ? (
                <div className="list-check">
                  {history.map((review) => (
                    <div className="item" key={review.id}>
                      <div>
                        <h4>
                          <span className={`badge ${review.decision}`}>{statusLabel(review.decision)}</span>{' '}
                          {review.reviewer_name || 'Editor'}
                        </h4>
                        {review.comments ? <p className="text-sm mb-2">{review.comments}</p> : null}
                        <span className="meta">{formatDateTime(review.created_at, lang)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty" style={{ margin: 0, border: 0 }}>No reviews recorded yet.</div>
              )}
            </div>
          </section>
        </div>

        <aside className="editor-side">
          <section className="panel">
            <div className="panel-head"><h3>Decision</h3></div>
            <div className="panel-body">
              <div className="status-line mb-2">
                {translation ? (
                  <span className={`badge ${translation.status}`}>{statusLabel(translation.status)}</span>
                ) : (
                  <span className="badge draft">No version</span>
                )}
                <span className="badge gold">{language.toUpperCase()}</span>
              </div>

              {translation?.rejection_reason ? (
                <div className="rejection-box">
                  <strong>Rejection reason</strong>
                  <p>{translation.rejection_reason}</p>
                </div>
              ) : null}

              <div className="review-actions">
                {translation && ['submitted', 'in_review', 'rejected'].includes(translation.status) ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={Boolean(busy)}
                    onClick={() => decide('approve')}
                  >
                    {busy === 'approve' ? 'Approving…' : 'Approve language version'}
                  </button>
                ) : null}

                {translation?.status === 'approved' ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={Boolean(busy)}
                    onClick={() => decide('publish')}
                  >
                    {busy === 'publish' ? 'Publishing…' : 'Publish now'}
                  </button>
                ) : null}

                {translation && ['submitted', 'in_review', 'approved'].includes(translation.status) ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setActionError('');
                      setRejectOpen(true);
                    }}
                  >
                    Reject with reason
                  </button>
                ) : null}

                {translation?.status === 'published' ? (
                  <p className="aside-note">
                    This version is live. Submit a correction from the editor to change it.
                  </p>
                ) : null}
              </div>

              <p className="review-note">
                Approving unlocks publishing. Each language is reviewed and published independently, so a
                Kannada-only or English-only story works normally.
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Checklist</h3></div>
            <div className="panel-body">
              <ul className="review-checklist">
                {checklist.map(([label, passed]) => (
                  <li key={label} className={passed ? '' : 'miss'}>{label}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Story metadata</h3></div>
            <div className="panel-body">
              <p className="aside-note">
                Section: <strong>{article.category_name_en || '—'}</strong><br />
                District: <strong>{article.district_name_en || 'Statewide'}</strong><br />
                Article status: <strong>{statusLabel(article.status)}</strong><br />
                Views: <strong>{Number(article.view_count || 0).toLocaleString('en-IN')}</strong><br />
                Slug: <strong>{translation?.slug || '—'}</strong>
              </p>
              {translation?.seo_title || translation?.seo_description ? (
                <div className="form-section">
                  <h3>SEO preview</h3>
                  <p className="text-sm"><strong>{translation.seo_title || translation.headline}</strong></p>
                  <p className="aside-note">{translation.seo_description || translation.summary}</p>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this language version"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy === 'reject'}
              onClick={() => decide('reject')}
            >
              {busy === 'reject' ? 'Rejecting…' : 'Confirm rejection'}
            </button>
          </>
        }
      >
        <p>The author will see this note and can revise the draft before resubmitting.</p>
        <div className="field">
          <label htmlFor="reject-reason">Reason</label>
          <textarea
            id="reject-reason"
            className="textarea"
            rows={4}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            placeholder="Verify the source, correct the headline, add the missing image…"
          />
        </div>
        {actionError ? <div className="notice error">{actionError}</div> : null}
      </Modal>
    </>
  );
}
