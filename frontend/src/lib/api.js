const BASE = '/api/v1';
const TOKEN_KEY = 'kv_token';
const SESSION_KEY = 'kv_session';
const VISITOR_KEY = 'kv_visitor';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(SESSION_KEY, '1');
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function hasStoredSession() {
  try {
    return Boolean(localStorage.getItem(SESSION_KEY));
  } catch {
    return false;
  }
}

export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

function buildError(payload, status) {
  const error = new Error(payload?.message || 'Something went wrong. Please try again.');
  error.status = status;
  error.code = payload?.code;
  error.details = payload?.details;
  return error;
}

async function parseResponse(res) {
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    return res.json().catch(() => null);
  }
  const text = await res.text().catch(() => '');
  return text ? { message: text } : null;
}

let refreshing = null;

async function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await parseResponse(res);
      if (!res.ok) throw buildError(data, res.status);
      setToken(data.accessToken);
      return data;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function request(path, options = {}, retried = false) {
  const { method = 'GET', body, form, headers = {}, auth = true } = options;
  const finalHeaders = { ...headers };
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const token = getToken();
  if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: payload,
      credentials: 'include',
    });
  } catch {
    throw buildError({ message: 'Cannot reach the newsroom API. Check that the server is running.' }, 0);
  }

  if (res.status === 401 && auth && !retried && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
      return request(path, options, true);
    } catch {
      clearToken();
      window.dispatchEvent(new Event('kv:unauthorized'));
    }
  }

  if (res.status === 401 && auth && !path.startsWith('/auth/')) {
    clearToken();
    window.dispatchEvent(new Event('kv:unauthorized'));
  }

  const data = await parseResponse(res);
  if (!res.ok) throw buildError(data, res.status);
  return data;
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body }),
  del: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
  upload: (path, file) => {
    const form = new FormData();
    form.append('image', file);
    return request(path, { method: 'POST', form });
  },
  refresh: refreshSession,
};

export function thumbnailUrl(imageId, variant = 'thumb') {
  if (!imageId) return null;
  return `${BASE}/images/${imageId}?variant=${variant}`;
}
