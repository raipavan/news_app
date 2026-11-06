const CONSONANTS = {
  '\u0C95': 'k', '\u0C96': 'kh', '\u0C97': 'g', '\u0C98': 'gh', '\u0C99': 'ng',
  '\u0C9A': 'ch', '\u0C9B': 'chh', '\u0C9C': 'j', '\u0C9D': 'jh', '\u0C9E': 'ny',
  '\u0C9F': 't', '\u0CA0': 'th', '\u0CA1': 'd', '\u0CA2': 'dh', '\u0CA3': 'n',
  '\u0CA4': 't', '\u0CA5': 'th', '\u0CA6': 'd', '\u0CA7': 'dh', '\u0CA8': 'n',
  '\u0CAA': 'p', '\u0CAB': 'ph', '\u0CAC': 'b', '\u0CAD': 'bh', '\u0CAE': 'm',
  '\u0CAF': 'y', '\u0CB0': 'r', '\u0CB1': 'r', '\u0CB2': 'l', '\u0CB3': 'l',
  '\u0CB5': 'v', '\u0CB6': 'sh', '\u0CB7': 'sh', '\u0CB8': 's', '\u0CB9': 'h',
  '\u0CB2\u0CCD\u0CB2': 'll',
};

const VOWELS = {
  '\u0C85': 'a', '\u0C86': 'aa', '\u0C87': 'i', '\u0C88': 'ee', '\u0C89': 'u',
  '\u0C8A': 'oo', '\u0C8B': 'ru', '\u0C8E': 'e', '\u0C8F': 'ee', '\u0C90': 'ai',
  '\u0C92': 'o', '\u0C93': 'oo', '\u0C94': 'au',
};

const MATRAS = {
  '\u0CBE': 'aa', '\u0CBF': 'i', '\u0CC0': 'ee', '\u0CC1': 'u', '\u0CC2': 'oo',
  '\u0CC3': 'ru', '\u0CC6': 'e', '\u0CC7': 'ee', '\u0CC8': 'ai',
  '\u0CCA': 'o', '\u0CCB': 'oo', '\u0CCC': 'au',
};

const OTHER = {
  '\u0C82': 'n', '\u0C83': 'h', '\u0CBC': 'n',
  '\u0CE6': '0', '\u0CE7': '1', '\u0CE8': '2', '\u0CE9': '3', '\u0CEA': '4',
  '\u0CEB': '5', '\u0CEC': '6', '\u0CED': '7', '\u0CEE': '8', '\u0CEF': '9',
};

const VIRAMA = '\u0CCD';
const ZWJ = '\u200D';

function transliterate(input) {
  let out = '';
  const chars = [...String(input)];
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (ch === ZWJ) continue;
    if (CONSONANTS[ch]) {
      let base = CONSONANTS[ch];
      let next = chars[i + 1];
      if (next === ZWJ) next = chars[i + 2];
      if (next === VIRAMA) {
        out += base;
        i += chars[i + 1] === ZWJ ? 2 : 1;
      } else if (next && MATRAS[next]) {
        out += base + MATRAS[next];
        i += 1;
      } else {
        out += base + 'a';
      }
    } else if (VOWELS[ch]) {
      out += VOWELS[ch];
    } else if (MATRAS[ch]) {
      out += MATRAS[ch];
    } else if (OTHER[ch]) {
      out += OTHER[ch];
    } else if (ch === VIRAMA) {
      // virama handled with the preceding consonant
    } else {
      out += ch;
    }
  }
  return out;
}

function slugify(input, fallback = 'news') {
  const latin = transliterate(String(input || ''));
  let slug = latin
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 90)
    .replace(/-+$/g, '');
  return slug || fallback;
}

async function uniqueSlug(db, table, base, excludeId = null) {
  const column = table === 'categories' ? 'slug' : 'slug';
  let candidate = base;
  let n = 1;
  for (;;) {
    const params = [candidate];
    let sql = `SELECT 1 FROM ${table} WHERE ${column} = $1`;
    if (excludeId) {
      params.push(excludeId);
      sql += ' AND id <> $2';
    }
    const { rowCount } = await db.query(sql, params);
    if (!rowCount) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

module.exports = { slugify, transliterate, uniqueSlug };
