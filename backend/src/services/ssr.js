const env = require('../config/env');
const { imageUrl } = require('./imageService');

const LABELS = {
  en: {
    latest: 'Latest',
    related: 'Related stories',
    mostRead: 'Most read',
    share: 'Share',
    comments: 'Comments',
    commentsNote: 'Comments are moderated. Keep the discussion civil and evidence-based.',
    commentPlaceholder: 'Write a comment…',
    postComment: 'Post comment',
    like: 'Like',
    liked: 'Liked',
    bookmark: 'Save',
    saved: 'Saved',
    report: 'Report',
    reportTitle: 'Report misleading news',
    reportBody: 'Tell our editorial team what is inaccurate or misleading about this article.',
    reportSubmit: 'Send report',
    cancel: 'Cancel',
    tags: 'Topics',
    readTime: 'min read',
    published: 'Published',
    updated: 'Updated',
    views: 'views',
    by: 'By',
    home: 'Home',
    signIn: 'Sign in',
    newsroom: 'Newsroom',
    subscribe: 'Submit news',
    searchPlaceholder: 'Search news',
    backHome: 'Back to homepage',
    notFoundTitle: 'This page could not be found',
    notFoundBody: 'The article may have been unpublished, moved, or the link may be incorrect.',
    sponsored: 'Sponsored',
    source: 'Source',
    loginToInteract: 'No account needed — your name is optional. Comments appear after editorial approval.',
    yourName: 'Your name (optional)',
    correction: 'Report an error',
    copyLink: 'Copy link',
    copied: 'Link copied',
    moreFrom: 'More from',
    edition: 'Kannada & English edition',
    editNote: 'Have a correction? Our editorial team reviews every report.',
  },
  kn: {
    latest: 'ತಾಜಾ ಸುದ್ದಿ',
    related: 'ಸಂಬಂಧಿತ ಸುದ್ದಿ',
    mostRead: 'ಹೆಚ್ಚು ಓದಿದ',
    share: 'ಹಂಚಿಕೊಳ್ಳಿ',
    comments: 'ಪ್ರತಿಕ್ರಿಯೆಗಳು',
    commentsNote: 'ಪ್ರತಿಕ್ರಿಯೆಗಳನ್ನು ಮಾಡರೇಟ್ ಮಾಡಲಾಗುತ್ತದೆ. ಸಭ್ಯ ಮತ್ತು ಆಧಾರಿತ ಚರ್ಚೆ ನಡೆಸಿ.',
    commentPlaceholder: 'ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆ ಬರೆಯಿರಿ…',
    postComment: 'ಪ್ರತಿಕ್ರಿಯೆ ಸಲ್ಲಿಸಿ',
    like: 'ಇಷ್ಟ',
    liked: 'ಇಷ್ಟಿಸಲಾಗಿದೆ',
    bookmark: 'ಉಳಿಸಿ',
    saved: 'ಉಳಿಸಲಾಗಿದೆ',
    report: 'ವರದಿ ಮಾಡಿ',
    reportTitle: 'ತಪ್ಪು ಮಾಹಿತಿ ವರದಿ ಮಾಡಿ',
    reportBody: 'ಈ ವರದಿಯಲ್ಲಿ ಏನು ತಪ್ಪಾಗಿದೆ ಅಥವಾ ದಾರಿ ತಪ್ಪಿಸುತ್ತದೆ ಎಂಬುದನ್ನು ನಮ್ಮ ಸಂಪಾದಕೀಯ ತಂಡಕ್ಕೆ ತಿಳಿಸಿ.',
    reportSubmit: 'ವರದಿ ಕಳುಹಿಸಿ',
    cancel: 'ರದ್ದು',
    tags: 'ವಿಷಯಗಳು',
    readTime: 'ನಿಮಿಷ ಓದು',
    published: 'ಪ್ರಕಟಿತ',
    updated: 'ನವೀಕರಿಸಲಾಗಿದೆ',
    views: 'ವೀಕ್ಷಣೆಗಳು',
    by: 'ಬರೆದವರು',
    home: 'ಮುಖಪುಟ',
    signIn: 'ಸೈನ್ ಇನ್',
    newsroom: 'ಸುದ್ದಿಕೊಠಡಿ',
    subscribe: 'ಸುದ್ದಿ ಕಳುಹಿಸಿ',
    searchPlaceholder: 'ಸುದ್ದಿ ಹುಡುಕಿ',
    backHome: 'ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ',
    notFoundTitle: 'ಈ ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ',
    notFoundBody: 'ಈ ವರದಿ ತೆಗೆದುಹಾಕಲಾಗಿರಬಹುದು, ಸ್ಥಳಾಂತರವಾಗಿರಬಹುದು ಅಥವಾ ಲಿಂಕ್ ತಪ್ಪಾಗಿರಬಹುದು.',
    sponsored: 'ಪ್ರಾಯೋಜಿತ',
    source: 'ಮೂಲ',
    loginToInteract: 'ಖಾತೆ ಅಗತ್ಯವಿಲ್ಲ — ನಿಮ್ಮ ಹೆಸರು ಐಚ್ಛಿಕ. ಪ್ರತಿಕ್ರಿಯೆಗಳು ಸಂಪಾದಕೀಯ ಪರಿಶೀಲನೆಯ ನಂತರ ಪ್ರಕಟವಾಗುತ್ತವೆ.',
    yourName: 'ನಿಮ್ಮ ಹೆಸರು (ಐಚ್ಛಿಕ)',
    correction: 'ತಪ್ಪು ವರದಿ ಮಾಡಿ',
    copyLink: 'ಲಿಂಕ್ ನಕಲಿಸಿ',
    copied: 'ಲಿಂಕ್ ನಕಲಾಗಿದೆ',
    moreFrom: 'ಇನ್ನಷ್ಟು',
    edition: 'ಕನ್ನಡ ಮತ್ತು ಇಂಗ್ಲಿಷ್ ಆವೃತ್ತಿ',
    editNote: 'ತಿದ್ದುಪಡಿ ಇದೆಯೇ? ನಮ್ಮ ಸಂಪಾದಕೀಯ ತಂಡ ಪ್ರತಿ ವರದಿಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತದೆ.',
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
}

function baseUrl(req) {
  if (env.publicBaseUrl) return env.publicBaseUrl;
  return `${req.protocol}://${req.get('host')}`;
}

function formatDate(date, lang) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'kn' ? 'kn-IN' : 'en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date));
  } catch {
    return new Date(date).toISOString();
  }
}

