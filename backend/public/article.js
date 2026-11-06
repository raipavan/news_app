(() => {
  const root = document.querySelector('[data-article-id]');
  if (!root) return;

  const API = '/api/v1';
  const TOKEN_KEY = 'kv_token';
  const VISITOR_KEY = 'kv_visitor';
  const SAVED_KEY = 'kv_saved';
  const articleId = root.dataset.articleId;
  const lang = root.dataset.lang || 'en';
  const isKn = lang === 'kn';

  let visitorId = 'anonymous';
  try {
    visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
      visitorId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `v-${Date.now()}-${Math.random()}`;
      localStorage.setItem(VISITOR_KEY, visitorId);
    }
  } catch {
    visitorId = `v-${Date.now()}`;
  }

  const getToken = () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  };
  const setToken = (token) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  };

  async function request(path, options = {}) {
    const { method = 'GET', body, retry = true } = options;
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response = await fetch(`${API}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && token && retry) {
      const refreshed = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (refreshed.ok) {
        const data = await refreshed.json();
        setToken(data.accessToken);
        return request(path, { ...options, retry: false });
      }
      try { localStorage.removeItem(TOKEN_KEY); } catch {}
    }

    const type = response.headers.get('content-type') || '';
    const data = type.includes('json') ? await response.json() : null;
    if (!response.ok) {
      const error = new Error((data && data.message) || 'Request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  let toastTimer = null;
  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function getSavedIds() {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
  }
  function setSavedIds(ids) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(ids)); } catch {}
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function formatTime(value) {
    try {
      return new Intl.DateTimeFormat(isKn ? 'kn-IN' : 'en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value));
    } catch {
      return '';
    }
  }

  function updateHeaderForSession() {
    if (!getToken()) return;
    document.querySelectorAll('.staff-only').forEach((el) => {
      el.style.display = el.tagName === 'LI' ? 'list-item' : 'inline-block';
    });
    const nameInput = document.getElementById('comment-name');
    if (nameInput) nameInput.remove();
    const note = document.getElementById('comment-auth-note');
    if (note) note.textContent = isKn ? 'ಪ್ರತಿಕ್ರಿಯೆ ಸಂಪಾದಕೀಯ ಪರಿಶೀಲನೆಯ ನಂತರ ಪ್ರಕಟವಾಗುತ್ತದೆ.' : 'Comments appear after editorial approval.';
  }

  // ---- View tracking ----
  request(`/articles/${articleId}/view`, { method: 'POST', body: { visitor_id: visitorId } })
    .then((data) => {
      if (data && typeof data.view_count === 'number') {
        setText('view-count', `${data.view_count.toLocaleString('en-IN')} ${isKn ? 'ವೀಕ್ಷಣೆಗಳು' : 'views'}`);
      }
    })
    .catch(() => {});

  // ---- Engagement state ----
  let engagement = { likes: 0, comments: 0, shares: 0, liked: false, bookmarked: false };
  function paintEngagement() {
    setText('like-count', String(engagement.likes || 0));
    const likeBtn = document.getElementById('like-btn');
    if (likeBtn) {
      likeBtn.classList.toggle('active', Boolean(engagement.liked));
      likeBtn.setAttribute('aria-pressed', String(Boolean(engagement.liked)));
      const label = likeBtn.querySelector('span:nth-child(2)');
      if (label) label.textContent = engagement.liked ? (isKn ? 'ಇಷ್ಟಿಸಲಾಗಿದೆ' : 'Liked') : (isKn ? 'ಇಷ್ಟ' : 'Like');
    }
    const bookmarkBtn = document.getElementById('bookmark-btn');
    if (bookmarkBtn) {
      bookmarkBtn.classList.toggle('active', Boolean(engagement.bookmarked));
      bookmarkBtn.setAttribute('aria-pressed', String(Boolean(engagement.bookmarked)));
      const label = bookmarkBtn.querySelector('span:nth-child(2)');
      if (label) label.textContent = engagement.bookmarked ? (isKn ? 'ಉಳಿಸಲಾಗಿದೆ' : 'Saved') : (isKn ? 'ಉಳಿಸಿ' : 'Save');
    }
    const shareCount = document.getElementById('share-count');
    if (shareCount && engagement.shares) {
      shareCount.textContent = `${engagement.shares} ${isKn ? 'ಹಂಚಿಕೆ' : 'shares'}`;
    }
  }

  request(`/articles/${articleId}/engagement?visitor_id=${encodeURIComponent(visitorId)}`)
    .then((data) => {
      engagement = { ...engagement, ...data };
      if (!getToken()) engagement.bookmarked = getSavedIds().includes(articleId);
      paintEngagement();
    })
    .catch(() => {});

  document.getElementById('like-btn')?.addEventListener('click', async () => {
    try {
      const data = await request(`/articles/${articleId}/like`, {
        method: 'POST',
        body: { visitor_id: visitorId },
      });
      engagement.liked = data.liked;
      engagement.likes = data.count;
      paintEngagement();
    } catch (err) {
      toast(err.message);
    }
  });

  document.getElementById('bookmark-btn')?.addEventListener('click', async () => {
    if (!getToken()) {
      const saved = new Set(getSavedIds());
      if (saved.has(articleId)) saved.delete(articleId);
      else saved.add(articleId);
      setSavedIds([...saved]);
      engagement.bookmarked = saved.has(articleId);
      paintEngagement();
      toast(engagement.bookmarked
        ? (isKn ? 'ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ' : 'Saved on this device')
        : (isKn ? 'ಉಳಿಸುವಿಕೆ ತೆಗೆದುಹಾಕಲಾಗಿದೆ' : 'Removed from saved'));
      return;
    }
    try {
      const data = await request(`/articles/${articleId}/bookmark`, { method: 'POST' });
      engagement.bookmarked = data.bookmarked;
      paintEngagement();
      toast(data.bookmarked ? (isKn ? 'ಉಳಿಸಲಾಗಿದೆ' : 'Saved to bookmarks') : (isKn ? 'ಉಳಿಸುವಿಕೆ ತೆಗೆದುಹಾಕಲಾಗಿದೆ' : 'Removed from bookmarks'));
    } catch (err) {
      toast(err.message);
    }
  });

  // ---- Comments ----
  function renderComments(items) {
    const list = document.getElementById('comment-list');
    if (!list) return;
    list.textContent = '';
    if (!items.length) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:var(--muted);font-size:13px;';
      empty.textContent = isKn ? 'ಇನ್ನೂ ಪ್ರತಿಕ್ರಿಯೆಗಳಿಲ್ಲ. ಮೊದಲಿಗರಾಗಿ.' : 'No comments yet. Start the conversation.';
      list.appendChild(empty);
      return;
    }
    for (const item of items) {
      const wrap = document.createElement('div');
      wrap.className = 'comment-item';

      const head = document.createElement('div');
      head.className = 'comment-head';

      const name = document.createElement('div');
      name.className = 'comment-name';
      const author = document.createElement('span');
      author.className = 'comment-author';
      author.textContent = (item.user_name || 'R').trim().charAt(0).toUpperCase();
      const nameText = document.createElement('span');
      nameText.textContent = item.user_name || 'Reader';
      const time = document.createElement('time');
      time.textContent = formatTime(item.created_at);
      name.append(author, nameText, time);
      head.appendChild(name);

      const body = document.createElement('p');
      body.className = 'comment-body';
      body.textContent = item.content;

      wrap.append(head, body);
      list.appendChild(wrap);
    }
  }

  function loadComments() {
    request(`/articles/${articleId}/comments`)
      .then((data) => {
        renderComments(data.items || []);
        engagement.comments = (data.items || []).length;
        const count = document.getElementById('comment-count');
        if (count) count.textContent = `(${engagement.comments})`;
      })
      .catch(() => {});
  }
  loadComments();

  document.getElementById('comment-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const textarea = document.getElementById('comment-body');
    const content = textarea.value.trim();
    if (!content) return;
    const guestName = (document.getElementById('comment-name')?.value || '').trim();
    const button = event.target.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await request(`/articles/${articleId}/comments`, {
        method: 'POST',
        body: { content, guest_name: guestName },
      });
      textarea.value = '';
      toast(isKn ? 'ಪ್ರತಿಕ್ರಿಯೆ ಸಲ್ಲಿಸಲಾಗಿದೆ. ಪರಿಶೀಲನೆಯ ನಂತರ ಪ್ರಕಟವಾಗುತ್ತದೆ.' : 'Comment submitted for moderation.');
    } catch (err) {
      toast(err.message);
    } finally {
      button.disabled = false;
    }
  });

  // ---- Sharing ----
  async function recordShare(platform) {
    try {
      const data = await request(`/articles/${articleId}/share`, {
        method: 'POST',
        body: { platform },
      });
      engagement.shares = data.count;
      paintEngagement();
    } catch {}
  }

  document.querySelectorAll('[data-share]').forEach((link) => {
    link.addEventListener('click', () => recordShare(link.dataset.share || 'other'));
  });

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const url = button.dataset.copy || window.location.href;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const temp = document.createElement('input');
        temp.value = url;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
      }
      toast(isKn ? 'ಲಿಂಕ್ ನಕಲಾಗಿದೆ' : 'Link copied');
      recordShare('copy');
    });
  });

  // ---- Report modal ----
  const modal = document.getElementById('report-modal');
  const openModal = () => modal?.classList.add('open');
  const closeModal = () => modal?.classList.remove('open');
  document.getElementById('report-btn')?.addEventListener('click', openModal);
  document.getElementById('report-link')?.addEventListener('click', (event) => {
    event.preventDefault();
    openModal();
  });
  document.getElementById('report-cancel')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  document.getElementById('report-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const reason = document.getElementById('report-reason').value.trim();
    if (!reason) return;
    try {
      await request(`/articles/${articleId}/report`, { method: 'POST', body: { reason } });
      closeModal();
      event.target.reset();
      toast(isKn ? 'ವರದಿ ಸಲ್ಲಿಸಲಾಗಿದೆ. ಧನ್ಯವಾದ.' : 'Report sent. Thank you.');
    } catch (err) {
      toast(err.message);
    }
  });

  // ---- Ad impressions ----
  const seen = new Set();
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.dataset.adId;
          if (!id || seen.has(id)) return;
          seen.add(id);
          request(`/public/ads/${id}/impression`, {
            method: 'POST',
            body: { visitor_id: visitorId },
          }).catch(() => {});
        });
      }, { threshold: 0.4 })
    : null;
  document.querySelectorAll('[data-ad-id]').forEach((el) => {
    if (observer) observer.observe(el);
  });

  // ---- Ad click attribution ----
  document.querySelectorAll('[data-ad-click]').forEach((link) => {
    try {
      const url = new URL(link.getAttribute('href'), window.location.origin);
      url.searchParams.set('visitor_id', visitorId);
      link.setAttribute('href', url.pathname + url.search);
    } catch {}
  });

  updateHeaderForSession();
})();
