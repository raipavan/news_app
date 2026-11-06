import { useEffect, useRef, useState } from 'react';
import { useApi, useDocumentTitle } from '../../../hooks/useApi';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import { EmptyState, PageLoading } from '../../../components/ui';
import { ImageUploader } from '../../../components/ImageUploader';
import Modal from '../../../components/Modal';
import { formatDate, formatNumber, statusLabel, titleCase } from '../../../lib/format';

const PLACEMENTS = [
  ['home_top', 'Homepage · top'],
  ['home_hero', 'Homepage · below hero'],
  ['home_mid', 'Homepage · sidebar'],
  ['home_sidebar', 'Homepage · extra sidebar'],
  ['home_after_latest', 'Homepage · after latest stories'],
  ['home_between_sections', 'Homepage · between category sections'],
  ['home_bottom', 'Homepage · bottom'],
  ['article_top', 'Article · top'],
  ['article_mid', 'Article · after first paragraph'],
  ['article_inline_second', 'Article · after second paragraph'],
  ['article_before_comments', 'Article · above comments'],
  ['article_bottom', 'Article · end of content'],
  ['article_sidebar', 'Article · sidebar'],
  ['article_sidebar_bottom', 'Article · sidebar bottom'],
  ['category', 'Category pages · top'],
  ['category_bottom', 'Category pages · bottom'],
  ['latest_top', 'Latest page · top'],
  ['latest_bottom', 'Latest page · bottom'],
  ['district_top', 'District pages · top'],
  ['district_bottom', 'District pages · bottom'],
  ['search_top', 'Search results · top'],
  ['search_bottom', 'Search results · bottom'],
  ['global_top', 'Every page · top'],
  ['global_bottom', 'Every page · bottom'],
  ['footer', 'Site footer'],
];
const PLACEMENT_LABELS = Object.fromEntries(PLACEMENTS);
const STATUSES = ['draft', 'active', 'paused', 'expired'];

const SIZE_PRESETS = [
  { label: 'Full width', width: 100, height: '' },
  { label: 'Leaderboard', width: 100, height: 120 },
  { label: 'Billboard', width: 100, height: 250 },
  { label: 'Compact', width: 75, height: 120 },
  { label: 'Square', width: 50, height: 250 },
  { label: 'Skyscraper', width: 40, height: 600 },
];

const EMPTY = {
  title: '',
  advertiser_name: '',
  destination_url: '',
  placement: 'home_top',
  target_mode: 'all',
  target_category_id: '',
  target_district_id: '',
  target_path: '',
  status: 'draft',
  is_sponsored: false,
  amount_paid: 0,
  display_width: 100,
  max_height: '',
  image_fit: 'cover',
  starts_at: '',
  ends_at: '',
  overrides: [],
};