function formatDay(date, lang) {
  try {
    return new Intl.DateTimeFormat(lang === 'kn' ? 'kn-IN' : 'en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date || new Date());
  } catch {
    return new Date().toDateString();
  }
}

function readingTime(content, lang) {
  const text = String(content || '').replace(/<[^>]+>/g, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / (lang === 'kn' ? 160 : 220)));
}

function brand(lang, base, compact = false) {
  return `
    <a class="brand" href="/?lang=${lang}" aria-label="Thaja Suddi home">
      <span class="brand-mark">T</span>
      <span>
        <span class="brand-name">Thaja <span>Suddi</span></span>
        ${compact ? '' : '<span class="brand-kn">ತಾಜಾ ಸುದ್ದಿ</span>'}
      </span>
    </a>`;
}

function header({ lang, categories, activeSlug, q = '', base, alternates = [], selfUrl = '' }) {
  const selfHref = selfUrl || `/?lang=${lang}`;
  const linkFor = (target) => {
    if (target === lang) return selfHref;
    const alternate = alternates.find((item) => item.language === target);
    return alternate ? `/${target}/news/${encodeURIComponent(alternate.slug)}` : `/?lang=${target}`;
  };
  const nav = categories
    .slice(0, 10)
    .map(
      (c) => `<a href="/category/${encodeURIComponent(c.slug)}?lang=${lang}"${
        c.slug === activeSlug ? ' class="active"' : ''
      }>${escapeHtml(c.name)}</a>`
    )
    .join('');
  return `
<header class="site-header">
  <div class="header-top">
    <div class="container">
      <span>${escapeHtml(formatDay(new Date(), lang))} <span class="dot">•</span> Bengaluru, Karnataka</span>
      <div class="header-top-right">
        <a href="/policies/editorial">Editorial standards</a>
        <a href="/policies/grievance">Grievance</a>
        <a class="staff-only" href="/dashboard">${escapeHtml(LABELS[lang].newsroom)}</a>
      </div>
    </div>
  </div>
  <div class="masthead">
    <div class="container">
      <div class="masthead-left">${brand(lang, base)}</div>
      <div class="masthead-tag">
        <strong>${escapeHtml(LABELS[lang].edition)}</strong>
        Bengaluru · Mysuru · Mangaluru · Hubballi
      </div>
      <div class="masthead-right">
        <div class="lang-switch" aria-label="Language">
          <a href="${linkFor('en')}" class="${lang === 'en' ? 'active' : ''}">EN</a>
          <a href="${linkFor('kn')}" class="${lang === 'kn' ? 'active' : ''}">ಕನ್ನಡ</a>
        </div>
        <a class="btn btn-sm btn-outline staff-only" href="/dashboard">${escapeHtml(LABELS[lang].newsroom)}</a>
      </div>
    </div>
  </div>
  <div class="nav-wrap">
    <div class="container">
      <nav class="main-nav" aria-label="Sections">
        <a class="nav-home" href="/?lang=${lang}">${escapeHtml(LABELS[lang].home)}</a>
        ${nav}
        <div class="nav-search">
          <form action="/search" method="get" role="search">
            <input type="hidden" name="lang" value="${lang}" />
            <input name="q" value="${escapeHtml(q)}" placeholder="${escapeHtml(LABELS[lang].searchPlaceholder)}" aria-label="${escapeHtml(LABELS[lang].searchPlaceholder)}" />
            <button aria-label="Search">⌕</button>
          </form>
        </div>
      </nav>
    </div>
  </div>
</header>`;
}

