import { useState } from 'react';
import { useApi, useDocumentTitle } from '../../../hooks/useApi';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import { EmptyState, PageLoading } from '../../../components/ui';
import Modal from '../../../components/Modal';
import { formatDate, roleLabel, statusLabel } from '../../../lib/format';

const ROLES = ['super_admin', 'editor', 'reporter', 'contributor', 'reader'];
const STATUSES = ['active', 'pending', 'blocked'];

const EMPTY_USER = {
  name: '',
  email: '',
  phone: '',
  password: '',
  roles: ['contributor'],
  can_publish: false,
  status: 'active',
};

export default function Users() {
  const { user: me, refreshUser } = useAuth();
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi(
    `/admin/users?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`
  );
  const items = data?.items || [];

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_USER);
  const [roleUser, setRoleUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [nameUser, setNameUser] = useState(null);
  const [nameValue, setNameValue] = useState('');
  const [busy, setBusy] = useState('');
  const [formError, setFormError] = useState('');
  useDocumentTitle('Users & roles');

  const submitSearch = (event) => {
    event.preventDefault();
    setQ(search.trim());
  };

  const createUser = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.email.trim() && !form.phone.trim()) {
      setFormError('Add an email address or a phone number.');
      return;
    }
    if (form.password.length < 8) {
      setFormError('Use a password of at least 8 characters.');
      return;
    }
    if (!form.roles.length) {
      setFormError('Choose at least one role.');
      return;
    }
    setBusy('create');
    try {
      await api.post('/admin/users', {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
        roles: form.roles,
        can_publish: form.can_publish,
        status: form.status,
      });
      notify('User account created', 'success');
      setCreateOpen(false);
      setForm(EMPTY_USER);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy('');
    }
  };

  const changeStatus = async (person, status) => {
    if (status === person.status) return;
    if (status === 'blocked' && !window.confirm(`Block ${person.name}? Their sessions will be revoked.`)) {
      return;
    }
    setBusy(`status-${person.id}`);
    try {
      await api.put(`/admin/users/${person.id}/status`, { status });
      notify(`${person.name} is now ${statusLabel(status).toLowerCase()}`, 'success');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const togglePublisher = async (person) => {
    setBusy(`publisher-${person.id}`);
    try {
      await api.put(`/admin/users/${person.id}/publisher`, { can_publish: !person.can_publish });
      notify(
        person.can_publish
          ? `${person.name} can no longer publish directly`
          : `${person.name} may publish own approved stories`,
        'success'
      );
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const openRoles = (person) => {
    setRoleUser(person);
    setSelectedRoles(person.roles || []);
    setFormError('');
  };

  const saveRoles = async () => {
    if (!selectedRoles.length) {
      setFormError('Choose at least one role.');
      return;
    }
    setBusy('roles');
    try {
      await api.put(`/admin/users/${roleUser.id}/roles`, { roles: selectedRoles });
      notify('Roles updated', 'success');
      setRoleUser(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy('');
    }
  };

  const openName = (person) => {
    setNameUser(person);
    setNameValue(person.name || '');
    setFormError('');
  };

  const saveName = async (event) => {
    event.preventDefault();
    const nextName = nameValue.trim();
    if (nextName.length < 2) {
      setFormError('Enter a name of at least 2 characters.');
      return;
    }
    setBusy('name');
    try {
      await api.put(`/admin/users/${nameUser.id}/name`, { name: nextName });
      notify('Name updated', 'success');
      const renamedSelf = nameUser.id === me?.id;
      setNameUser(null);
      reload();
      if (renamedSelf) await refreshUser();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker">Administration</span>
          <h2>Users &amp; roles</h2>
          <p>Staff, community contributors and readers with their access and publishing rights.</p>
        </div>
        <button type="button" className="btn" onClick={() => { setForm(EMPTY_USER); setFormError(''); setCreateOpen(true); }}>
          Create user
        </button>
      </div>

      <form className="filters" onSubmit={submitSearch}>
        <input
          className="input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email or phone"
          aria-label="Search users"
        />
        <button type="submit" className="btn btn-sm">Search</button>
        {q ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setSearch('');
              setQ('');
            }}
          >
            Clear
          </button>
        ) : null}
        <span className="spacer" />
        <span className="text-sm text-muted">{data?.total ?? 0} accounts</span>
      </form>

      {loading && !data ? (
        <PageLoading />
      ) : error ? (
        <EmptyState title="Could not load users" body={error.message} />
      ) : items.length ? (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th className="right">Articles</th>
                  <th>Joined</th>
                  <th>Publisher</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((person) => (
                  <tr key={person.id}>
                    <td className="title-cell">
                      {person.name}
                      <small>{person.email || person.phone || 'No contact recorded'}</small>
                    </td>
                    <td>
                      <div className="cell-stack">
                        {(person.roles || []).map((role) => (
                          <span className="badge gold" key={role}>{roleLabel(role)}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${person.status}`}>{statusLabel(person.status)}</span>
                      <select
                        className="select mt-1"
                        style={{ width: 120, padding: '4px 8px', fontSize: 12 }}
                        value={person.status}
                        disabled={busy === `status-${person.id}` || person.id === me?.id}
                        onChange={(event) => changeStatus(person, event.target.value)}
                        aria-label={`Change status for ${person.name}`}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>{statusLabel(status)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="right num">{person.article_count}</td>
                    <td className="nowrap">{formatDate(person.created_at)}</td>
                    <td>
                      <button
                        type="button"
                        className={`badge ${person.can_publish ? 'published' : 'draft'}`}
                        style={{ border: 0 }}
                        disabled={busy === `publisher-${person.id}`}
                        onClick={() => togglePublisher(person)}
                        title="Toggle direct publishing rights"
                      >
                        {person.can_publish ? 'Can publish' : 'Review required'}
                      </button>
                    </td>
                    <td className="right">
                      <div className="row-actions">
                        <button type="button" className="btn btn-xs btn-outline" onClick={() => openName(person)}>
                          Change name
                        </button>
                        <button type="button" className="btn btn-xs btn-outline" onClick={() => openRoles(person)}>
                          Edit roles
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
        <EmptyState title="No accounts found" body="Try a different search or create a new user." />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a user"
        width={620}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" form="create-user-form" className="btn" disabled={busy === 'create'}>
              {busy === 'create' ? 'Creating…' : 'Create user'}
            </button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={createUser}>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="user-name">Full name</label>
              <input
                id="user-name"
                className="input"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                minLength={2}
              />
            </div>
            <div className="field">
              <label htmlFor="user-email">Email</label>
              <input
                id="user-email"
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="user-phone">Phone</label>
              <input
                id="user-phone"
                className="input"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="user-password">Temporary password</label>
              <input
                id="user-password"
                type="password"
                className="input"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                minLength={8}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="user-status">Status</label>
              <select
                id="user-status"
                className="select"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                {STATUSES.filter((status) => status !== 'blocked').map((status) => (
                  <option key={status} value={status}>{statusLabel(status)}</option>
                ))}
              </select>
            </div>
            <div className="field span-2">
              <label>Roles</label>
              <div className="check-list">
                {ROLES.filter((role) => role !== 'super_admin').map((role) => (
                  <label className="check" key={role}>
                    <input
                      type="checkbox"
                      checked={form.roles.includes(role)}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          roles: event.target.checked
                            ? [...prev.roles, role]
                            : prev.roles.filter((item) => item !== role),
                        }))
                      }
                    />
                    {roleLabel(role)}
                  </label>
                ))}
              </div>
            </div>
            <label className="check span-2">
              <input
                type="checkbox"
                checked={form.can_publish}
                onChange={(event) => setForm((prev) => ({ ...prev, can_publish: event.target.checked }))}
              />
              Trusted publisher — may publish own approved stories without waiting for an editor
            </label>
          </div>
          {formError ? <div className="notice error">{formError}</div> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(roleUser)}
        onClose={() => setRoleUser(null)}
        title={`Roles for ${roleUser?.name || 'user'}`}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setRoleUser(null)}>Cancel</button>
            <button type="button" className="btn" disabled={busy === 'roles'} onClick={saveRoles}>
              {busy === 'roles' ? 'Saving…' : 'Save roles'}
            </button>
          </>
        }
      >
        <p>Super Admin has every permission. Editors review and publish. Reporters and contributors write.</p>
        {formError ? <div className="notice error">{formError}</div> : null}
        <div className="check-list">
          {ROLES.map((role) => (
            <label className="check" key={role}>
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={(event) =>
                  setSelectedRoles((prev) =>
                    event.target.checked ? [...prev, role] : prev.filter((item) => item !== role)
                  )
                }
              />
              {roleLabel(role)}
            </label>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(nameUser)}
        onClose={() => setNameUser(null)}
        title="Change display name"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setNameUser(null)}>Cancel</button>
            <button type="submit" form="change-name-form" className="btn" disabled={busy === 'name'}>
              {busy === 'name' ? 'Saving…' : 'Save name'}
            </button>
          </>
        }
      >
        <form id="change-name-form" onSubmit={saveName}>
          <div className="field">
            <label htmlFor="change-name">Display name</label>
            <input
              id="change-name"
              className="input"
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
              minLength={2}
              maxLength={150}
              required
              autoFocus
            />
          </div>
          <p className="text-sm text-muted">
            {nameUser?.id === me?.id
              ? 'This changes how your name appears across the dashboard.'
              : `This updates the name shown for ${nameUser?.email || nameUser?.phone || 'this account'}.`}
          </p>
          {formError ? <div className="notice error">{formError}</div> : null}
        </form>
      </Modal>
    </>
  );
}
