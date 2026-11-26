const { query } = require('../db');

const SHARE_SETTINGS_KEY = 'share_settings';

const DEFAULT_SHARE_SETTINGS = {
  whatsappGroupUrl: '',
  includeSummaryInShare: false,
};

function normalizeWhatsappUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('WhatsApp Group URL must be a valid https:// URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('WhatsApp Group URL must start with https://');
  }
  return parsed.toString();
}

async function loadShareSettings(db = { query }) {
  const res = await db.query('SELECT value FROM settings WHERE key = $1', [SHARE_SETTINGS_KEY]);
  let stored = {};
  if (res.rows[0]?.value) {
    try {
      stored = JSON.parse(res.rows[0].value);
    } catch {
      stored = {};
    }
  }
  return {
    whatsappGroupUrl: typeof stored.whatsappGroupUrl === 'string' ? stored.whatsappGroupUrl : DEFAULT_SHARE_SETTINGS.whatsappGroupUrl,
    includeSummaryInShare:
      stored.includeSummaryInShare !== undefined
        ? Boolean(stored.includeSummaryInShare)
        : DEFAULT_SHARE_SETTINGS.includeSummaryInShare,
  };
}

async function updateShareSettings({ whatsappGroupUrl, includeSummaryInShare }, db = { query }) {
  const current = await loadShareSettings(db);
  const next = {
    whatsappGroupUrl:
      whatsappGroupUrl !== undefined ? normalizeWhatsappUrl(whatsappGroupUrl) : current.whatsappGroupUrl,
    includeSummaryInShare:
      includeSummaryInShare !== undefined ? Boolean(includeSummaryInShare) : current.includeSummaryInShare,
  };
  await db.query(
    `INSERT INTO settings(key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [SHARE_SETTINGS_KEY, JSON.stringify(next)]
  );
  return next;
}

function formatWhatsAppShareText({
  headline,
  summary = '',
  url,
  whatsappGroupUrl = '',
  includeSummaryInShare = false,
}) {
  const cleanHeadline = String(headline || '').trim();
  const cleanSummary = String(summary || '').trim();
  const titleLine =
    includeSummaryInShare && cleanSummary
      ? `🔶 *${cleanHeadline} :* ${cleanSummary}`
      : `🔶 *${cleanHeadline}*`;

  const lines = [titleLine, '', String(url || '').trim()];
  const groupUrl = String(whatsappGroupUrl || '').trim();
  if (groupUrl) {
    lines.push('', `🟢 *Join Whatsapp Group:* ${groupUrl}`);
  }
  return lines.join('\n');
}

module.exports = {
  SHARE_SETTINGS_KEY,
  DEFAULT_SHARE_SETTINGS,
  loadShareSettings,
  updateShareSettings,
  formatWhatsAppShareText,
};