function ticker(items, lang) {
  if (!items.length) return '';
  const list = items.slice(0, 5);
  const group = (copy) => `
        <div class="ticker-group"${copy ? ' aria-hidden="true"' : ''}>
          ${list
            .map(
              (item) =>
                `<a class="ticker-item" href="${escapeHtml(item.url)}">${escapeHtml(item.headline)}</a>`
            )
            .join('')}
        </div>`;
  return `
  <div class="ticker" aria-label="Latest headlines">
    <div class="container" style="display:flex;align-items:stretch;padding:0;width:min(var(--container),calc(100% - 48px));">
      <div class="ticker-label">${lang === 'kn' ? 'ತಾಜಾ' : 'Breaking'}</div>
      <div class="ticker-window">
        <div class="ticker-track">${group(false)}${group(true)}
        </div>
      </div>
    </div>
  </div>`;
}

function adMarkup(ad, lang) {
  if (!ad) return '';
  const width = Math.min(100, Math.max(25, Number(ad.display_width) || 100));
  const maxHeight = Number(ad.max_height) || null;
  const fit = ad.image_fit === 'contain' ? 'contain' : 'cover';
  const wrapStyle = `width:${width}%${width < 100 ? ';margin-left:auto;margin-right:auto' : ''}`;
  const imgStyle = maxHeight
    ? ` style="height:${maxHeight}px;object-fit:${fit}"`
    : '';
  return `
  <div class="ad-slot" data-ad-id="${escapeHtml(ad.id)}" style="${wrapStyle}">
    <span class="ad-label">${lang === 'kn' ? 'ಜಾಹೀರಾತು' : 'Advertisement'}</span>
    <a href="${escapeHtml(ad.click_url)}" target="_blank" rel="noopener sponsored" data-ad-click="${escapeHtml(ad.id)}">
      <img src="${escapeHtml(ad.image?.optimized || '')}" alt="${escapeHtml(ad.title)}" loading="lazy"${imgStyle} />
    </a>
  </div>`;
}

