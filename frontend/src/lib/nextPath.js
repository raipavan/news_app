export function safeNextPath(value) {
  if (typeof value !== 'string' || !value || value.length > 2048) return '/dashboard';
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return '/dashboard';
  let url;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return '/dashboard';
  }
  if (url.origin !== window.location.origin) return '/dashboard';
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return '/dashboard';
  }
  if (pathname.startsWith('//') || pathname.includes('\\')) return '/dashboard';
  return `${url.pathname}${url.search}${url.hash}`;
}
