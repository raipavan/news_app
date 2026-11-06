import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useToast } from '../../context/ToastContext';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { api, thumbnailUrl } from '../../lib/api';
import { EmptyState, PageLoading } from '../../components/ui';
import { GalleryUploader, ImageUploader } from '../../components/ImageUploader';
import RichEditor from '../../components/RichEditor';
import { formatDate, statusLabel, stripHtml } from '../../lib/format';

const LANGUAGES = [
  ['en', 'English'],
  ['kn', 'ಕನ್ನಡ Kannada'],
];

const BLANK = {
  headline: '',
  summary: '',
  content: '',
  slug: '',
  source: '',
  caption: '',
  seo_title: '',
  seo_description: '',
  category_id: '',
  district_id: '',
  taluk_id: '',
  tags: '',
};

export default function ArticleEditor() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isStaff } = useAuth();
  const { lang: uiLang } = useLocale();
  const { notify } = useToast();
  useDocumentTitle(id ? 'Edit article' : 'New article');

  const categoriesApi = useApi('/public/categories?lang=en');
  const districtsApi = useApi('/public/districts?lang=en');
  const articleApi = useApi(id ? `/articles/${id}` : '', { enabled: Boolean(id) });
  const article = articleApi.data?.article;

  const requestedLang = searchParams.get('lang');
  const language =
    requestedLang === 'kn' || requestedLang === 'en'
      ? requestedLang
      : article?.translations?.[0]?.language || 'en';

  const [form, setForm] = useState(BLANK);
  const [flags, setFlags] = useState({
    is_featured: false,
    is_sponsored: false,
    is_breaking: false,
    sponsor_label: '',
  });
  const [mainImage, setMainImage] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [taluks, setTaluks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const translation = article?.translations?.find((row) => row.language === language);
  const missingTranslation = Boolean(article) && !translation;
  const locked = Boolean(article) && !missingTranslation && !isStaff
    && !['draft', 'rejected'].includes(translation?.status);
  const canSubmit = !locked
    && (!id || missingTranslation || ['draft', 'rejected'].includes(translation?.status));

  useEffect(() => {
    if (!article) {
      if (!id) setForm(BLANK);
      return;
    }
    const row = article.translations?.find((item) => item.language === language);
    setForm({
      headline: row?.headline || '',
      summary: row?.summary || '',
      content: row?.content || '',
      slug: row?.slug || '',
      source: row?.source || '',
      caption: row?.caption || '',
      seo_title: row?.seo_title || '',
      seo_description: row?.seo_description || '',
      category_id: article.category_id || '',
      district_id: article.district_id ? String(article.district_id) : '',
      taluk_id: article.taluk_id ? String(article.taluk_id) : '',
      tags: (article.tags || []).map((tag) => tag.name).join(', '),
    });
    setFlags({
      is_featured: Boolean(article.is_featured),
      is_sponsored: Boolean(article.is_sponsored),
      is_breaking: Boolean(article.is_breaking),
      sponsor_label: article.sponsor_label || '',
    });
    const main = (article.images || []).find((img) => img.image_type === 'main');
    setMainImage(main ? { id: main.id, preview: thumbnailUrl(main.id, 'optimized') } : null);
    setGallery(
      (article.images || [])
        .filter((img) => img.image_type === 'gallery')
        .map((img) => ({ id: img.id, preview: thumbnailUrl(img.id, 'thumb') }))
    );
    setError('');
  }, [article, language, id]);

  const districtSlug = useMemo(() => {
    if (!form.district_id) return null;
    return (districtsApi.data?.items || []).find(
      (district) => String(district.id) === String(form.district_id)
    )?.slug;
  }, [form.district_id, districtsApi.data]);

  useEffect(() => {
    if (!districtSlug) {
      setTaluks([]);
      return undefined;
    }
    let active = true;
    api
      .get(`/public/districts/${districtSlug}/taluks?lang=${uiLang}`)
      .then((res) => {
        if (active) setTaluks(res.items || []);
      })
      .catch(() => {
        if (active) setTaluks([]);
      });
    return () => {
      active = false;
    };
  }, [districtSlug, uiLang]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const wordCount = useMemo(() => {
    const text = stripHtml(form.content).trim();
    return text ? text.split(/\s+/).length : 0;
  }, [form.content]);
  const readMinutes = Math.max(1, Math.round(wordCount / 180));

  const switchLanguage = (next) => {
    setError('');
    setSearchParams({ lang: next });
  };

  function buildPayload() {
    return {
      language,
      headline: form.headline.trim(),
      summary: form.summary.trim(),
      content: form.content,
      slug: form.slug.trim() || undefined,
      source: form.source.trim() || null,
      caption: form.caption.trim() || null,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      category_id: form.category_id,
      district_id: form.district_id ? Number(form.district_id) : null,
      taluk_id: form.taluk_id ? Number(form.taluk_id) : null,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12),
    };
  }

  const validate = (submit) => {
    if (form.headline.trim().length < 5) return 'Write a headline of at least 5 characters.';
    if (!form.category_id) return 'Choose a section for this story.';
    if (stripHtml(form.content).length < 10) return 'Write the story before saving.';
    if (submit && form.summary.trim().length < 20) {
      return 'Add a summary of at least 20 characters before submitting for review.';
    }
    if (submit && !mainImage) return 'Attach a main image before submitting for review.';
    return '';
  };

  const save = async (submit) => {
    if (saving || locked) return;
    const problem = validate(submit);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSaving(true);

    const payload = buildPayload();
    const imageFields = {
      main_image_id: mainImage?.id || null,
      image_ids: gallery.map((item) => item.id).filter((imageId) => imageId !== mainImage?.id),
    };
    const staffFields = isStaff
      ? {
          is_featured: flags.is_featured,
          is_sponsored: flags.is_sponsored,
          is_breaking: flags.is_breaking,
          sponsor_label: flags.is_sponsored ? flags.sponsor_label.trim() || null : null,
        }
      : {};

    try {
      if (!id) {
        const res = await api.post('/articles', { ...payload, ...imageFields, ...staffFields });
        const newId = res.article.id;
        if (submit) {
          try {
            await api.post(`/articles/${newId}/submit`, { language });
            notify('Story submitted for editorial review', 'success');
          } catch (submitError) {
            notify(`Draft saved, but not submitted: ${submitError.message}`, 'error');
          }
        } else {
          notify('Draft saved', 'success');
        }
        navigate(`/dashboard/articles/${newId}?lang=${language}`, { replace: true });
        return;
      }

      if (missingTranslation) {
        await api.post(`/articles/${id}/translations`, payload);
        if (submit) await api.post(`/articles/${id}/submit`, { language });
        notify(
          submit
            ? `${language.toUpperCase()} version added and submitted`
            : `${language.toUpperCase()} version added as a draft`,
          'success'
        );
        articleApi.reload();
        return;
      }

      await api.put(`/articles/${id}`, { ...payload, ...imageFields, ...staffFields });
      if (submit) {
        await api.post(`/articles/${id}/submit`, { language });
        notify('Submitted for editorial review', 'success');
      } else {
        notify('Changes saved', 'success');
      }
      articleApi.reload();
    } catch (err) {
      setError(err.message);
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (id && articleApi.loading && !article) return <PageLoading label="Opening the story" />;
  if (id && articleApi.error) {
    return <EmptyState title="Could not open this story" body={articleApi.error.message} />;
  }
  if (id && !article && !articleApi.loading) {
    return <EmptyState title="Article not found" body="It may have been archived or removed." />;
  }

  const categories = categoriesApi.data?.items || [];
  const districts = districtsApi.data?.items || [];
  const languageName = LANGUAGES.find(([code]) => code === language)?.[1] || language;
  const heading = !id
    ? 'New story'
    : missingTranslation
      ? `Add ${languageName.split(' ')[0]} version`
      : 'Edit story';

  return (
    <>
      <div className="mb-2">
        <Link className="back-link" to="/dashboard/articles">← All articles</Link>
      </div>

      <div className="page-head">
        <div>
          <span className="kicker">{isStaff ? 'Editorial desk' : 'Community desk'}</span>
          <h2>{heading}</h2>
          <p>
            {id
              ? `${article?.author_name || 'Unknown author'} · updated ${formatDate(article?.updated_at, uiLang)}`
              : 'Draft the story, attach a photo, then send it to the desk for review.'}
          </p>
        </div>
        <div className="form-row">
          {translation?.status === 'published' ? (
            <a
              className="btn btn-outline"
              href={`/${translation.language}/news/${translation.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              View live
            </a>
          ) : null}
          <button
            type="button"
            className="btn btn-outline"
            disabled={saving || locked}
            onClick={() => save(false)}
          >
            {saving ? 'Saving…' : missingTranslation ? 'Save translation' : 'Save draft'}
          </button>
          {canSubmit ? (
            <button type="button" className="btn" disabled={saving || locked} onClick={() => save(true)}>
              {saving ? 'Working…' : 'Save & submit'}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      {locked ? (
        <div className="notice info">
          This language version is {statusLabel(translation?.status).toLowerCase()} and locked. An editor must
          reopen or reject it before changes can be made.
        </div>
      ) : null}

      {missingTranslation ? (
        <div className="notice info">
          This story already exists. You are adding a new {languageName} version; the section, district and
          images are shared across languages.
        </div>
      ) : null}

      {translation?.status === 'rejected' && translation.rejection_reason ? (
        <div className="rejection-box mb-2">
          <strong>Editor’s note</strong>
          <p>{translation.rejection_reason}</p>
        </div>
      ) : null}

      <div className="editor-layout">
        <div className="editor-main">
          <section className="panel">
            <div className="panel-body">
              <div className="tabs review-language-tabs">
                {LANGUAGES.map(([code, label]) => {
                  const version = article?.translations?.find((row) => row.language === code);
                  const known = article ? Boolean(version) : code === language;
                  return (
                    <button
                      key={code}
                      type="button"
                      className={language === code ? 'active' : ''}
                      onClick={() => switchLanguage(code)}
                      title={known ? `Edit ${label}` : `Add ${label} version`}
                    >
                      {code.toUpperCase()} · {version ? statusLabel(version.status) : 'New'}
                    </button>
                  );
                })}
              </div>

              <div className="field">
                <label htmlFor="headline">Headline</label>
                <input
                  id="headline"
                  className="input editor-title-input"
                  value={form.headline}
                  maxLength={300}
                  disabled={locked}
                  onChange={(event) => set('headline', event.target.value)}
                  placeholder={language === 'kn' ? 'ಸುದ್ದಿಯ ಶೀರ್ಷಿಕೆ' : 'The headline readers will see'}
                />
              </div>

              <div className="field">
                <label htmlFor="summary">Summary</label>
                <textarea
                  id="summary"
                  className="textarea"
                  rows={3}
                  maxLength={2000}
                  value={form.summary}
                  disabled={locked}
                  onChange={(event) => set('summary', event.target.value)}
                  placeholder="One or two sentences that explain why this matters."
                />
                <span className="hint">At least 20 characters is required before submitting for review.</span>
              </div>

              <div className="field">
                <label>Story</label>
                <RichEditor
                  value={form.content}
                  onChange={(html) => set('content', html)}
                  language={language}
                  readOnly={locked}
                  library={gallery}
                  placeholder={language === 'kn' ? 'ಕಥೆಯನ್ನು ಇಲ್ಲಿ ಬರೆಯಿರಿ…' : 'Write the story…'}
                />
                <div className="editor-meta-row">
                  <span>
                    {wordCount.toLocaleString('en-IN')} words · about {readMinutes} min read
                  </span>
                  <span>Drop or paste a photo anywhere, then click it to align, resize or caption it.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Details &amp; SEO</h3>
            </div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="slug">URL slug</label>
                  <input
                    id="slug"
                    className="input"
                    value={form.slug}
                    disabled={locked}
                    onChange={(event) => set('slug', event.target.value)}
                    placeholder="auto-generated-from-headline"
                  />
                  <span className="hint">Leave blank to generate it from the headline.</span>
                </div>
                <div className="field">
                  <label htmlFor="source">Source / credit</label>
                  <input
                    id="source"
                    className="input"
                    value={form.source}
                    disabled={locked}
                    onChange={(event) => set('source', event.target.value)}
                    placeholder="Agency, correspondent or publication"
                  />
                </div>
                <div className="field span-2">
                  <label htmlFor="caption">Main image caption</label>
                  <input
                    id="caption"
                    className="input"
                    value={form.caption}
                    disabled={locked}
                    onChange={(event) => set('caption', event.target.value)}
                    placeholder="Describe what the photo shows"
                  />
                </div>
                <div className="field">
                  <label htmlFor="seo-title">SEO title</label>
                  <input
                    id="seo-title"
                    className="input"
                    value={form.seo_title}
                    maxLength={300}
                    disabled={locked}
                    onChange={(event) => set('seo_title', event.target.value)}
                    placeholder="Defaults to the headline"
                  />
                </div>
                <div className="field">
                  <label htmlFor="seo-description">SEO description</label>
                  <textarea
                    id="seo-description"
                    className="textarea"
                    rows={2}
                    maxLength={600}
                    value={form.seo_description}
                    disabled={locked}
                    onChange={(event) => set('seo_description', event.target.value)}
                    placeholder="Search and social preview text"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="editor-side">
          <section className="panel">
            <div className="panel-head"><h3>Publication</h3></div>
            <div className="panel-body">
              <div className="field">
                <label htmlFor="category">Section</label>
                <select
                  id="category"
                  className="select"
                  value={form.category_id}
                  disabled={locked}
                  onChange={(event) => set('category_id', event.target.value)}
                >
                  <option value="">Choose a section</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name_en}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="district">District</label>
                <select
                  id="district"
                  className="select"
                  value={form.district_id}
                  disabled={locked}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, district_id: event.target.value, taluk_id: '' }))
                  }
                >
                  <option value="">Statewide / no district</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>{district.name_en}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="taluk">Taluk</label>
                <select
                  id="taluk"
                  className="select"
                  value={form.taluk_id}
                  disabled={locked || !form.district_id || !taluks.length}
                  onChange={(event) => set('taluk_id', event.target.value)}
                >
                  <option value="">
                    {!form.district_id
                      ? 'Select a district first'
                      : taluks.length
                        ? 'No specific taluk'
                        : 'No taluks listed'}
                  </option>
                  {taluks.map((taluk) => (
                    <option key={taluk.id} value={taluk.id}>{taluk.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="tags">Tags</label>
                <input
                  id="tags"
                  className="input"
                  value={form.tags}
                  disabled={locked}
                  onChange={(event) => set('tags', event.target.value)}
                  placeholder="bengaluru, traffic, monsoon"
                />
                <span className="hint">Comma separated, up to 12 tags.</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Images</h3></div>
            <div className="panel-body">
              {missingTranslation ? (
                mainImage?.preview ? (
                  <>
                    <div className="upload-preview">
                      <img src={mainImage.preview} alt="" />
                    </div>
                    <p className="aside-note mt-1">The main image is shared by every language version.</p>
                  </>
                ) : (
                  <p className="aside-note">No main image yet. Add one from the original language version.</p>
                )
              ) : (
                <>
                  <ImageUploader
                    value={mainImage}
                    onChange={setMainImage}
                    label="Main image"
                    hint="JPG, PNG, WebP or GIF · max 8 MB · min 200×150"
                  />
                  <GalleryUploader items={gallery} onChange={setGallery} />
                </>
              )}
            </div>
          </section>

          {isStaff ? (
            <section className="panel">
              <div className="panel-head"><h3>Editorial flags</h3></div>
              <div className="panel-body">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={flags.is_featured}
                    disabled={locked}
                    onChange={(event) => setFlags((prev) => ({ ...prev, is_featured: event.target.checked }))}
                  />
                  Feature on the homepage
                </label>
                <label className="check mt-1">
                  <input
                    type="checkbox"
                    checked={flags.is_breaking}
                    disabled={locked}
                    onChange={(event) => setFlags((prev) => ({ ...prev, is_breaking: event.target.checked }))}
                  />
                  Breaking news — show in the top ticker
                </label>
                <label className="check mt-1">
                  <input
                    type="checkbox"
                    checked={flags.is_sponsored}
                    disabled={locked}
                    onChange={(event) => setFlags((prev) => ({ ...prev, is_sponsored: event.target.checked }))}
                  />
                  Sponsored / paid content
                </label>
                {flags.is_sponsored ? (
                  <div className="field mt-1">
                    <label htmlFor="sponsor-label">Sponsor label</label>
                    <input
                      id="sponsor-label"
                      className="input"
                      value={flags.sponsor_label}
                      disabled={locked}
                      onChange={(event) =>
                        setFlags((prev) => ({ ...prev, sponsor_label: event.target.value }))
                      }
                      placeholder="Presented by …"
                    />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-head"><h3>Workflow</h3></div>
            <div className="panel-body">
              <div className="status-line">
                <span className="badge gold">{language.toUpperCase()}</span>
                {translation ? (
                  <span className={`badge ${translation.status}`}>{statusLabel(translation.status)}</span>
                ) : (
                  <span className="badge draft">Not translated</span>
                )}
              </div>
              {article ? (
                <>
                  <p className="aside-note mt-1">
                    Article status: <strong>{statusLabel(article.status)}</strong>
                    {article.view_count ? ` · ${Number(article.view_count).toLocaleString('en-IN')} views` : ''}
                  </p>
                  {translation?.reviewer_name ? (
                    <p className="aside-note">Last reviewed by {translation.reviewer_name}.</p>
                  ) : null}
                </>
              ) : (
                <p className="aside-note mt-1">
                  Start in any language. You can add the other language version after the first save.
                </p>
              )}
              {canSubmit ? (
                <button
                  type="button"
                  className="btn btn-block mt-2"
                  disabled={saving || locked}
                  onClick={() => save(true)}
                >
                  {saving ? 'Working…' : 'Submit for review'}
                </button>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