function shareButtons({ lang, headline, url }) {
  const text = encodeURIComponent(headline);
  const link = encodeURIComponent(url);
  return `
  <div class="share-row">
    <span class="share-label">${escapeHtml(LABELS[lang].share)}</span>
    <a class="share-btn wa" href="https://wa.me/?text=${text}%20${link}" target="_blank" rel="noopener" data-share="whatsapp" aria-label="Share on WhatsApp" title="WhatsApp">WA</a>
    <a class="share-btn fb" href="https://www.facebook.com/sharer/sharer.php?u=${link}" target="_blank" rel="noopener" data-share="facebook" aria-label="Share on Facebook" title="Facebook">f</a>
    <a class="share-btn tg" href="https://t.me/share/url?url=${link}&text=${text}" target="_blank" rel="noopener" data-share="telegram" aria-label="Share on Telegram" title="Telegram">TG</a>
    <a class="share-btn x" href="https://twitter.com/intent/tweet?url=${link}&text=${text}" target="_blank" rel="noopener" data-share="x" aria-label="Share on X" title="X">X</a>
    <button class="share-btn" type="button" data-copy="${escapeHtml(url)}" aria-label="${escapeHtml(LABELS[lang].copyLink)}" title="${escapeHtml(LABELS[lang].copyLink)}">⧉</button>
  </div>`;
}

function relatedCard(item, lang) {
  return `
  <a class="related-item" href="${escapeHtml(item.url)}">
    ${item.image ? `<img src="${escapeHtml(item.image.thumb)}" alt="" loading="lazy" />` : '<span></span>'}
    <span>
      <h4>${escapeHtml(item.headline)}</h4>
      <span class="meta">${escapeHtml(item.category?.name || '')}</span>
    </span>
  </a>`;
}

function footer(lang) {
  return `
<footer class="site-footer">
  <div class="container">
    <div class="footer-main">
      <div>
        ${brand(lang, '', true)}
        <p>Independent, bilingual reporting from every district of Karnataka. Verified by a professional editorial desk.</p>
        <p style="font-size:12px;color:#7f7464;">Thaja Suddi · Bengaluru, Karnataka 560001<br/>contact@thajasuddi.in</p>
      </div>
      <div>
        <h4>Sections</h4>
        <ul class="footer-links">
          <li><a href="/category/karnataka?lang=${lang}">Karnataka</a></li>
          <li><a href="/category/bengaluru?lang=${lang}">Bengaluru</a></li>
          <li><a href="/category/politics?lang=${lang}">Politics</a></li>
          <li><a href="/category/business?lang=${lang}">Business</a></li>
          <li><a href="/category/sports?lang=${lang}">Sports</a></li>
        </ul>
      </div>
      <div>
        <h4>Newsroom</h4>
        <ul class="footer-links">
          <li class="staff-only"><a href="/dashboard">Editorial dashboard</a></li>
          <li><a href="/policies/editorial">Editorial policy</a></li>
          <li><a href="/policies/grievance">Grievance redressal</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul class="footer-links">
          <li><a href="/policies/privacy">Privacy policy</a></li>
          <li><a href="/policies/terms">Terms of use</a></li>
          <li><a href="/policies/advertising">Advertising policy</a></li>
          <li><a href="/policies/community">Community guidelines</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} Thaja Suddi. All rights reserved.</span>
      <span>Made in Karnataka <span class="dot">◆</span> Kannada, English and every district.</span>
    </div>
  </div>
</footer>`;
}

