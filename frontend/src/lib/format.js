const localeFor = (lang) => (lang === 'kn' ? 'kn-IN' : 'en-IN');

export function formatDate(value, lang = 'en') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value, lang = 'en') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatNumber(value, lang = 'en') {
  return new Intl.NumberFormat(localeFor(lang)).format(Number(value) || 0);
}

export function timeAgo(value, lang = 'en') {
  if (!value) return '';
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return '';
  const seconds = Math.round((date - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto' });
  if (absolute < 60) return formatter.format(seconds, 'second');
  if (absolute < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (absolute < 86400) return formatter.format(Math.round(seconds / 3600), 'hour');
  if (absolute < 604800) return formatter.format(Math.round(seconds / 86400), 'day');
  return formatDate(value, lang);
}

export function stripHtml(html = '') {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function readTime(html, lang = 'en') {
  const words = stripHtml(html).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 200)) + (lang === 'kn' ? ' ನಿಮಿಷ' : ' min');
}

export function statusLabel(status) {
  const labels = {
    draft: 'Draft',
    submitted: 'In review',
    in_review: 'In review',
    approved: 'Approved',
    rejected: 'Rejected',
    published: 'Published',
    archived: 'Archived',
    pending: 'Pending',
    active: 'Active',
    blocked: 'Blocked',
    paused: 'Paused',
    expired: 'Expired',
    open: 'Open',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
  };
  return labels[status] || status;
}

export function roleLabel(role) {
  const labels = {
    super_admin: 'Super Admin',
    editor: 'Editor',
    reporter: 'Reporter',
    contributor: 'Contributor',
    reader: 'Reader',
  };
  return labels[role] || role;
}

export function titleCase(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