function toLocalInput(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function AdSizePreview({ form, image, onChange }) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return undefined;
    const handleMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const width = Math.round(
        Math.min(100, Math.max(25, drag.width + ((event.clientX - drag.x) / drag.stageWidth) * 100))
      );
      const height = Math.round(Math.min(800, Math.max(40, drag.height + (event.clientY - drag.y))));
      onChange({ display_width: width, max_height: String(height) });
    };
    const stop = () => setDragging(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [dragging, onChange]);

  const startDrag = (event) => {
    event.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const slot = stage.querySelector('.ad-preview-slot');
    const rect = slot?.getBoundingClientRect() || stage.getBoundingClientRect();
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: Number(form.display_width) || 100,
      height: Number(form.max_height) || Math.round(rect.height) || 120,
      stageWidth: stage.getBoundingClientRect().width || 1,
    };
    setDragging(true);
  };

  const imageStyle = { objectFit: form.image_fit };
  if (form.max_height !== '') imageStyle.height = `${Number(form.max_height) || 0}px`;

  return (
    <div className="ad-size-editor">
      <div className="ad-size-head">
        <strong>Live creative preview</strong>
        <span>
          {form.display_width}% wide ·{' '}
          {form.max_height === '' ? 'natural height' : `${form.max_height}px tall`}
        </span>
      </div>
      <div className="ad-preview-frame">
        <span className="ad-label">Advertisement</span>
        <div className="ad-preview-stage" ref={stageRef}>
          {image?.preview ? (
            <div className="ad-preview-slot" style={{ width: `${form.display_width}%` }}>
              <img src={image.preview} alt="" style={imageStyle} />
              <button
                type="button"
                className={`ad-preview-handle ${dragging ? 'dragging' : ''}`}
                aria-label="Drag to resize the creative"
                title="Drag to resize"
                onPointerDown={startDrag}
              />
            </div>
          ) : (
            <p className="ad-preview-empty">Upload a creative image to preview its live size here.</p>
          )}
        </div>
      </div>
      <div className="preset-row" role="group" aria-label="Size presets">
        {SIZE_PRESETS.map((preset) => {
          const active =
            Number(form.display_width) === preset.width &&
            String(form.max_height) === String(preset.height);
          return (
            <button
              key={preset.label}
              type="button"
              className={`preset-btn ${active ? 'active' : ''}`}
              onClick={() => onChange({ display_width: preset.width, max_height: preset.height })}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="size-fields">
        <div className="field">
          <label htmlFor="ad-width">Width · {form.display_width}%</label>
          <input
            id="ad-width"
            type="range"
            min="25"
            max="100"
            step="5"
            className="range"
            value={form.display_width}
            onChange={(event) => onChange({ display_width: Number(event.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="ad-height">
            Image height · {form.max_height === '' ? 'natural' : `${form.max_height}px`}
          </label>
          <input
            id="ad-height"
            type="range"
            min="40"
            max="800"
            step="10"
            className="range"
            value={form.max_height === '' ? 250 : Number(form.max_height)}
            onChange={(event) => onChange({ max_height: event.target.value })}
          />
          <button type="button" className="link-btn" onClick={() => onChange({ max_height: '' })}>
            Use natural height
          </button>
        </div>
        <div className="field span-2">
          <label htmlFor="ad-fit">Image fit</label>
          <select
            id="ad-fit"
            className="select"
            value={form.image_fit}
            onChange={(event) => onChange({ image_fit: event.target.value })}
          >
            <option value="cover">Cover — crop to fill</option>
            <option value="contain">Contain — letterbox</option>
          </select>
          <span className="hint">
            Drag the corner handle in the preview, or use the sliders, to adjust width and height live.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Ads() {
  const { notify } = useToast();
  const { data, loading, error, reload } = useApi('/admin/advertisements');
  const { data: categoriesData } = useApi('/public/categories?lang=en', { initialData: { items: [] } });
  const { data: districtsData } = useApi('/public/districts?lang=en', { initialData: { items: [] } });
  const items = data?.items || [];
  const categories = categoriesData?.items || [];
  const districts = districtsData?.items || [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState('');
  const [formError, setFormError] = useState('');
  useDocumentTitle('Advertisements');

  const totals = items.reduce(
    (acc, ad) => {
      acc.impressions += Number(ad.impressions) || 0;
      acc.clicks += Number(ad.clicks) || 0;
      if (ad.status === 'active') acc.active += 1;
      return acc;
    },
    { impressions: 0, clicks: 0, active: 0 }
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setImage(null);
    setFormError('');
    setOpen(true);
  };

  const openEdit = (ad) => {
    setEditing(ad);
    setForm({
      title: ad.title,
      advertiser_name: ad.advertiser_name || '',
      destination_url: ad.destination_url,
      placement: ad.placement,
      target_mode: ad.target_path
        ? 'path'
        : ad.target_category_id
          ? 'category'
          : ad.target_district_id
            ? 'district'
            : 'all',
      target_category_id: ad.target_category_id || '',
      target_district_id: ad.target_district_id ? String(ad.target_district_id) : '',
      target_path: ad.target_path || '',
      status: ad.status,
      is_sponsored: Boolean(ad.is_sponsored),
      amount_paid: Number(ad.amount_paid) || 0,
      display_width: Number(ad.display_width) || 100,
      max_height: ad.max_height ? String(ad.max_height) : '',
      image_fit: ad.image_fit || 'cover',
      starts_at: toLocalInput(ad.starts_at),
      ends_at: toLocalInput(ad.ends_at),
      overrides: (ad.overrides || []).map((override) => ({
        placement: override.placement,
        destination_url: override.destination_url || '',
        starts_at: toLocalInput(override.starts_at),
        ends_at: toLocalInput(override.ends_at),
      })),
    });
    setImage(ad.image ? { id: ad.image_id, preview: ad.image.thumb || ad.image.optimized } : null);
    setFormError('');
    setOpen(true);
  };

  const addOverride = () => {
    const used = new Set(form.overrides.map((override) => override.placement));
    const placement = PLACEMENTS.map(([value]) => value).find((value) => !used.has(value)) || '';
    setForm((prev) => ({
      ...prev,
      overrides: [...prev.overrides, { placement, destination_url: '', starts_at: '', ends_at: '' }],
    }));
  };

  const updateOverride = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      overrides: prev.overrides.map((override, itemIndex) =>
        itemIndex === index ? { ...override, ...patch } : override
      ),
    }));
  };

  const removeOverride = (index) => {
    setForm((prev) => ({
      ...prev,
      overrides: prev.overrides.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.title.trim()) {
      setFormError('Add a campaign title.');
      return;
    }
    if (form.target_mode === 'category' && !form.target_category_id) {
      setFormError('Choose the category this campaign should run on.');
      return;
    }
    if (form.target_mode === 'district' && !form.target_district_id) {
      setFormError('Choose the district this campaign should run on.');
      return;
    }
    if (form.target_mode === 'path') {
      const value = form.target_path.trim();
      if (!value) {
        setFormError('Enter the page path or URL pattern this campaign should run on.');
        return;
      }
      if (!value.startsWith('/') || /[\s?#]/.test(value)) {
        setFormError('Page path must start with / and cannot contain spaces, ? or #.');
        return;
      }
    }
    if (form.max_height !== '' && (Number(form.max_height) < 40 || Number(form.max_height) > 800)) {
      setFormError('Max height must be between 40 and 800 pixels, or left empty.');
      return;
    }
    try {
      const parsed = new URL(form.destination_url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
    } catch {
      setFormError('The destination must be a full URL beginning with http:// or https://');
      return;
    }
    const seenOverrides = new Set();
    for (const override of form.overrides) {
      if (!override.placement) {
        setFormError('Choose a placement for every override.');
        return;
      }
      if (seenOverrides.has(override.placement)) {
        setFormError('Each placement can only have one override.');
        return;
      }
      seenOverrides.add(override.placement);
      if (override.destination_url.trim()) {
        try {
          const parsed = new URL(override.destination_url.trim());
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
        } catch {
          setFormError('Override destinations must begin with http:// or https://');
          return;
        }
      }
    }
    setBusy('save');
    try {
      const body = {
        title: form.title.trim(),
        advertiser_name: form.advertiser_name.trim() || null,
        image_id: image?.id || null,
        destination_url: form.destination_url.trim(),
        placement: form.placement,
        target_category_id: form.target_mode === 'category' ? form.target_category_id : null,
        target_district_id:
          form.target_mode === 'district' && form.target_district_id
            ? Number(form.target_district_id)
            : null,
        target_path: form.target_mode === 'path' ? form.target_path.trim() : null,
        status: form.status,
        is_sponsored: form.is_sponsored,
        amount_paid: Number(form.amount_paid) || 0,
        display_width: Number(form.display_width) || 100,
        max_height: form.max_height === '' ? null : Number(form.max_height),
        image_fit: form.image_fit,
        starts_at: toIso(form.starts_at),
        ends_at: toIso(form.ends_at),
        overrides: form.overrides.map((override) => ({
          placement: override.placement,
          destination_url: override.destination_url.trim() || null,
          starts_at: toIso(override.starts_at),
          ends_at: toIso(override.ends_at),
        })),
      };
      if (editing) {
        await api.put(`/admin/advertisements/${editing.id}`, body);
        notify('Advertisement updated', 'success');
      } else {
        await api.post('/admin/advertisements', body);
        notify('Advertisement created', 'success');
      }
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy('');
    }
  };

  const toggleStatus = async (ad) => {
    const next = ad.status === 'active' ? 'paused' : 'active';
    setBusy(ad.id);
    try {
      await api.put(`/admin/advertisements/${ad.id}`, { status: next });
      notify(next === 'active' ? 'Campaign is live' : 'Campaign paused', 'success');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const remove = async (ad) => {
    if (!window.confirm(`Delete “${ad.title}”? This cannot be undone.`)) return;
    setBusy(ad.id);
    try {
      await api.del(`/admin/advertisements/${ad.id}`);
      notify('Advertisement deleted', 'success');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Revenue</span>
          <h2>Advertisements</h2>
          <p>Homepage and article placements, sponsored campaigns and performance.</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>New advertisement</button>
      </div>

      <div className="metric-grid cols-3">
        <div className="metric green">
          <div className="metric-label">Active campaigns</div>
          <div className="metric-value">{totals.active}</div>
          <div className="metric-sub">Currently serving</div>
        </div>
        <div className="metric">
          <div className="metric-label">Impressions</div>
          <div className="metric-value">{formatNumber(totals.impressions)}</div>
          <div className="metric-sub">All campaigns</div>
        </div>
        <div className="metric gold">
          <div className="metric-label">Clicks</div>
          <div className="metric-value">{formatNumber(totals.clicks)}</div>
          <div className="metric-sub">
            {totals.impressions
              ? `${((totals.clicks / totals.impressions) * 100).toFixed(1)}% CTR`
              : 'No impressions yet'}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <PageLoading />
      ) : error ? (
        <EmptyState title="Could not load advertisements" body={error.message} />
      ) : items.length ? (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Placement</th>
                  <th>Runs on</th>
                  <th>Status</th>
                  <th>Schedule</th>
                  <th className="right">Impr.</th>
                  <th className="right">Clicks</th>
                  <th className="right">Paid</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ad) => (
                  <tr key={ad.id}>
                    <td className="title-cell">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {ad.image?.thumb ? (
                          <img
                            src={ad.image.thumb}
                            alt=""
                            width="54"
                            height="36"
                            style={{ objectFit: 'cover', flex: '0 0 auto' }}
                          />
                        ) : (
                          <span
                            className="thumb-fallback"
                            style={{ width: 54, height: 36, fontSize: 14, flex: '0 0 auto' }}
                          >
                            AD
                          </span>
                        )}
                        <span>
                          {ad.title}
                          <small>{ad.advertiser_name || ad.destination_url}</small>
                        </span>
                      </div>
                    </td>
                    <td className="text-sm">
                      {PLACEMENT_LABELS[ad.placement] || titleCase(ad.placement)}
                      <small className="text-muted" style={{ display: 'block' }}>
                        {ad.display_width}% wide
                        {ad.max_height ? ` · ${ad.max_height}px` : ''}
                        {ad.overrides?.length
                          ? ` · ${ad.overrides.length} override${ad.overrides.length === 1 ? '' : 's'}`
                          : ''}
                      </small>
                    </td>
                    <td className="text-sm">
                      {ad.target_path || ad.target_category_name || ad.target_district_name || 'All content'}
                      <small className="text-muted" style={{ display: 'block' }}>
                        {ad.target_path
                          ? 'Page URL only'
                          : ad.target_category_name
                            ? 'Category only'
                            : ad.target_district_name
                              ? 'District only'
                              : 'Every page'}
                      </small>
                    </td>
                    <td>
                      <span className={`badge ${ad.status}`}>{statusLabel(ad.status)}</span>
                      {ad.is_sponsored ? <span className="badge gold" style={{ marginLeft: 4 }}>Paid</span> : null}
                    </td>
                    <td className="text-sm nowrap">
                      {ad.starts_at ? formatDate(ad.starts_at) : 'Always'}
                      <small className="text-muted" style={{ display: 'block' }}>
                        {ad.ends_at ? `until ${formatDate(ad.ends_at)}` : 'no end date'}
                      </small>
                    </td>
                    <td className="right num">{formatNumber(ad.impressions)}</td>
                    <td className="right num">
                      {formatNumber(ad.clicks)}
                      {Number(ad.unique_visitors) > 0 ? (
                        <small className="text-muted" style={{ display: 'block' }}>
                          {formatNumber(ad.unique_visitors)} unique
                        </small>
                      ) : null}
                    </td>
                    <td className="right num">₹{formatNumber(ad.amount_paid)}</td>
                    <td className="right">
                      <div className="row-actions">
                        <button type="button" className="btn btn-xs btn-outline" onClick={() => openEdit(ad)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          disabled={busy === ad.id}
                          onClick={() => toggleStatus(ad)}
                        >
                          {ad.status === 'active' ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-danger"
                          disabled={busy === ad.id}
                          onClick={() => remove(ad)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState
          title="No advertisements yet"
          body="Create a campaign to fill homepage and article placements."
          action={<button type="button" className="btn mt-2" onClick={openCreate}>New advertisement</button>}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit advertisement' : 'New advertisement'}
        width={640}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" form="ad-form" className="btn" disabled={busy === 'save'}>
              {busy === 'save' ? 'Saving…' : editing ? 'Save changes' : 'Create campaign'}
            </button>
          </>
        }
      >
        <form id="ad-form" onSubmit={save}>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="ad-title">Campaign title</label>
              <input
                id="ad-title"
                className="input"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ad-advertiser">Advertiser</label>
              <input
                id="ad-advertiser"
                className="input"
                value={form.advertiser_name}
                onChange={(event) => setForm((prev) => ({ ...prev, advertiser_name: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="ad-placement">Placement</label>
              <select
                id="ad-placement"
                className="select"
                value={form.placement}
                onChange={(event) => setForm((prev) => ({ ...prev, placement: event.target.value }))}
              >
                {PLACEMENTS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <span className="hint">
                Every active campaign in this placement is shown; adding a new campaign never replaces an
                existing one. “Every page” slots render on all public pages, including shared article and
                section links — narrow them with “Run on”.
              </span>
            </div>
            <div className="field">
              <label htmlFor="ad-target-mode">Run on</label>
              <select
                id="ad-target-mode"
                className="select"
                value={form.target_mode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    target_mode: event.target.value,
                    target_category_id: '',
                    target_district_id: '',
                    target_path: '',
                  }))
                }
              >
                <option value="all">All content</option>
                <option value="category">A specific category</option>
                <option value="district">A specific district</option>
                <option value="path">Specific page or news link</option>
              </select>
            </div>
            {form.target_mode === 'category' ? (
              <div className="field">
                <label htmlFor="ad-target-category">Category</label>
                <select
                  id="ad-target-category"
                  className="select"
                  value={form.target_category_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, target_category_id: event.target.value }))
                  }
                  required
                >
                  <option value="">Choose category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
            ) : form.target_mode === 'district' ? (
              <div className="field">
                <label htmlFor="ad-target-district">District</label>
                <select
                  id="ad-target-district"
                  className="select"
                  value={form.target_district_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, target_district_id: event.target.value }))
                  }
                  required
                >
                  <option value="">Choose district</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>{district.name}</option>
                  ))}
                </select>
              </div>
            ) : form.target_mode === 'path' ? (
              <div className="field span-2">
                <label htmlFor="ad-target-path">Page path</label>
                <input
                  id="ad-target-path"
                  className="input"
                  value={form.target_path}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, target_path: event.target.value }))
                  }
                  placeholder="/en/news/your-story-slug or /category/*"
                  required
                />
                <span className="hint">
                  Matches the page address on this site. Use <code>*</code> as a wildcard —
                  <code>/en/news/*</code> covers every article link, <code>/district/*</code> every
                  district page. Combine with the placement above to choose where it appears.
                </span>
              </div>
            ) : null}
            <div className="field span-2">
              <label htmlFor="ad-url">Destination URL</label>
              <input
                id="ad-url"
                type="url"
                className="input"
                value={form.destination_url}
                onChange={(event) => setForm((prev) => ({ ...prev, destination_url: event.target.value }))}
                placeholder="https://advertiser.example/landing-page"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ad-status">Status</label>
              <select
                id="ad-status"
                className="select"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>{statusLabel(status)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ad-amount">Amount paid (₹)</label>
              <input
                id="ad-amount"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.amount_paid}
                onChange={(event) => setForm((prev) => ({ ...prev, amount_paid: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="ad-start">Starts at</label>
              <input
                id="ad-start"
                type="datetime-local"
                className="input"
                value={form.starts_at}
                onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="ad-end">Ends at</label>
              <input
                id="ad-end"
                type="datetime-local"
                className="input"
                value={form.ends_at}
                onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
              />
            </div>
            <label className="check span-2">
              <input
                type="checkbox"
                checked={form.is_sponsored}
                onChange={(event) => setForm((prev) => ({ ...prev, is_sponsored: event.target.checked }))}
              />
              Sponsored / paid placement
            </label>
            <div className="span-2">
              <ImageUploader value={image} onChange={setImage} label="Creative image" hint="Recommended 1200×300 or larger" />
            </div>
            <div className="span-2">
              <AdSizePreview
                form={form}
                image={image}
                onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
              />
            </div>
            {image ? (
              <div className="span-2">
                <div className="override-head">
                  <div>
                    <strong>Campaign overrides</strong>
                    <div className="text-sm text-muted">
                      Optional per-placement destination or schedule. Empty fields use the campaign defaults.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={addOverride}
                    disabled={form.overrides.length >= PLACEMENTS.length}
                  >
                    Add override
                  </button>
                </div>
                {form.overrides.map((override, index) => (
                  <div className="override-card" key={index}>
                    <div className="override-card-head">
                      <span className="kicker">Override {index + 1}</span>
                      <button type="button" className="link-btn" onClick={() => removeOverride(index)}>
                        Remove
                      </button>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor={`override-placement-${index}`}>Placement</label>
                        <select
                          id={`override-placement-${index}`}
                          className="select"
                          value={override.placement}
                          onChange={(event) => updateOverride(index, { placement: event.target.value })}
                        >
                          <option value="">Choose placement</option>
                          {PLACEMENTS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`override-url-${index}`}>Destination URL</label>
                        <input
                          id={`override-url-${index}`}
                          type="url"
                          className="input"
                          placeholder="Defaults to campaign URL"
                          value={override.destination_url}
                          onChange={(event) => updateOverride(index, { destination_url: event.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`override-start-${index}`}>Starts at</label>
                        <input
                          id={`override-start-${index}`}
                          type="datetime-local"
                          className="input"
                          value={override.starts_at}
                          onChange={(event) => updateOverride(index, { starts_at: event.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`override-end-${index}`}>Ends at</label>
                        <input
                          id={`override-end-${index}`}
                          type="datetime-local"
                          className="input"
                          value={override.ends_at}
                          onChange={(event) => updateOverride(index, { ends_at: event.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="span-2 text-sm text-muted">
                Upload the creative image to configure per-placement campaign overrides.
              </div>
            )}
          </div>
          {formError ? <div className="notice error">{formError}</div> : null}
        </form>
      </Modal>
    </>
  );
}
