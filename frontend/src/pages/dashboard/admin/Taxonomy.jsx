import { useState } from 'react';
import { useApi, useDocumentTitle } from '../../../hooks/useApi';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import { EmptyState, PageLoading } from '../../../components/ui';
import { statusLabel } from '../../../lib/format';

const EMPTY_CATEGORY = { name_en: '', name_kn: '', slug: '', sort_order: 0 };
const EMPTY_DISTRICT = { name_en: '', name_kn: '', slug: '' };

function CategoryPanel() {
  const { notify } = useToast();
  const { data, loading, error, reload } = useApi('/admin/categories');
  const [form, setForm] = useState(EMPTY_CATEGORY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState('');
  const [formError, setFormError] = useState('');
  const items = data?.items || [];

  const startEdit = (category) => {
    setEditing(category);
    setForm({
      name_en: category.name_en,
      name_kn: category.name_kn,
      slug: category.slug,
      sort_order: category.sort_order || 0,
    });
    setFormError('');
  };

  const reset = () => {
    setEditing(null);
    setForm(EMPTY_CATEGORY);
    setFormError('');
  };

  const save = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.name_en.trim() || !form.name_kn.trim()) {
      setFormError('Both the English and Kannada names are required.');
      return;
    }
    setBusy('save');
    try {
      const body = {
        name_en: form.name_en.trim(),
        name_kn: form.name_kn.trim(),
        slug: form.slug.trim() || undefined,
        sort_order: Number(form.sort_order) || 0,
      };
      if (editing) {
        await api.put(`/admin/categories/${editing.id}`, body);
        notify('Section updated', 'success');
      } else {
        await api.post('/admin/categories', body);
        notify('Section created', 'success');
      }
      reset();
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy('');
    }
  };

  const toggleActive = async (category) => {
    setBusy(category.id);
    try {
      await api.put(`/admin/categories/${category.id}`, { is_active: !category.is_active });
      notify(category.is_active ? 'Section hidden from navigation' : 'Section is active', 'success');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  if (loading && !data) return <PageLoading />;
  if (error) return <EmptyState title="Could not load sections" body={error.message} />;

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Sections</h3>
        {editing ? <button type="button" className="link-btn" onClick={reset}>Cancel edit</button> : null}
      </div>
      <div className="panel-body">
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="cat-name-en">English name</label>
              <input
                id="cat-name-en"
                className="input"
                value={form.name_en}
                onChange={(event) => setForm((prev) => ({ ...prev, name_en: event.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="cat-name-kn">Kannada name</label>
              <input
                id="cat-name-kn"
                className="input lang-kn"
                value={form.name_kn}
                onChange={(event) => setForm((prev) => ({ ...prev, name_kn: event.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="cat-slug">Slug</label>
              <input
                id="cat-slug"
                className="input"
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                placeholder="auto"
              />
            </div>
            <div className="field">
              <label htmlFor="cat-order">Sort order</label>
              <input
                id="cat-order"
                type="number"
                className="input"
                value={form.sort_order}
                onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
              />
            </div>
          </div>
          {formError ? <div className="notice error">{formError}</div> : null}
          <div className="form-row">
            <button type="submit" className="btn btn-sm" disabled={busy === 'save'}>
              {busy === 'save' ? 'Saving…' : editing ? 'Update section' : 'Add section'}
            </button>
            {editing ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={reset}>Cancel</button>
            ) : null}
          </div>
        </form>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Section</th>
              <th>Slug</th>
              <th className="right">Stories</th>
              <th>Status</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((category) => (
              <tr key={category.id}>
                <td className="title-cell">
                  {category.name_en}
                  <small className="lang-kn">{category.name_kn}</small>
                </td>
                <td className="text-sm">/{category.slug}</td>
                <td className="right num">{category.article_count}</td>
                <td>
                  <span className={`badge ${category.is_active ? 'active' : 'archived'}`}>
                    {category.is_active ? 'Active' : 'Hidden'}
                  </span>
                </td>
                <td className="right">
                  <div className="row-actions">
                    <button type="button" className="btn btn-xs btn-outline" onClick={() => startEdit(category)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-outline"
                      disabled={busy === category.id}
                      onClick={() => toggleActive(category)}
                    >
                      {category.is_active ? 'Hide' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DistrictPanel() {
  const { notify } = useToast();
  const { data, loading, error, reload } = useApi('/admin/districts');
  const [form, setForm] = useState(EMPTY_DISTRICT);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState('');
  const [formError, setFormError] = useState('');
  const items = data?.items || [];

  const startEdit = (district) => {
    setEditing(district);
    setForm({ name_en: district.name_en, name_kn: district.name_kn, slug: district.slug });
    setFormError('');
  };

  const reset = () => {
    setEditing(null);
    setForm(EMPTY_DISTRICT);
    setFormError('');
  };

  const save = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.name_en.trim() || !form.name_kn.trim()) {
      setFormError('Both the English and Kannada names are required.');
      return;
    }
    setBusy('save');
    try {
      const body = {
        name_en: form.name_en.trim(),
        name_kn: form.name_kn.trim(),
        slug: form.slug.trim() || undefined,
      };
      if (editing) {
        await api.put(`/admin/districts/${editing.id}`, body);
        notify('District updated', 'success');
      } else {
        await api.post('/admin/districts', body);
        notify('District created', 'success');
      }
      reset();
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy('');
    }
  };

  const toggleActive = async (district) => {
    setBusy(district.id);
    try {
      await api.put(`/admin/districts/${district.id}`, { is_active: !district.is_active });
      notify(district.is_active ? 'District hidden' : 'District is active', 'success');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  if (loading && !data) return <PageLoading />;
  if (error) return <EmptyState title="Could not load districts" body={error.message} />;

  return (
    <section className="panel mt-2">
      <div className="panel-head">
        <h3>Districts</h3>
        {editing ? <button type="button" className="link-btn" onClick={reset}>Cancel edit</button> : null}
      </div>
      <div className="panel-body">
        <form onSubmit={save}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="field">
              <label htmlFor="dist-name-en">English name</label>
              <input
                id="dist-name-en"
                className="input"
                value={form.name_en}
                onChange={(event) => setForm((prev) => ({ ...prev, name_en: event.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="dist-name-kn">Kannada name</label>
              <input
                id="dist-name-kn"
                className="input lang-kn"
                value={form.name_kn}
                onChange={(event) => setForm((prev) => ({ ...prev, name_kn: event.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="dist-slug">Slug</label>
              <input
                id="dist-slug"
                className="input"
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                placeholder="auto"
              />
            </div>
          </div>
          {formError ? <div className="notice error">{formError}</div> : null}
          <div className="form-row">
            <button type="submit" className="btn btn-sm" disabled={busy === 'save'}>
              {busy === 'save' ? 'Saving…' : editing ? 'Update district' : 'Add district'}
            </button>
            {editing ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={reset}>Cancel</button>
            ) : null}
          </div>
        </form>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>District</th>
              <th>Slug</th>
              <th className="right">Stories</th>
              <th>Status</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((district) => (
              <tr key={district.id}>
                <td className="title-cell">
                  {district.name_en}
                  <small className="lang-kn">{district.name_kn}</small>
                </td>
                <td className="text-sm">/{district.slug}</td>
                <td className="right num">{district.article_count}</td>
                <td>
                  <span className={`badge ${district.is_active ? 'active' : 'archived'}`}>
                    {statusLabel(district.is_active ? 'active' : 'archived')}
                  </span>
                </td>
                <td className="right">
                  <div className="row-actions">
                    <button type="button" className="btn btn-xs btn-outline" onClick={() => startEdit(district)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-outline"
                      disabled={busy === district.id}
                      onClick={() => toggleActive(district)}
                    >
                      {district.is_active ? 'Hide' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Taxonomy() {
  useDocumentTitle('Sections & districts');
  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Administration</span>
          <h2>Sections &amp; districts</h2>
          <p>The taxonomy behind navigation, story pages and canonical category and district URLs.</p>
        </div>
      </div>
      <CategoryPanel />
      <DistrictPanel />
    </>
  );
}