function pageShell({ lang, base, title, description, canonical, ogImage, extraHead = '', body, categories, tickerItems, alternates = [], selfUrl = '' }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#a4162a" />
  <meta property="og:site_name" content="Thaja Suddi" />
  <meta property="og:locale" content="${lang === 'kn' ? 'kn_IN' : 'en_IN'}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:image" content="${escapeHtml(ogImage || `${base}/static/logo.svg`)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage || `${base}/static/logo.svg`)}" />
  <link rel="icon" href="/static/logo.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;500;600;700&family=Noto+Serif:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/static/site.css" />
  ${extraHead}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  ${header({ lang, categories, base, alternates, selfUrl })}
  ${ticker(tickerItems || [], lang)}
  ${body}
  ${footer(lang)}
  <div class="toast" role="status" aria-live="polite"></div>
</body>
</html>`;
}

function insertAfterParagraph(html, count, fragment) {
  let index = -1;
  for (let i = 0; i < count; i += 1) {
    const next = html.indexOf('</p>', index + 1);
    if (next === -1) return `${html}${fragment}`;
    index = next;
  }
  return `${html.slice(0, index + 4)}${fragment}${html.slice(index + 4)}`;
}

function renderArticlePage(article, {
  lang,
  base,
  categories,
  trending,
  latest,
  adsTop,
  adsMid,
  adsInlineSecond,
  adsBeforeComments,
  adsBottom,
  adsSide,
  adsSideBottom,
  adsGlobalTop,
  adsGlobalBottom,
  adsFooter,
}) {
  const labels = LABELS[lang];
  const url = `${base}/${lang}/news/${article.slug}`;
  const image = article.main_image_id ? `${base}${imageUrl(article.main_image_id, 'optimized')}` : `${base}/static/logo.svg`;
  const imageWidth = 1200;
  const imageHeight = 675;
  const title = article.seo_title || article.headline;
  const description = article.seo_description || article.summary || '';
  const published = article.translation_published_at || article.published_at;
  const altLinks = [
    `<link rel="alternate" hreflang="${lang}" href="${escapeHtml(url)}" />`,
    ...article.alternates.map(
      (a) => `<link rel="alternate" hreflang="${a.language}" href="${escapeHtml(`${base}/${a.language}/news/${a.slug}`)}" />`
    ),
  ];
  if (!article.alternates.some((a) => a.language === 'en')) {
    altLinks.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}" />`);
  } else {
    const en = article.alternates.find((a) => a.language === 'en');
    altLinks.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(`${base}/en/news/${en.slug}`)}" />`);
  }

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.headline,
    description,
    image: [image],
    datePublished: published,
    dateModified: article.updated_at,
    inLanguage: lang === 'kn' ? 'kn-IN' : 'en-IN',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: article.author_name },
    publisher: {
      '@type': 'Organization',
      name: 'Thaja Suddi',
      logo: { '@type': 'ImageObject', url: `${base}/static/logo.svg` },
    },
    articleSection: lang === 'kn' ? article.category_name_kn : article.category_name_en,
    keywords: article.tags?.join(', ') || undefined,
  };

  let articleHtml = article.content || '';
  if (adsMid?.length) {
    const inlineAd = `<div class="article-inline-ad">${adsMid.map((ad) => adMarkup(ad, lang)).join('')}</div>`;
    articleHtml = insertAfterParagraph(articleHtml, 1, inlineAd);
  }
  if (adsInlineSecond?.length) {
    const inlineAd = `<div class="article-inline-second-ad">${adsInlineSecond
      .map((ad) => adMarkup(ad, lang))
      .join('')}</div>`;
    articleHtml = insertAfterParagraph(articleHtml, 2, inlineAd);
  }

  const categoryName = lang === 'kn' ? article.category_name_kn : article.category_name_en;
  const districtName = lang === 'kn' ? article.district_name_kn : article.district_name_en;
  const categoryUrl = `/category/${encodeURIComponent(article.category_slug || '')}?lang=${lang}`;

  const commentsBlock = `
    <section class="comments" id="comments" aria-labelledby="comments-title">
      <h2 id="comments-title">${escapeHtml(labels.comments)} <span id="comment-count" style="color:var(--muted);font-size:16px;"></span></h2>
      <p class="comments-note">${escapeHtml(labels.commentsNote)}</p>
      <form class="comment-form" id="comment-form">
        <label class="sr-only" for="comment-name">Name</label>
        <input class="input" id="comment-name" name="guest_name" maxlength="80" placeholder="${escapeHtml(labels.yourName)}" autocomplete="name" />
        <label class="sr-only" for="comment-body">Comment</label>
        <textarea class="textarea" id="comment-body" name="content" maxlength="1000" placeholder="${escapeHtml(labels.commentPlaceholder)}" required></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-size:11px;color:var(--faint);" id="comment-auth-note">${escapeHtml(labels.loginToInteract)}</span>
          <button class="btn" type="submit">${escapeHtml(labels.postComment)}</button>
        </div>
      </form>
      <div class="comment-list" id="comment-list" aria-live="polite"></div>
    </section>`;

  const body = `
  <main class="page article-page" id="main">
    <div class="container" data-article-id="${escapeHtml(article.id)}" data-lang="${lang}" data-url="${escapeHtml(url)}" data-headline="${escapeHtml(article.headline)}">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/?lang=${lang}">${escapeHtml(labels.home)}</a>
        <span class="sep">/</span>
        ${categoryName ? `<a href="${categoryUrl}">${escapeHtml(categoryName)}</a><span class="sep">/</span>` : ''}
        <span>${escapeHtml(article.headline)}</span>
      </nav>

      ${adsGlobalTop?.length ? `<div class="global-top-ad">${adsGlobalTop.map((ad) => adMarkup(ad, lang)).join('')}</div>` : ''}

      <div class="article-grid">
        <article>
          <header class="article-head">
            <div class="kicker">
              ${categoryName ? `<a href="${categoryUrl}">${escapeHtml(categoryName)}</a>` : ''}
              ${article.is_sponsored ? `<span class="sponsored-tag">${escapeHtml(labels.sponsored)}</span>` : ''}
            </div>
            <h1>${escapeHtml(article.headline)}</h1>
            <p class="article-summary">${escapeHtml(article.summary || '')}</p>
            <div class="byline">
              <div class="byline-left">
                <span>${escapeHtml(labels.by)} <strong>${escapeHtml(article.author_name)}</strong></span>
                <span class="sep">•</span>
                <time datetime="${escapeHtml(published || '')}">${escapeHtml(formatDate(published, lang))}</time>
                <span class="sep">•</span>
                <span>${readingTime(article.content, lang)} ${escapeHtml(labels.readTime)}</span>
                ${districtName ? `<span class="sep">•</span><a href="/district/${encodeURIComponent(article.district_slug)}?lang=${lang}" style="color:var(--muted);">${escapeHtml(districtName)}</a>` : ''}
                <span class="sep">•</span>
                <span id="view-count">${Number(article.view_count || 0).toLocaleString('en-IN')} ${escapeHtml(labels.views)}</span>
              </div>
              ${shareButtons({ lang, headline: article.headline, url })}
            </div>
          </header>

          ${article.main_image_id ? `
          <figure class="article-figure">
            <img src="${escapeHtml(imageUrl(article.main_image_id, 'optimized'))}" width="${imageWidth}" height="${imageHeight}" alt="${escapeHtml(article.caption || article.headline)}" />
            ${article.caption ? `<figcaption>${escapeHtml(article.caption)}</figcaption>` : ''}
          </figure>` : ''}

          <div class="article-actions">
            <button class="action-btn" id="like-btn" type="button" aria-pressed="false">
              <span aria-hidden="true">♥</span> <span>${escapeHtml(labels.like)}</span> <span class="count" id="like-count">0</span>
            </button>
            <button class="action-btn" id="bookmark-btn" type="button" aria-pressed="false">
              <span aria-hidden="true">▮</span> <span>${escapeHtml(labels.bookmark)}</span>
            </button>
            <button class="action-btn" id="report-btn" type="button">
              <span aria-hidden="true">⚑</span> ${escapeHtml(labels.correction)}
            </button>
            <span class="count" id="share-count" style="margin-left:auto;"></span>
          </div>

          ${adsTop?.length ? `<div class="article-banner-ad">${adsTop.map((ad) => adMarkup(ad, lang)).join('')}</div>` : ''}

          <div class="article-body">${articleHtml}</div>

          ${adsBottom?.length ? `<div class="article-bottom-ad">${adsBottom.map((ad) => adMarkup(ad, lang)).join('')}</div>` : ''}

          ${article.tags?.length ? `
          <div class="article-tags">
            ${article.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
          </div>` : ''}

          ${article.source ? `<p class="article-note"><strong>${escapeHtml(labels.source)}:</strong> ${escapeHtml(article.source)}</p>` : ''}
          <p class="article-note">${escapeHtml(labels.editNote)} <a href="#" id="report-link" style="color:var(--red);text-decoration:underline;">${escapeHtml(labels.correction)}</a></p>

          ${adsBeforeComments?.length ? `<div class="article-before-comments-ad">${adsBeforeComments.map((ad) => adMarkup(ad, lang)).join('')}</div>` : ''}

          ${commentsBlock}
        </article>

        <aside class="article-side">
          <div class="side-panel">
            <h3>${escapeHtml(labels.related)}</h3>
            <div class="related-list">
              ${article.related.length ? article.related.map((item) => relatedCard(item, lang)).join('') : `<p style="font-size:13px;color:var(--muted);">No related stories yet.</p>`}
            </div>
          </div>
          <div class="side-panel">
            <h3>${escapeHtml(labels.mostRead)}</h3>
            <ol class="trend-list">
              ${trending
                .slice(0, 5)
                .map((item) => `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.headline)}</a><span class="meta">${escapeHtml(item.category?.name || '')}</span></li>`)
                .join('')}
            </ol>
          </div>
          ${adsSide?.length ? `<div class="sidebar-ad-stack">${adsSide.map((ad) => adMarkup(ad, lang)).join('')}</div>` : ''}
          ${adsSideBottom?.length ? `<div class="sidebar-ad-stack sidebar-ad-bottom">${adsSideBottom.map((ad) => adMarkup(ad, lang)).join('')}</div>` : ''}
        </aside>
      </div>

      ${adsGlobalBottom?.length ? `<div class="global-bottom-ad">${adsGlobalBottom.map((ad) => adMarkup(ad, lang)).join('')}</div>` : ''}
    </div>

    <div class="modal-backdrop" id="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div class="modal">
        <h3 id="report-title">${escapeHtml(labels.reportTitle)}</h3>
        <p>${escapeHtml(labels.reportBody)}</p>
        <form id="report-form" style="margin-top:14px;">
          <textarea class="textarea" id="report-reason" maxlength="1000" required placeholder="${lang === 'kn' ? 'ವಿವರ ಬರೆಯಿರಿ…' : 'Describe the issue…'}"></textarea>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="report-cancel">${escapeHtml(labels.cancel)}</button>
            <button type="submit" class="btn">${escapeHtml(labels.reportSubmit)}</button>
          </div>
        </form>
      </div>
    </div>
  </main>
  ${adsFooter?.length ? `<div class="container footer-ad">${adsFooter.map((ad) => adMarkup(ad, lang)).join('')}</div>` : ''}
  <script>window.__KV_ARTICLE__ = ${jsonForScript({
    id: article.id,
    lang,
    url,
    headline: article.headline,
  })};</script>
  <script src="/static/article.js" defer></script>`;

  return pageShell({
    lang,
    base,
    title,
    description,
    canonical: url,
    ogImage: image,
    extraHead: `${altLinks.join('\n  ')}
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="${escapeHtml(published || '')}" />
  <meta property="article:modified_time" content="${escapeHtml(article.updated_at || '')}" />
  <meta property="article:section" content="${escapeHtml(categoryName || '')}" />
  <meta property="article:author" content="${escapeHtml(article.author_name)}" />
  <script type="application/ld+json">${jsonForScript(structured)}</script>`,
    body,
    categories,
    tickerItems: latest.map((item) => ({ headline: item.headline, url: item.url })),
    alternates: article.alternates,
    selfUrl: url,
  });
}

function renderNotFound({ lang, base, categories }) {
  const labels = LABELS[lang];
  const body = `
  <main id="main" class="page">
    <div class="container">
      <div class="empty" style="padding:80px 24px;">
        <span class="kicker">404</span>
        <h1 style="font-size:36px;margin:10px 0 12px;">${escapeHtml(labels.notFoundTitle)}</h1>
        <p style="max-width:52ch;margin:0 auto 24px;color:var(--muted);">${escapeHtml(labels.notFoundBody)}</p>
        <a class="btn" href="/?lang=${lang}">${escapeHtml(labels.backHome)}</a>
      </div>
    </div>
  </main>`;
  return pageShell({
    lang,
    base,
    title: `${labels.notFoundTitle} · Thaja Suddi`,
    description: labels.notFoundBody,
    canonical: `${base}/${lang}/news/not-found`,
    body,
    categories,
  });
}

module.exports = { renderArticlePage, renderNotFound, escapeHtml, baseUrl, LABELS, formatDate };
