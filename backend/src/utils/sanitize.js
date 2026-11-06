const sanitizeHtml = require('sanitize-html');

function cleanArticleHtml(input) {
  return sanitizeHtml(String(input || ''), {
    allowedTags: [
      'p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'figure', 'figcaption',
      'span', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      '*': ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: 'lazy', alt: attribs.alt || '' },
      }),
    },
    allowedStyles: {
      '*': {
        'text-align': [/^(left|right|center|justify)$/],
        'font-weight': [/^(normal|bold|[1-9]00)$/],
        'font-style': [/^(normal|italic)$/],
        width: [/^(auto|100%|[2-9]\d%|1\d{2}px)$/],
        float: [/^(left|right|none)$/],
        margin: [/^(0|auto|\d{1,2}px)( (0|auto|\d{1,2}px)){0,3}$/],
      },
    },
  });
}

function cleanText(input, max = 500) {
  return sanitizeHtml(String(input || ''), { allowedTags: [], allowedAttributes: {} })
    .trim()
    .slice(0, max);
}

module.exports = { cleanArticleHtml, cleanText };
