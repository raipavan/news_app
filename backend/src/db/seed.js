const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const { pool } = require('./index');
const { storeImage } = require('../services/imageService');
const env = require('../config/env');

const PASSWORD = {
  admin: 'Admin@12345',
  editor: 'Editor@12345',
  reporter: 'Reporter@12345',
  contributor: 'Contributor@12345',
  reader: 'Reader@12345',
};

const DISTRICTS = [
  ['Bagalkot', 'ಬಾಗಲಕೋಟೆ'], ['Ballari', 'ಬಳ್ಳಾರಿ'], ['Belagavi', 'ಬೆಳಗಾವಿ'],
  ['Bengaluru Urban', 'ಬೆಂಗಳೂರು ನಗರ'], ['Bengaluru Rural', 'ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ'],
  ['Bidar', 'ಬೀದರ್'], ['Chamarajanagar', 'ಚಾಮರಾಜನಗರ'], ['Chikkaballapur', 'ಚಿಕ್ಕಬಳ್ಳಾಪುರ'],
  ['Chikkamagaluru', 'ಚಿಕ್ಕಮಗಳೂರು'], ['Chitradurga', 'ಚಿತ್ರದುರ್ಗ'], ['Dakshina Kannada', 'ದಕ್ಷಿಣ ಕನ್ನಡ'],
  ['Davanagere', 'ದಾವಣಗೆರೆ'], ['Dharwad', 'ಧಾರವಾಡ'], ['Gadag', 'ಗದಗ'], ['Hassan', 'ಹಾಸನ'],
  ['Haveri', 'ಹಾವೇರಿ'], ['Kalaburagi', 'ಕಲಬುರಗಿ'], ['Kodagu', 'ಕೊಡಗು'], ['Kolar', 'ಕೋಲಾರ'],
  ['Koppal', 'ಕೊಪ್ಪಳ'], ['Mandya', 'ಮಂಡ್ಯ'], ['Mysuru', 'ಮೈಸೂರು'], ['Raichur', 'ರಾಯಚೂರು'],
  ['Ramanagara', 'ರಾಮನಗರ'], ['Shivamogga', 'ಶಿವಮೊಗ್ಗ'], ['Tumakuru', 'ತುಮಕೂರು'],
  ['Udupi', 'ಉಡುಪಿ'], ['Uttara Kannada', 'ಉತ್ತರ ಕನ್ನಡ'], ['Vijayapura', 'ವಿಜಯಪುರ'],
  ['Yadgir', 'ಯಾದಗಿರಿ'], ['Vijayanagara', 'ವಿಜಯನಗರ'],
];

const CATEGORIES = [
  ['Karnataka', 'ಕರ್ನಾಟಕ', 'karnataka'],
  ['Bengaluru', 'ಬೆಂಗಳೂರು', 'bengaluru'],
  ['Politics', 'ರಾಜಕೀಯ', 'politics'],
  ['Crime', 'ಅಪರಾಧ', 'crime'],
  ['Business', 'ವ್ಯಾಪಾರ', 'business'],
  ['Education', 'ಶಿಕ್ಷಣ', 'education'],
  ['Technology', 'ತಂತ್ರಜ್ಞಾನ', 'technology'],
  ['Sports', 'ಕ್ರೀಡೆ', 'sports'],
  ['Entertainment', 'ಮನರಂಜನೆ', 'entertainment'],
  ['Agriculture', 'ಕೃಷಿ', 'agriculture'],
];

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function imageSvg({ kicker, title, bg = '#101820', accent = '#c99a2e', ink = '#f8f3e9' }) {
  const words = title.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 30) {
      lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  const text = lines
    .slice(0, 3)
    .map((l, i) => `<text x="72" y="${380 + i * 78}" font-family="Georgia, serif" font-weight="700" font-size="66" fill="${ink}">${l}</text>`)
    .join('');
  return `
  <svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="675" fill="${bg}"/>
    <rect x="0" y="0" width="1200" height="12" fill="${accent}"/>
    <circle cx="1050" cy="120" r="190" fill="${accent}" opacity="0.16"/>
    <rect x="0" y="540" width="1200" height="135" fill="#000" opacity="0.22"/>
    <text x="72" y="110" font-family="Arial, sans-serif" font-size="20" letter-spacing="6" fill="${accent}">THAJA SUDDI</text>
    <rect x="72" y="140" width="72" height="5" fill="${accent}"/>
    <text x="72" y="205" font-family="Arial, sans-serif" font-size="20" letter-spacing="4" fill="${ink}" opacity="0.75">${kicker.toUpperCase()}</text>
    ${text}
    <text x="72" y="625" font-family="Arial, sans-serif" font-size="18" letter-spacing="3" fill="${ink}" opacity="0.7">KANNADA + ENGLISH · KARNATAKA</text>
    <text x="1128" y="625" text-anchor="end" font-family="Georgia, serif" font-size="18" fill="${accent}">ತಾಜಾ ಸುದ್ದಿ</text>
  </svg>`;
}

async function makeImage(opts) {
  const svg = imageSvg(opts);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const EN = (paras, quote) =>
  paras.map((p, i) => `<p${i === 0 ? ' class="lead"' : ''}>${p}</p>`).join('') +
  (quote ? `<blockquote>${quote}</blockquote>` : '');

const KN = (paras, quote) =>
  paras.map((p, i) => `<p${i === 0 ? ' class="lead"' : ''}>${p}</p>`).join('') +
  (quote ? `<blockquote>${quote}</blockquote>` : '');

const ARTICLES = [
  {
    key: 'metro',
    category: 'bengaluru',
    district: 'Bengaluru Urban',
    featured: true,
    status: 'published',
    author: 'reporter',
    tags: ['Namma Metro', 'Infrastructure', 'Bengaluru'],
    views: 4820,
    image: { kicker: 'Bengaluru', title: 'Metro extension trials begin on the western corridor', bg: '#14202b', accent: '#d4a43c' },
    en: {
      slug: 'bengaluru-metro-west-extension-trials-begin',
      headline: 'Metro extension trials begin on Bengaluru’s western corridor',
      summary:
        'Trial runs on the 8.4 km stretch between Challaghatta and Kadabagere started on Monday, with commercial operations expected before the year-end festival season.',
      paras: [
        'Bengaluru Metro Rail Corporation Limited (BMRCL) began trial runs on the western extension of the Purple Line on Monday, a stretch that promises to cut travel time for thousands of commuters in the city’s growing western neighbourhoods.',
        'The 8.4 km corridor adds six stations between Challaghatta and Kadabagere. Officials said signalling, platform screen doors and ticketing systems are being tested with empty rakes before safety certification.',
        'Residents of Kengeri, Kommaghatta and Kadabagere have long complained about unreliable bus connections. The new line is expected to connect them directly to the Majestic interchange.',
        'BMRCL has not announced a firm opening date. A senior official said commercial operations are targeted after the final safety inspection, most likely ahead of Deepavali.',
      ],
      quote: 'The trial phase is about proving that every subsystem works together, not just running trains.',
    },
    kn: {
      slug: 'bengaluru-metro-pashchima-vistarana-parikshe',
      headline: 'ಬೆಂಗಳೂರು ಮೆಟ್ರೋ ಪಶ್ಚಿಮ ವಿಸ್ತರಣೆಯಲ್ಲಿ ಪ್ರಾಯೋಗಿಕ ಸಂಚಾರ ಆರಂಭ',
      summary:
        'ಚಲ್ಲಘಟ್ಟದಿಂದ ಕಡಬಗೆರೆವರೆಗಿನ 8.4 ಕಿ.ಮೀ ಮಾರ್ಗದಲ್ಲಿ ಸೋಮವಾರ ಪ್ರಾಯೋಗಿಕ ಸಂಚಾರ ಆರಂಭವಾಗಿದ್ದು, ಈ ವರ್ಷದ ಹಬ್ಬದ ಋತುವಿನ ಮೊದಲು ವಾಣಿಜ್ಯ ಸಂಚಾರ ಆರಂಭವಾಗುವ ನಿರೀಕ್ಷೆ ಇದೆ.',
      paras: [
        'ಬೆಂಗಳೂರು ಮೆಟ್ರೋ ರೈಲು ನಿಗಮ (ಬಿಎಂಆರ್‌ಸಿಎಲ್) ಸೋಮವಾರ ನೇರಳೆ ಮಾರ್ಗದ ಪಶ್ಚಿಮ ವಿಸ್ತರಣೆಯಲ್ಲಿ ಪ್ರಾಯೋಗಿಕ ಸಂಚಾರ ಆರಂಭಿಸಿದೆ. ಇದು ನಗರದ ಪಶ್ಚಿಮ ಭಾಗದ ಸಾವಿರಾರು ಪ್ರಯಾಣಿಕರ ಪ್ರಯಾಣದ ಸಮಯವನ್ನು ಕಡಿಮೆ ಮಾಡುವ ನಿರೀಕ್ಷೆ ಮೂಡಿಸಿದೆ.',
        'ಚಲ್ಲಘಟ್ಟದಿಂದ ಕಡಬಗೆರೆವರೆಗಿನ 8.4 ಕಿ.ಮೀ ಮಾರ್ಗದಲ್ಲಿ ಆರು ನಿಲ್ದಾಣಗಳನ್ನು ಸೇರಿಸಲಾಗಿದೆ. ಸಿಗ್ನಲಿಂಗ್, ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಸ್ಕ್ರೀನ್ ಬಾಗಿಲು ಮತ್ತು ಟಿಕೆಟ್ ವ್ಯವಸ್ಥೆಗಳನ್ನು ಖಾಲಿ ರೈಲುಗಳೊಂದಿಗೆ ಪರೀಕ್ಷಿಸಲಾಗುತ್ತಿದೆ.',
        'ಕೆಂಗೇರಿ, ಕೊಮ್ಮಘಟ್ಟ ಮತ್ತು ಕಡಬಗೆರೆ ನಿವಾಸಿಗಳು ಸಾರಿಗೆ ಸಂಪರ್ಕದ ಕುರಿತು ದೀರ್ಘಕಾಲ ದೂರು ನೀಡಿದ್ದಾರೆ. ಹೊಸ ಮಾರ್ಗವು ಅವರನ್ನು ಮೆಜೆಸ್ಟಿಕ್ ನಿಲ್ದಾಣಕ್ಕೆ ನೇರವಾಗಿ ಸಂಪರ್ಕಿಸಲಿದೆ.',
        'ವಾಣಿಜ್ಯ ಸಂಚಾರದ ನಿರ್ದಿಷ್ಟ ದಿನಾಂಕವನ್ನು ಇನ್ನೂ ಘೋಷಿಸಿಲ್ಲ. ಅಂತಿಮ ಸುರಕ್ಷತಾ ಪರಿಶೀಲನೆಯ ನಂತರ ದೀಪಾವಳಿ ಹಬ್ಬಕ್ಕೆ ಮುಂಚಿತವಾಗಿ ಸೇವೆ ಆರಂಭವಾಗುವ ಸಾಧ್ಯತೆ ಇದೆ ಎಂದು ಹಿರಿಯ ಅಧಿಕಾರಿಯೊಬ್ಬರು ತಿಳಿಸಿದರು.',
      ],
      quote: 'ಪ್ರಾಯೋಗಿಕ ಹಂತದಲ್ಲಿ ರೈಲು ಓಡಿಸುವುದಷ್ಟೇ ಅಲ್ಲ, ಎಲ್ಲಾ ವ್ಯವಸ್ಥೆಗಳು ಒಟ್ಟಿಗೆ ಕೆಲಸ ಮಾಡುತ್ತವೆ ಎಂಬುದನ್ನು ಸಾಬೀತುಪಡಿಸುವುದು ಮುಖ್ಯ.',
    },
  },
  {
    key: 'sowing',
    category: 'agriculture',
    district: 'Mandya',
    featured: true,
    status: 'published',
    author: 'reporter',
    tags: ['Monsoon', 'Farmers', 'Mandya'],
    views: 3610,
    image: { kicker: 'Monsoon', title: 'Kharif sowing crosses target as rains revive', bg: '#1d2a1a', accent: '#c9a24a' },
    en: {
      slug: 'karnataka-kharif-sowing-crosses-target-monsoon-revival',
      headline: 'Kharif sowing crosses target as monsoon revives across Karnataka',
      summary:
        'Agriculture department data shows paddy, ragi and maize acreage has exceeded the season target in 18 districts after two weeks of steady rain.',
      paras: [
        'Kharif sowing in Karnataka has crossed the season target in 18 districts, according to the state agriculture department, after a two-week spell of steady rain revived prospects for rain-fed crops.',
        'Paddy acreage in Mandya, Mysuru and Shivamogga has risen sharply compared with last year. Ragi, a staple in the old Mysuru region, has also recovered after a slow start in June.',
        'Department officials cautioned that a dry spell in August could still hurt yields. Farmers have been advised to stagger transplantation and keep seed stock for gap filling.',
        'In Mandya, cooperative societies said fertiliser supply has improved after early delays. However, labour costs remain a concern for smallholders.',
      ],
      quote: 'The next three weeks will decide whether this is an average year or a good year.',
    },
    kn: {
      slug: 'karnataka-monsoon-kharif-betevaraha-guritakku',
      headline: 'ಮಳೆ ಚೇತರಿಕೆಯಿಂದ ಕರ್ನಾಟಕದಲ್ಲಿ ಖಾರಿಫ್ ಬಿತ್ತನೆ ಗುರಿ ಮೀರಿಸಿದೆ',
      summary:
        'ಎರಡು ವಾರಗಳ ಸ್ಥಿರ ಮಳೆಯ ನಂತರ ರಾಜ್ಯದ 18 ಜಿಲ್ಲೆಗಳಲ್ಲಿ ಭತ್ತ, ರಾಗಿ ಮತ್ತು ಮೆಕ್ಕೆಜೋಳದ ಬಿತ್ತನೆ ಪ್ರದೇಶ ಋತುವಿನ ಗುರಿಯನ್ನು ಮೀರಿದೆ ಎಂದು ಕೃಷಿ ಇಲಾಖೆ ತಿಳಿಸಿದೆ.',
      paras: [
        'ಎರಡು ವಾರಗಳ ಸ್ಥಿರ ಮಳೆಯಿಂದ ಮಳೆಯಾಶ್ರಿತ ಬೆಳೆಗಳಿಗೆ ಉತ್ತಮ ಸೂಚನೆ ಸಿಕ್ಕಿದ್ದು, ರಾಜ್ಯದ 18 ಜಿಲ್ಲೆಗಳಲ್ಲಿ ಖಾರಿಫ್ ಬಿತ್ತನೆ ಋತುವಿನ ಗುರಿಯನ್ನು ಮೀರಿದೆ ಎಂದು ಕೃಷಿ ಇಲಾಖೆಯ ಅಂಕಿ-ಅಂಶಗಳು ತೋರಿಸುತ್ತವೆ.',
        'ಮಂಡ್ಯ, ಮೈಸೂರು ಮತ್ತು ಶಿವಮೊಗ್ಗದಲ್ಲಿ ಭತ್ತದ ಪ್ರದೇಶ ಕಳೆದ ವರ್ಷಕ್ಕೆ ಹೋಲಿಸಿದರೆ ಗಣನೀಯವಾಗಿ ಹೆಚ್ಚಿದೆ. ಜೂನ್‌ನಲ್ಲಿ ನಿಧಾನವಾಗಿ ಆರಂಭವಾದ ರಾಗಿ ಬಿತ್ತನೆಯೂ ಚೇತರಿಸಿದೆ.',
        'ಆಗಸ್ಟ್‌ನಲ್ಲಿ ಒಣ ಹವೆ ಉಂಟಾದರೆ ಇಳುವರಿಗೆ ಹಾನಿಯಾಗಬಹುದು ಎಂದು ಅಧಿಕಾರಿಗಳು ಎಚ್ಚರಿಕೆ ನೀಡಿದ್ದಾರೆ. ಬಿತ್ತನೆಯನ್ನು ಹಂತಹಂತವಾಗಿ ಮಾಡಲು ಮತ್ತು ಬೀಜದ ದಾಸ್ತಾನು ಕಾಯ್ದಿರಿಸಲು ರೈತರಿಗೆ ಸಲಹೆ ನೀಡಲಾಗಿದೆ.',
        'ಮಂಡ್ಯದ ಸಹಕಾರ ಸಂಘಗಳು ಆರಂಭಿಕ ವಿಳಂಬದ ನಂತರ ರಸಗೊಬ್ಬರ ಪೂರೈಕೆ ಸುಧಾರಿಸಿದೆ ಎಂದು ತಿಳಿಸಿವೆ. ಆದರೆ ಕೂಲಿ ದರ ಹೆಚ್ಚಳ ಸಣ್ಣ ರೈತರಿಗೆ ಕಳವಳ ಉಂಟುಮಾಡಿದೆ.',
      ],
      quote: 'ಮುಂದಿನ ಮೂರು ವಾರಗಳು ಸರಾಸರಿ ವರ್ಷವೋ ಉತ್ತಮ ವರ್ಷವೋ ಎಂಬುದನ್ನು ನಿರ್ಧರಿಸುತ್ತವೆ.',
    },
  },
  {
    key: 'dasara',
    category: 'entertainment',
    district: 'Mysuru',
    featured: true,
    status: 'published',
    author: 'contributor',
    tags: ['Mysuru Dasara', 'Festival', 'Tourism'],
    views: 2980,
    image: { kicker: 'Mysuru Dasara', title: 'Dasara preparations begin with palace illumination works', bg: '#2a1215', accent: '#e0b45a' },
    en: {
      slug: 'mysuru-dasara-preparations-palace-illumination-begin',
      headline: 'Mysuru Dasara preparations begin with palace illumination works',
      summary:
        'The district administration has started tendering for illumination, food stalls and security arrangements, with the ten-day festival scheduled from October 1.',
      paras: [
        'Preparations for Mysuru Dasara began this week with the district administration inviting tenders for the illumination of the palace and major roads, one of the most closely watched rituals of the ten-day festival.',
        'The Jamboo Savari procession will follow its traditional route from the palace to Bannimantap. Officials said seating capacity and crowd management plans will be announced after a coordination meeting with police.',
        'Hoteliers expect strong occupancy after two years of subdued celebrations. Bookings for the Dasara week are already above 70 percent, according to the Mysuru Hotel Owners Association.',
        'Cultural committees have requested additional evening performances at the palace grounds and a dedicated shuttle service for visitors arriving from Bengaluru.',
      ],
      quote: 'Dasara is not just a festival for Mysuru. It is the state’s cultural signature.',
    },
    kn: {
      slug: 'mysuru-dasara-arambha-aramaneyu-dipalu-alankara',
      headline: 'ಅರಮನೆ ದೀಪಾಲಂಕಾರ ಕಾಮಗಾರಿಯೊಂದಿಗೆ ಮೈಸೂರು ದಸರಾ ಸಿದ್ಧತೆ ಆರಂಭ',
      summary:
        'ಅಕ್ಟೋಬರ್ 1ರಿಂದ ಹತ್ತು ದಿನಗಳ ದಸರಾ ಹಬ್ಬ ಆರಂಭವಾಗಲಿದ್ದು, ದೀಪಾಲಂಕಾರ, ಆಹಾರ ಮಳಿಗೆಗಳು ಮತ್ತು ಭದ್ರತಾ ವ್ಯವಸ್ಥೆಗೆ ಜಿಲ್ಲಾಡಳಿತ ಟೆಂಡರ್ ಪ್ರಕ್ರಿಯೆ ಆರಂಭಿಸಿದೆ.',
      paras: [
        'ಮೈಸೂರು ದಸರಾ ಸಿದ್ಧತೆಗಳು ಈ ವಾರ ಆರಂಭವಾಗಿದ್ದು, ಅರಮನೆ ಮತ್ತು ಪ್ರಮುಖ ರಸ್ತೆಗಳ ದೀಪಾಲಂಕಾರಕ್ಕೆ ಜಿಲ್ಲಾಡಳಿತ ಟೆಂಡರ್ ಆಹ್ವಾನಿಸಿದೆ. ಹತ್ತು ದಿನಗಳ ಹಬ್ಬದ ಅತ್ಯಂತ ಆಕರ್ಷಕ ಸಂಪ್ರದಾಯ ಇದಾಗಿದೆ.',
        'ಜಂಬೂ ಸವಾರಿ ಮೆರವಣಿಗೆ ಅರಮನೆಯಿಂದ ಬನ್ನಿಮಂಟಪದವರೆಗಿನ ಸಾಂಪ್ರದಾಯಿಕ ಮಾರ್ಗದಲ್ಲಿ ನಡೆಯಲಿದೆ. ಪೊಲೀಸರೊಂದಿಗೆ ಸಮನ್ವಯ ಸಭೆ ನಡೆಸಿದ ನಂತರ ಆಸನ ಸಾಮರ್ಥ್ಯ ಮತ್ತು ಜನಸಂದಣಿ ನಿರ್ವಹಣೆಯ ವಿವರ ಘೋಷಣೆಯಾಗಲಿದೆ.',
        'ಕಳೆದ ಎರಡು ವರ್ಷಗಳ ಸರಳ ಆಚರಣೆಯ ನಂತರ ಹೋಟೆಲ್‌ಗಳಲ್ಲಿ ಉತ್ತಮ ಆಕ್ಯುಪೆನ್ಸಿ ನಿರೀಕ್ಷಿಸಲಾಗಿದೆ. ದಸರಾ ವಾರದ ಬುಕಿಂಗ್ ಈಗಾಗಲೇ ಶೇಕಡಾ 70ಕ್ಕಿಂತ ಹೆಚ್ಚಿದೆ ಎಂದು ಮೈಸೂರು ಹೋಟೆಲ್ ಮಾಲೀಕರ ಸಂಘ ತಿಳಿಸಿದೆ.',
        'ಅರಮನೆ ಆವರಣದಲ್ಲಿ ಹೆಚ್ಚುವರಿ ಸಂಜೆ ಪ್ರದರ್ಶನಗಳು ಮತ್ತು ಬೆಂಗಳೂರಿನಿಂದ ಬರುವ ಪ್ರವಾಸಿಗರಿಗೆ ವಿಶೇಷ ಶಟಲ್ ಸೇವೆ ಒದಗಿಸುವಂತೆ ಸಾಂಸ್ಕೃತಿಕ ಸಮಿತಿಗಳು ಮನವಿ ಮಾಡಿವೆ.',
      ],
      quote: 'ದಸರಾ ಮೈಸೂರಿಗೆ ಮಾತ್ರವಲ್ಲ, ಇಡೀ ರಾಜ್ಯದ ಸಾಂಸ್ಕೃತಿಕ ಗುರುತು.',
    },
  },
  {
    key: 'tech',
    category: 'technology',
    district: 'Bengaluru Urban',
    status: 'published',
    author: 'reporter',
    tags: ['Investment', 'Startups', 'Employment'],
    views: 2540,
    image: { kicker: 'Technology', title: 'Global firms commit new investment in Bengaluru tech corridor', bg: '#0f1f28', accent: '#5fb4c9' },
    en: {
      slug: 'bengaluru-tech-corridor-new-investment-commitments',
      headline: 'Global firms commit new investment in Bengaluru tech corridor',
      summary:
        'Three semiconductor design and cloud engineering companies announced expansion plans expected to create about 4,200 jobs over the next three years.',
      paras: [
        'Three global technology companies announced expansion plans for their Bengaluru engineering centres on Tuesday, in a fresh sign that demand for chip design and cloud engineering talent remains strong.',
        'The companies said the new facilities would come up in the city’s northern technology corridor and would focus on semiconductor design, artificial intelligence infrastructure and platform engineering.',
        'Industry associations estimate that Karnataka accounts for a large share of India’s electronics design workforce. The state government has been promoting its engineering research and development policy to attract similar investments.',
        'Officials cautioned that hiring will depend on the global demand cycle. Companies are expected to begin recruitment for senior engineering roles early next year.',
      ],
      quote: 'The talent ecosystem in Bengaluru remains the single biggest reason companies keep returning.',
    },
    kn: {
      slug: 'bengaluru-tech-corridor-nalu-savira-udyoga-avakasha',
      headline: 'ಬೆಂಗಳೂರು ತಂತ್ರಜ್ಞಾನ ವಲಯದಲ್ಲಿ ಹೊಸ ಹೂಡಿಕೆ, 4,200 ಉದ್ಯೋಗ ಅವಕಾಶ',
      summary:
        'ಮೂರು ಜಾಗತಿಕ ತಂತ್ರಜ್ಞಾನ ಕಂಪನಿಗಳು ವಿಸ್ತರಣಾ ಯೋಜನೆ ಘೋಷಿಸಿದ್ದು, ಮುಂದಿನ ಮೂರು ವರ್ಷಗಳಲ್ಲಿ ಸುಮಾರು 4,200 ಉದ್ಯೋಗಗಳು ಸೃಷ್ಟಿಯಾಗುವ ನಿರೀಕ್ಷೆ ಇದೆ.',
      paras: [
        'ಮೂರು ಜಾಗತಿಕ ತಂತ್ರಜ್ಞಾನ ಕಂಪನಿಗಳು ಮಂಗಳವಾರ ಬೆಂಗಳೂರಿನ ತಮ್ಮ ಎಂಜಿನಿಯರಿಂಗ್ ಕೇಂದ್ರಗಳ ವಿಸ್ತರಣಾ ಯೋಜನೆ ಘೋಷಿಸಿದ್ದು, ಚಿಪ್ ವಿನ್ಯಾಸ ಮತ್ತು ಕ್ಲೌಡ್ ಎಂಜಿನಿಯರಿಂಗ್ ಪ್ರತಿಭೆಗಳಿಗೆ ಬೇಡಿಕೆ ಬಲವಾಗಿದೆ ಎಂಬುದನ್ನು ಸೂಚಿಸುತ್ತದೆ.',
        'ನಗರದ ಉತ್ತರ ತಂತ್ರಜ್ಞಾನ ವಲಯದಲ್ಲಿ ಹೊಸ ಸೌಲಭ್ಯಗಳು ಆರಂಭವಾಗಲಿದ್ದು, ಅರೆವಾಹಕ ವಿನ್ಯಾಸ, ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಮೂಲಸೌಕರ್ಯ ಮತ್ತು ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಎಂಜಿನಿಯರಿಂಗ್ ಮೇಲೆ ಗಮನ ಹರಿಸಲಿವೆ ಎಂದು ಕಂಪನಿಗಳು ತಿಳಿಸಿವೆ.',
        'ಭಾರತದ ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್ ವಿನ್ಯಾಸ ಕಾರ್ಯಪಡೆಯಲ್ಲಿ ಕರ್ನಾಟಕಕ್ಕೆ ದೊಡ್ಡ ಪಾಲು ಇದೆ ಎಂದು ಕೈಗಾರಿಕಾ ಸಂಘಟನೆಗಳು ಅಂದಾಜಿಸಿವೆ. ಇದೇ ರೀತಿಯ ಹೂಡಿಕೆಗಳನ್ನು ಆಕರ್ಷಿಸಲು ಸರ್ಕಾರ ಇಂಜಿನಿಯರಿಂಗ್ ಸಂಶೋಧನೆ ಮತ್ತು ಅಭಿವೃದ್ಧಿ ನೀತಿ ಜಾರಿಗೆ ತರುತ್ತಿದೆ.',
        'ಜಾಗತಿಕ ಬೇಡಿಕೆ ಚಕ್ರವನ್ನು ಅವಲಂಬಿಸಿ ನೇಮಕಾತಿ ನಡೆಯಲಿದೆ ಎಂದು ಅಧಿಕಾರಿಗಳು ಎಚ್ಚರಿಸಿದ್ದಾರೆ. ಮುಂದಿನ ವರ್ಷದ ಆರಂಭದಲ್ಲಿ ಹಿರಿಯ ಎಂಜಿನಿಯರಿಂಗ್ ಹುದ್ದೆಗಳಿಗೆ ನೇಮಕಾತಿ ಆರಂಭವಾಗುವ ನಿರೀಕ್ಷೆ ಇದೆ.',
      ],
      quote: 'ಬೆಂಗಳೂರಿನ ಪ್ರತಿಭಾ ಪರಿಸರವೇ ಕಂಪನಿಗಳು ಮತ್ತೆ ಮತ್ತೆ ಇಲ್ಲಿಗೆ ಬರಲು ಪ್ರಮುಖ ಕಾರಣ.',
    },
  },
  {
    key: 'heritage',
    category: 'karnataka',
    district: 'Mysuru',
    status: 'published',
    author: 'contributor',
    tags: ['Heritage', 'Tourism', 'Mysuru'],
    views: 1870,
    image: { kicker: 'Heritage', title: 'Heritage walk maps old Mysuru trading streets', bg: '#241c14', accent: '#d2ae72' },
    en: {
      slug: 'mysuru-heritage-walk-trading-streets-map',
      headline: 'New heritage walk maps the old trading streets of Mysuru',
      summary:
        'A citizen-led initiative has documented 42 heritage buildings, including colonial-era shops and traditional courtyards, in the city’s old market quarter.',
      paras: [
        'A citizen-led heritage initiative has released a walking map of Mysuru’s old trading quarter, documenting 42 buildings that date back to the early twentieth century.',
        'The route covers the lanes around Devaraja Market, where traders still sell flowers, sandalwood and hand-pressed oil. Researchers interviewed shopkeepers and families who have lived in the area for generations.',
        'The map is available at the market’s information desk and through a free digital download. Organisers hope it will encourage visitors to explore beyond the palace and the zoo.',
        'Heritage experts said documentation is only a first step. Conservation of privately owned buildings will require incentives and a clear regulatory framework.',
      ],
      quote: 'These streets are a living archive. The map simply helps people read them.',
    },
    kn: {
      slug: 'mysuru-heritage-walk-hale-vanijya-rasthe-nakasha',
      headline: 'ಮೈಸೂರಿನ ಹಳೆಯ ವಾಣಿಜ್ಯ ರಸ್ತೆಗಳಿಗೆ ಹೊಸ ಪರಂಪರೆ ನಡಿಗೆ ನಕ್ಷೆ',
      summary:
        'ನಾಗರಿಕರ ನೇತೃತ್ವದ ಯೋಜನೆಯು ಹಳೆಯ ಮಾರುಕಟ್ಟೆ ಪ್ರದೇಶದ 42 ಪರಂಪರೆ ಕಟ್ಟಡಗಳನ್ನು ದಾಖಲಿಸಿ ನಡಿಗೆ ನಕ್ಷೆ ಬಿಡುಗಡೆ ಮಾಡಿದೆ.',
      paras: [
        'ನಾಗರಿಕರ ನೇತೃತ್ವದ ಪರಂಪರೆ ಯೋಜನೆಯೊಂದು ಮೈಸೂರಿನ ಹಳೆಯ ವಾಣಿಜ್ಯ ಪ್ರದೇಶದ ನಡಿಗೆ ನಕ್ಷೆಯನ್ನು ಬಿಡುಗಡೆ ಮಾಡಿದ್ದು, ಇಪ್ಪತ್ತನೇ ಶತಮಾನದ ಆರಂಭದ 42 ಕಟ್ಟಡಗಳನ್ನು ದಾಖಲಿಸಿದೆ.',
        'ದೇವರಾಜ ಮಾರುಕಟ್ಟೆ ಸುತ್ತಮುತ್ತಲಿನ ಸಣ್ಣ ರಸ್ತೆಗಳು ಈ ಮಾರ್ಗದಲ್ಲಿವೆ. ಇಂದಿಗೂ ವ್ಯಾಪಾರಿಗಳು ಹೂವು, ಶ್ರೀಗಂಧ ಮತ್ತು ಗಾಣದ ಎಣ್ಣೆ ಮಾರಾಟ ಮಾಡುತ್ತಾರೆ. ಹಲವು ತಲೆಮಾರುಗಳಿಂದ ಇಲ್ಲಿ ವಾಸಿಸುತ್ತಿರುವ ಕುಟುಂಬಗಳೊಂದಿಗೆ ಸಂಶೋಧಕರು ಸಂವಾದ ನಡೆಸಿದ್ದಾರೆ.',
        'ಮಾರುಕಟ್ಟೆಯ ಮಾಹಿತಿ ಕೇಂದ್ರದಲ್ಲಿ ಮತ್ತು ಉಚಿತ ಡಿಜಿಟಲ್ ಡೌನ್‌ಲೋಡ್ ಮೂಲಕ ನಕ್ಷೆ ಲಭ್ಯವಿದೆ. ಅರಮನೆ ಮತ್ತು ಮೃಗಾಲಯದಾಚೆಗೂ ಪ್ರವಾಸಿಗರು ಸ್ಥಳಗಳನ್ನು ಅನ್ವೇಷಿಸುವಂತೆ ಈ ಯೋಜನೆ ಪ್ರೋತ್ಸಾಹಿಸುತ್ತದೆ ಎಂದು ಆಯೋಜಕರು ಹೇಳಿದ್ದಾರೆ.',
        'ದಾಖಲೀಕರಣ ಕೇವಲ ಮೊದಲ ಹೆಜ್ಜೆ ಎಂದು ಪರಂಪರೆ ತಜ್ಞರು ಅಭಿಪ್ರಾಯಪಟ್ಟಿದ್ದಾರೆ. ಖಾಸಗಿ ಮಾಲೀಕತ್ವದ ಕಟ್ಟಡಗಳ ಸಂರಕ್ಷಣೆಗೆ ಪ್ರೋತ್ಸಾಹ ಮತ್ತು ಸ್ಪಷ್ಟ ನಿಯಮಗಳ ಅಗತ್ಯವಿದೆ.',
      ],
      quote: 'ಈ ರಸ್ತೆಗಳು ಜೀವಂತ ದಾಖಲೆ. ನಕ್ಷೆ ಅವನ್ನು ಓದಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ ಅಷ್ಟೇ.',
    },
  },
  {
    key: 'budget',
    category: 'education',
    district: 'Bengaluru Urban',
    status: 'published',
    author: 'reporter',
    tags: ['Education', 'State Budget', 'Schools'],
    views: 1490,
    image: { kicker: 'Education', title: 'Budget focus on school infrastructure and teacher training', bg: '#1b2436', accent: '#9fb7db' },
    en: {
      slug: 'karnataka-budget-education-allocation-schools',
      headline: 'Karnataka budget raises education allocation with focus on schools',
      summary:
        'The education department will receive additional funds for classroom construction, digital labs and a state-wide teacher training programme.',
      paras: [
        'Karnataka’s education department will receive an increased allocation in the state budget, with a significant share earmarked for classroom construction and teacher training.',
        'Officials said 1,200 government schools will get new classrooms, while 600 higher primary schools will receive digital learning labs. The training programme will cover teachers in all 31 districts.',
        'Educationists welcomed the focus on infrastructure but said maintenance and staffing remain unresolved. Many rural schools continue to rely on guest teachers.',
        'The department has promised quarterly public reporting on spending. Independent monitoring groups said they will track whether funds reach the school level.',
      ],
      quote: 'Buildings matter, but a school is ultimately its teachers.',
    },
    kn: {
      slug: 'karnataka-budget-shikshana-hana-hani-hosha-kotadi',
      headline: 'ಶಾಲಾ ಮೂಲಸೌಕರ್ಯ ಮತ್ತು ಶಿಕ್ಷಕ ತರಬೇತಿಗೆ ಬಜೆಟ್‌ನಲ್ಲಿ ಹೆಚ್ಚಿನ ಅನುದಾನ',
      summary:
        'ತರಗತಿ ಕೊಠಡಿ ನಿರ್ಮಾಣ, ಡಿಜಿಟಲ್ ಲ್ಯಾಬ್ ಮತ್ತು ರಾಜ್ಯವ್ಯಾಪಿ ಶಿಕ್ಷಕ ತರಬೇತಿ ಕಾರ್ಯಕ್ರಮಕ್ಕೆ ಶಿಕ್ಷಣ ಇಲಾಖೆಗೆ ಹೆಚ್ಚುವರಿ ಅನುದಾನ ನಿಗದಿಯಾಗಿದೆ.',
      paras: [
        'ರಾಜ್ಯ ಬಜೆಟ್‌ನಲ್ಲಿ ಶಿಕ್ಷಣ ಇಲಾಖೆಗೆ ಹೆಚ್ಚಿನ ಅನುದಾನ ದೊರಕಿದ್ದು, ಗಮನಾರ್ಹ ಭಾಗವನ್ನು ತರಗತಿ ಕೊಠಡಿ ನಿರ್ಮಾಣ ಮತ್ತು ಶಿಕ್ಷಕ ತರಬೇತಿಗೆ ಮೀಸಲಿಡಲಾಗಿದೆ.',
        '1,200 ಸರ್ಕಾರಿ ಶಾಲೆಗಳಿಗೆ ಹೊಸ ತರಗತಿ ಕೊಠಡಿಗಳು, 600 ಹಿರಿಯ ಪ್ರಾಥಮಿಕ ಶಾಲೆಗಳಿಗೆ ಡಿಜಿಟಲ್ ಕಲಿಕಾ ಲ್ಯಾಬ್‌ಗಳು ದೊರೆಯಲಿವೆ ಎಂದು ಅಧಿಕಾರಿಗಳು ತಿಳಿಸಿದ್ದಾರೆ. ಎಲ್ಲಾ 31 ಜಿಲ್ಲೆಗಳ ಶಿಕ್ಷಕರಿಗೆ ತರಬೇತಿ ನೀಡಲಾಗುತ್ತದೆ.',
        'ಮೂಲಸೌಕರ್ಯಕ್ಕೆ ಆದ್ಯತೆ ನೀಡಿರುವುದನ್ನು ಶಿಕ್ಷಣ ತಜ್ಞರು ಸ್ವಾಗತಿಸಿದರೂ ನಿರ್ವಹಣೆ ಮತ್ತು ಸಿಬ್ಬಂದಿ ಸಮಸ್ಯೆ ಬಗೆಹರಿದಿಲ್ಲ ಎಂದು ಅಭಿಪ್ರಾಯಪಟ್ಟಿದ್ದಾರೆ. ಹಲವು ಗ್ರಾಮೀಣ ಶಾಲೆಗಳು ಇನ್ನೂ ಅತಿಥಿ ಶಿಕ್ಷಕರ ಮೇಲೆ ಅವಲಂಬಿತವಾಗಿವೆ.',
        'ವೆಚ್ಚದ ಕುರಿತು ಪ್ರತಿ ಮೂರು ತಿಂಗಳಿಗೊಮ್ಮೆ ಸಾರ್ವಜನಿಕ ವರದಿ ನೀಡುವುದಾಗಿ ಇಲಾಖೆ ಭರವಸೆ ನೀಡಿದೆ. ಅನುದಾನ ಶಾಲಾ ಮಟ್ಟಕ್ಕೆ ತಲುಪುತ್ತದೆಯೇ ಎಂಬುದನ್ನು ಸ್ವತಂತ್ರ ಮೇಲ್ವಿಚಾರಣಾ ಗುಂಪುಗಳು ಪರಿಶೀಲಿಸಲಿವೆ.',
      ],
      quote: 'ಕಟ್ಟಡಗಳು ಮುಖ್ಯ, ಆದರೆ ಶಾಲೆಯ ನಿಜವಾದ ಬಲ ಶಿಕ್ಷಕರು.',
    },
  },
  {
    key: 'udupi',
    category: 'karnataka',
    district: 'Udupi',
    status: 'published',
    author: 'contributor',
    tags: ['Coastal', 'Fisheries', 'Rescue'],
    views: 1310,
    image: { kicker: 'Udupi', title: 'Coastal communities coordinate monsoon rescue drills', bg: '#0c2830', accent: '#7cc4b8' },
    en: {
      slug: 'udupi-coastal-communities-monsoon-rescue-drills',
      headline: 'Coastal communities coordinate monsoon rescue drills in Udupi',
      summary:
        'Fishing associations, coast guard teams and panchayat volunteers completed a three-day preparedness exercise across 12 coastal villages.',
      paras: [
        'Fishing associations, Indian Coast Guard teams and panchayat volunteers completed a three-day monsoon preparedness exercise across 12 coastal villages in Udupi district.',
        'The drills covered boat capsize response, first aid, radio communication and evacuation of low-lying homes. Fishermen said rough seas have become harder to predict in recent years.',
        'Panchayats have mapped safe shelters and identified residents who need transport assistance. Emergency contact numbers will be displayed at all fishing harbours.',
        'The district administration said it will review stock levels of rescue equipment before the peak monsoon period and fill gaps in coordination.',
      ],
      quote: 'Preparedness is not a formality. It is the difference between a rescue and a recovery.',
    },
    kn: {
      slug: 'udupi-kadala-grama-monsoon-rachane-abhyasa',
      headline: 'ಉಡುಪಿ ಕರಾವಳಿ ಗ್ರಾಮಗಳಲ್ಲಿ ಮಳೆಗಾಲದ ರಕ್ಷಣಾ ಅಭ್ಯಾಸ',
      summary:
        'ಮೀನುಗಾರಿಕೆ ಸಂಘಗಳು, ಕೋಸ್ಟ್ ಗಾರ್ಡ್ ಮತ್ತು ಗ್ರಾಮ ಪಂಚಾಯತ್ ಸ್ವಯಂಸೇವಕರು 12 ಕರಾವಳಿ ಗ್ರಾಮಗಳಲ್ಲಿ ಮೂರು ದಿನಗಳ ಸಿದ್ಧತಾ ಅಭ್ಯಾಸ ಪೂರ್ಣಗೊಳಿಸಿದ್ದಾರೆ.',
      paras: [
        'ಉಡುಪಿ ಜಿಲ್ಲೆಯ 12 ಕರಾವಳಿ ಗ್ರಾಮಗಳಲ್ಲಿ ಮೀನುಗಾರಿಕೆ ಸಂಘಗಳು, ಭಾರತೀಯ ಕೋಸ್ಟ್ ಗಾರ್ಡ್ ತಂಡಗಳು ಮತ್ತು ಗ್ರಾಮ ಪಂಚಾಯತ್ ಸ್ವಯಂಸೇವಕರು ಮೂರು ದಿನಗಳ ಮಳೆಗಾಲ ಪೂರ್ವ ಸಿದ್ಧತಾ ಅಭ್ಯಾಸ ನಡೆಸಿದರು.',
        'ದೋಣಿ ಮಗ್ಗುಲಾಗುವ ಸಂದರ್ಭದ ಪ್ರತಿಕ್ರಿಯೆ, ಪ್ರಥಮ ಚಿಕಿತ್ಸೆ, ರೇಡಿಯೋ ಸಂವಹನ ಮತ್ತು ತಗ್ಗು ಪ್ರದೇಶದ ಮನೆಗಳ ಸ್ಥಳಾಂತರ ಅಭ್ಯಾಸ ನಡೆಸಲಾಯಿತು. ಇತ್ತೀಚಿನ ವರ್ಷಗಳಲ್ಲಿ ಸಮುದ್ರ ಪರಿಸ್ಥಿತಿ ಊಹಿಸಲು ಕಷ್ಟವಾಗಿದೆ ಎಂದು ಮೀನುಗಾರರು ಹೇಳಿದರು.',
        'ಪಂಚಾಯತ್‌ಗಳು ಸುರಕ್ಷಿತ ಆಶ್ರಯ ತಾಣಗಳನ್ನು ಗುರುತಿಸಿ, ಸಾರಿಗೆ ಸಹಾಯ ಬೇಕಿರುವ ನಿವಾಸಿಗಳ ಪಟ್ಟಿ ಸಿದ್ಧಪಡಿಸಿವೆ. ಎಲ್ಲಾ ಮೀನುಗಾರಿಕೆ ಬಂದರುಗಳಲ್ಲಿ ತುರ್ತು ಸಂಪರ್ಕ ಸಂಖ್ಯೆಗಳನ್ನು ಪ್ರದರ್ಶಿಸಲಾಗುತ್ತದೆ.',
        'ಮಳೆಯ ಉತ್ತುಂಗ ಕಾಲದ ಮೊದಲು ರಕ್ಷಣಾ ಸಾಮಗ್ರಿಗಳ ದಾಸ್ತಾನು ಪರಿಶೀಲಿಸಿ, ಸಮನ್ವಯದ ಕೊರತೆಗಳನ್ನು ಸರಿಪಡಿಸಲಾಗುವುದು ಎಂದು ಜಿಲ್ಲಾಡಳಿತ ತಿಳಿಸಿದೆ.',
      ],
      quote: 'ಸಿದ್ಧತೆ ಕೇವಲ ಔಪಚಾರಿಕತೆಯಲ್ಲ. ಅದು ರಕ್ಷಣೆ ಮತ್ತು ಪುನರ್ವಸತಿ ನಡುವಿನ ವ್ಯತ್ಯಾಸ.',
    },
  },
  {
    key: 'textile',
    category: 'business',
    district: 'Dharwad',
    status: 'published',
    author: 'reporter',
    tags: ['Textiles', 'Hubballi', 'Small Business'],
    views: 980,
    image: { kicker: 'Business', title: 'Textile market in Hubballi sees a quiet revival', bg: '#2b1d2b', accent: '#c98fb0' },
    en: {
      slug: 'hubballi-textile-market-quiet-revival',
      headline: 'Hubballi textile market sees a quiet revival as orders return',
      summary:
        'Wholesale traders report a steady rise in orders from northern Karnataka towns, though margins remain tight amid rising transport costs.',
      paras: [
        'Wholesale textile traders in Hubballi say orders have picked up over the past two months, a modest recovery after a difficult year for the region’s retail supply chain.',
        'Shops around the old market area report demand from smaller towns in Dharwad, Gadag and Haveri. Wedding season purchases have helped clear inventory that had been sitting since last year.',
        'Traders said transport and power costs continue to squeeze margins. Several are experimenting with smaller order sizes and faster restocking rather than large seasonal purchases.',
        'The district industries centre said it is working on a common facility for dyeing and finishing, which small units have long demanded.',
      ],
      quote: 'The market is not booming. But it has stopped falling, and that matters.',
    },
    kn: {
      slug: 'hubballi-janavastra-mandai-nidhana-chetareke',
      headline: 'ಹುಬ್ಬಳ್ಳಿ ಜವಳಿ ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ನಿಧಾನ ಚೇತರಿಕೆ',
      summary:
        'ಉತ್ತರ ಕರ್ನಾಟಕದ ಪಟ್ಟಣಗಳಿಂದ ಆರ್ಡರ್ ಹೆಚ್ಚಳವಾಗಿದ್ದು, ಸಾಗಣೆ ವೆಚ್ಚದ ಏರಿಕೆಯಿಂದ ಲಾಭಾಂಶ ಕಡಿಮೆಯಾಗಿದೆ ಎಂದು ಸಗಟು ವ್ಯಾಪಾರಿಗಳು ತಿಳಿಸಿದ್ದಾರೆ.',
      paras: [
        'ಹುಬ್ಬಳ್ಳಿಯ ಸಗಟು ಜವಳಿ ವ್ಯಾಪಾರಿಗಳ ಪ್ರಕಾರ ಕಳೆದ ಎರಡು ತಿಂಗಳಲ್ಲಿ ಆರ್ಡರ್‌ಗಳು ಹೆಚ್ಚಾಗಿವೆ. ಪ್ರಾದೇಶಿಕ ಚಿಲ್ಲರೆ ಪೂರೈಕೆ ಸರಪಳಿಗೆ ಕಳೆದ ವರ್ಷ ಕಷ್ಟಕರವಾಗಿತ್ತು, ಈಗ ಸಣ್ಣ ಪ್ರಮಾಣದ ಚೇತರಿಕೆ ಕಂಡುಬಂದಿದೆ.',
        'ಧಾರವಾಡ, ಗದಗ ಮತ್ತು ಹಾವೇರಿಯ ಸಣ್ಣ ಪಟ್ಟಣಗಳಿಂದ ಬೇಡಿಕೆ ಬರುತ್ತಿದೆ ಎಂದು ಹಳೆಯ ಮಾರುಕಟ್ಟೆ ಪ್ರದೇಶದ ಅಂಗಡಿಗಳು ತಿಳಿಸಿವೆ. ಮದುವೆ ಋತುವಿನ ಖರೀದಿಯಿಂದ ಕಳೆದ ವರ್ಷದ ದಾಸ್ತಾನು ಖಾಲಿಯಾಗಲು ಸಹಾಯವಾಗಿದೆ.',
        'ಸಾಗಣೆ ಮತ್ತು ವಿದ್ಯುತ್ ವೆಚ್ಚ ಲಾಭಾಂಶವನ್ನು ಒತ್ತಡಕ್ಕೆ ಒಳಪಡಿಸುತ್ತಿದೆ ಎಂದು ವ್ಯಾಪಾರಿಗಳು ಹೇಳಿದ್ದಾರೆ. ದೊಡ್ಡ ಪ್ರಮಾಣದ ಖರೀದಿಗಿಂತ ಸಣ್ಣ ಆರ್ಡರ್ ಮತ್ತು ತ್ವರಿತ ಮರುಪೂರೈಕೆಯನ್ನು ಅನೇಕರು ಪ್ರಯತ್ನಿಸುತ್ತಿದ್ದಾರೆ.',
        'ಸಣ್ಣ ಘಟಕಗಳ ದೀರ್ಘಕಾಲದ ಬೇಡಿಕೆಯಾಗಿರುವ ಬಣ್ಣ ಮತ್ತು ಫಿನಿಶಿಂಗ್ ಸಾಮಾನ್ಯ ಸೌಲಭ್ಯ ಕೇಂದ್ರವನ್ನು ಸ್ಥಾಪಿಸುವ ಕೆಲಸ ನಡೆಯುತ್ತಿದೆ ಎಂದು ಜಿಲ್ಲಾ ಕೈಗಾರಿಕಾ ಕೇಂದ್ರ ತಿಳಿಸಿದೆ.',
      ],
      quote: 'ಮಾರುಕಟ್ಟೆ ಉತ್ತುಂಗಕ್ಕೇರಿಲ್ಲ. ಆದರೆ ಕುಸಿತ ನಿಂತಿದೆ, ಅದೇ ಮುಖ್ಯ.',
    },
  },
  {
    key: 'kolar',
    category: 'agriculture',
    district: 'Kolar',
    status: 'published',
    author: 'contributor',
    tags: ['Dairy', 'Cooperative', 'Kolar'],
    views: 760,
    image: { kicker: 'Kolar', title: 'Milk cooperative records its highest daily collection', bg: '#1e2a24', accent: '#a9c98f' },
    en: {
      slug: 'kolar-milk-cooperative-record-daily-collection',
      headline: 'Kolar milk cooperative records its highest daily collection',
      summary:
        'The cooperative’s new chilling centre and improved cattle feed supply helped it cross six lakh litres of milk a day for the first time.',
      paras: [
        'A milk cooperative in Kolar district recorded its highest-ever daily collection this week, crossing six lakh litres for the first time after a new chilling centre became operational.',
        'The cooperative has 38,000 member farmers across four taluks. Improved fodder supply and timely veterinary camps helped increase yields, officials said.',
        'Women’s self-help groups play a major role in collection and testing at village-level centres. The cooperative said it will add two more bulk milk coolers before winter.',
        'Farmers said the procurement price should be revised to reflect rising input costs. The cooperative’s board said a decision will be taken at its next meeting.',
      ],
      quote: 'Every litre here represents a household decision made before sunrise.',
    },
    kn: {
      slug: 'kolar-halu-sahakara-sangha-dainandina-dakhale-garishtha',
      headline: 'ಕೋಲಾರ ಹಾಲು ಸಹಕಾರ ಸಂಘದ ದೈನಂದಿನ ಸಂಗ್ರಹ ದಾಖಲೆ',
      summary:
        'ಹೊಸ ಶೀತಲೀಕರಣ ಕೇಂದ್ರ ಮತ್ತು ಸುಧಾರಿತ ಪಶು ಆಹಾರ ಪೂರೈಕೆಯಿಂದ ದಿನಕ್ಕೆ ಆರು ಲಕ್ಷ ಲೀಟರ್ ಹಾಲು ಸಂಗ್ರಹವಾಗಿದೆ.',
      paras: [
        'ಕೋಲಾರ ಜಿಲ್ಲೆಯ ಹಾಲು ಸಹಕಾರ ಸಂಘ ಈ ವಾರ ತನ್ನ ಇತಿಹಾಸದಲ್ಲಿ ಗರಿಷ್ಠ ದೈನಂದಿನ ಸಂಗ್ರಹ ದಾಖಲಿಸಿದ್ದು, ಹೊಸ ಶೀತಲೀಕರಣ ಕೇಂದ್ರ ಆರಂಭವಾದ ನಂತರ ಮೊದಲ ಬಾರಿಗೆ ಆರು ಲಕ್ಷ ಲೀಟರ್ ಮೀರಿದೆ.',
        'ನಾಲ್ಕು ತಾಲೂಕುಗಳ 38,000 ಸದಸ್ಯ ರೈತರು ಈ ಸಂಘದಲ್ಲಿದ್ದಾರೆ. ಸುಧಾರಿತ ಮೇವು ಪೂರೈಕೆ ಮತ್ತು ಸಕಾಲಿಕ ಪಶುವೈದ್ಯ ಶಿಬಿರಗಳಿಂದ ಇಳುವರಿ ಹೆಚ್ಚಿದೆ ಎಂದು ಅಧಿಕಾರಿಗಳು ತಿಳಿಸಿದ್ದಾರೆ.',
        'ಗ್ರಾಮ ಮಟ್ಟದ ಕೇಂದ್ರಗಳಲ್ಲಿ ಸಂಗ್ರಹ ಮತ್ತು ಪರೀಕ್ಷೆಯಲ್ಲಿ ಮಹಿಳಾ ಸ್ವಸಹಾಯ ಗುಂಪುಗಳ ಪಾತ್ರ ಪ್ರಮುಖವಾಗಿದೆ. ಚಳಿಗಾಲದ ಮೊದಲು ಇನ್ನೂ ಎರಡು ಬಲ್ಕ್ ಮಿಲ್ಕ್ ಕೂಲರ್‌ಗಳನ್ನು ಸೇರಿಸಲಾಗುವುದು ಎಂದು ಸಂಘ ತಿಳಿಸಿದೆ.',
        'ಏರಿಕೆಯಾಗುತ್ತಿರುವ ಉತ್ಪಾದನಾ ವೆಚ್ಚಕ್ಕೆ ಅನುಗುಣವಾಗಿ ಖರೀದಿ ದರ ಪರಿಷ್ಕರಿಸಬೇಕು ಎಂದು ರೈತರು ಒತ್ತಾಯಿಸಿದ್ದಾರೆ. ಮುಂದಿನ ಸಭೆಯಲ್ಲಿ ನಿರ್ಧಾರ ತೆಗೆದುಕೊಳ್ಳಲಾಗುವುದು ಎಂದು ಸಂಘದ ನಿರ್ದೇಶಕ ಮಂಡಳಿ ತಿಳಿಸಿದೆ.',
      ],
      quote: 'ಇಲ್ಲಿನ ಪ್ರತಿ ಲೀಟರ್ ಸೂರ್ಯೋದಯಕ್ಕೂ ಮೊದಲು ಕುಟುಂಬಗಳು ತೆಗೆದುಕೊಂಡ ನಿರ್ಧಾರ.',
    },
  },
  {
    key: 'ranji',
    category: 'sports',
    district: 'Bengaluru Urban',
    status: 'published',
    sponsored: true,
    sponsorLabel: 'Sponsored by Namma Sports Foundation',
    author: 'reporter',
    tags: ['Cricket', 'Ranji Trophy', 'Chinnaswamy'],
    views: 2140,
    image: { kicker: 'Sports', title: 'Ranji final returns to Chinnaswamy after a decade', bg: '#1c2a1e', accent: '#d9b45b' },
    en: {
      slug: 'chinnaswamy-stadium-ranji-trophy-final-return',
      headline: 'Ranji Trophy final returns to Chinnaswamy after a decade',
      summary:
        'Karnataka will host the domestic final in Bengaluru next month, with the state association promising improved player facilities and free entry for schoolchildren.',
      paras: [
        'The Ranji Trophy final will return to Bengaluru’s Chinnaswamy Stadium next month, the first time the domestic season’s showpiece match has been hosted in the city in a decade.',
        'The Karnataka State Cricket Association said preparations include upgraded practice facilities, additional seating and free entry for schoolchildren on the opening day.',
        'Karnataka last reached the final in 2017. The current squad includes several players who came through the state’s age-group system, and selectors expect a strong showing.',
        'The association said ticket sales will open online next week, with the first two days reserved for members before general sale.',
      ],
      quote: 'A domestic final in this stadium always brings back memories of the game’s oldest rivalries.',
    },
    kn: {
      slug: 'chinnaswamy-stadium-ranji-final-hasaru-varshada-nantara',
      headline: 'ಹತ್ತು ವರ್ಷಗಳ ನಂತರ ಚಿನ್ನಸ್ವಾಮಿ ಕ್ರೀಡಾಂಗಣಕ್ಕೆ ರಣಜಿ ಫೈನಲ್',
      summary:
        'ಮುಂದಿನ ತಿಂಗಳು ಬೆಂಗಳೂರಿನಲ್ಲಿ ರಣಜಿ ಟ್ರೋಫಿ ಫೈನಲ್ ನಡೆಯಲಿದ್ದು, ಶಾಲಾ ಮಕ್ಕಳಿಗೆ ಉಚಿತ ಪ್ರವೇಶ ಕಲ್ಪಿಸಲಾಗುವುದು ಎಂದು ಸಂಸ್ಥೆ ತಿಳಿಸಿದೆ.',
      paras: [
        'ಮುಂದಿನ ತಿಂಗಳು ಬೆಂಗಳೂರಿನ ಚಿನ್ನಸ್ವಾಮಿ ಕ್ರೀಡಾಂಗಣದಲ್ಲಿ ರಣಜಿ ಟ್ರೋಫಿ ಫೈನಲ್ ನಡೆಯಲಿದೆ. ಹತ್ತು ವರ್ಷಗಳ ನಂತರ ಈ ನಗರದಲ್ಲಿ ದೇಶೀಯ ಕ್ರಿಕೆಟ್‌ನ ಪ್ರಮುಖ ಪಂದ್ಯ ಆಯೋಜನೆಯಾಗುತ್ತಿದೆ.',
        'ಅಭ್ಯಾಸ ಸೌಲಭ್ಯಗಳ ಸುಧಾರಣೆ, ಹೆಚ್ಚುವರಿ ಆಸನ ವ್ಯವಸ್ಥೆ ಮತ್ತು ಮೊದಲ ದಿನ ಶಾಲಾ ಮಕ್ಕಳಿಗೆ ಉಚಿತ ಪ್ರವೇಶ ಸೇರಿದಂತೆ ಸಿದ್ಧತೆಗಳನ್ನು ಕೈಗೊಳ್ಳಲಾಗಿದೆ ಎಂದು ಕರ್ನಾಟಕ ರಾಜ್ಯ ಕ್ರಿಕೆಟ್ ಸಂಸ್ಥೆ ತಿಳಿಸಿದೆ.',
        '2017ರಲ್ಲಿ ಕರ್ನಾಟಕ ಅಂತಿಮ ಪಂದ್ಯ ತಲುಪಿತ್ತು. ರಾಜ್ಯದ ವಯೋಮಾನ ಗುಂಪು ವ್ಯವಸ್ಥೆಯಿಂದ ಬೆಳೆದ ಅನೇಕ ಆಟಗಾರರು ಪ್ರಸ್ತುತ ತಂಡದಲ್ಲಿದ್ದು, ಉತ್ತಮ ಪ್ರದರ್ಶನದ ನಿರೀಕ್ಷೆ ಇದೆ.',
        'ಮುಂದಿನ ವಾರ ಆನ್‌ಲೈನ್ ಟಿಕೆಟ್ ಮಾರಾಟ ಆರಂಭವಾಗಲಿದ್ದು, ಮೊದಲ ಎರಡು ದಿನಗಳನ್ನು ಸದಸ್ಯರಿಗೆ ಮೀಸಲಿಡಲಾಗುವುದು ಎಂದು ಸಂಸ್ಥೆ ತಿಳಿಸಿದೆ.',
      ],
      quote: 'ಈ ಕ್ರೀಡಾಂಗಣದ ದೇಶೀಯ ಫೈನಲ್ ಯಾವಾಗಲೂ ಹಳೆಯ ಸ್ಪರ್ಧೆಗಳ ನೆನಪು ಮರುಕಳಿಸುತ್ತದೆ.',
    },
  },
  {
    key: 'signal',
    category: 'bengaluru',
    district: 'Bengaluru Urban',
    status: 'submitted',
    author: 'contributor',
    tags: ['Traffic', 'Road Safety'],
    views: 0,
    image: { kicker: 'Traffic', title: 'City traffic police trial adaptive signals at 20 junctions', bg: '#2a1d12', accent: '#d99b52' },
    en: {
      slug: 'bengaluru-adaptive-traffic-signals-trial-junctions',
      headline: 'Bengaluru traffic police trial adaptive signals at 20 junctions',
      summary:
        'The pilot uses vehicle-count sensors to change signal cycles through the day. Officials will compare waiting times before deciding on a city-wide rollout.',
      paras: [
        'The Bengaluru traffic police have begun a pilot of adaptive traffic signals at 20 busy junctions, using sensors to adjust cycle times through the day instead of fixed timers.',
        'The system is expected to reduce unnecessary waiting at intersections where traffic volumes change sharply between morning and evening peaks.',
        'Officials said data from the trial will be compared with manual counts and commuter feedback over the next six weeks.',
        'Residents’ associations have asked for clearer communication about changes in signal timing and pedestrian crossing intervals.',
      ],
      quote: 'The goal is not shorter signals everywhere, but smarter signals where they matter.',
    },
    kn: {
      slug: 'bengaluru-adaptive-traffic-signal-20-junction',
      headline: 'ಬೆಂಗಳೂರಿನ 20 ಜಂಕ್ಷನ್‌ಗಳಲ್ಲಿ ಹೊಂದಿಕೊಳ್ಳುವ ಸಿಗ್ನಲ್ ಪ್ರಯೋಗ',
      summary:
        'ವಾಹನಗಳ ಸಂಖ್ಯೆ ಗುರುತಿಸುವ ಸೆನ್ಸರ್‌ಗಳ ಮೂಲಕ ದಿನದ ವಿವಿಧ ಸಮಯಗಳಲ್ಲಿ ಸಿಗ್ನಲ್ ಸಮಯ ಬದಲಾಗಲಿದೆ. ಯಶಸ್ವಿಯಾದರೆ ನಗರದಾದ್ಯಂತ ಜಾರಿಗೆ ಪರಿಶೀಲನೆ.',
      paras: [
        'ಬೆಂಗಳೂರು ಸಂಚಾರ ಪೊಲೀಸರು 20 ಜನಸಂದಣಿ ಜಂಕ್ಷನ್‌ಗಳಲ್ಲಿ ಹೊಂದಿಕೊಳ್ಳುವ ಸಿಗ್ನಲ್ ವ್ಯವಸ್ಥೆಯ ಪ್ರಯೋಗ ಆರಂಭಿಸಿದ್ದಾರೆ. ಸ್ಥಿರ ಟೈಮರ್ ಬದಲು ಸೆನ್ಸರ್‌ಗಳ ಮೂಲಕ ಸಿಗ್ನಲ್ ಸಮಯವನ್ನು ದಿನದ ಅವಶ್ಯಕತೆಗೆ ಅನುಗುಣವಾಗಿ ಬದಲಿಸಲಾಗುತ್ತದೆ.',
        'ಬೆಳಗ್ಗೆ ಮತ್ತು ಸಂಜೆ ವಾಹನ ದಟ್ಟಣೆ ಬಹಳಷ್ಟು ಬದಲಾಗುವ ಜಂಕ್ಷನ್‌ಗಳಲ್ಲಿ ಅನಗತ್ಯ ಕಾಯುವಿಕೆ ಕಡಿಮೆಯಾಗುವ ನಿರೀಕ್ಷೆ ಇದೆ.',
        'ಮುಂದಿನ ಆರು ವಾರಗಳಲ್ಲಿ ಪ್ರಯೋಗದ ಮಾಹಿತಿಯನ್ನು ಹಸ್ತಚಾಲಿತ ಎಣಿಕೆ ಮತ್ತು ಪ್ರಯಾಣಿಕರ ಪ್ರತಿಕ್ರಿಯೆ ಜೊತೆ ಹೋಲಿಸಲಾಗುವುದು ಎಂದು ಅಧಿಕಾರಿಗಳು ತಿಳಿಸಿದ್ದಾರೆ.',
        'ಸಿಗ್ನಲ್ ಸಮಯ ಮತ್ತು ಪಾದಚಾರಿ ದಾಟುವ ಸಮಯದ ಬದಲಾವಣೆಗಳ ಬಗ್ಗೆ ಸ್ಪಷ್ಟ ಮಾಹಿತಿ ನೀಡುವಂತೆ ನಿವಾಸಿ ಸಂಘಗಳು ಒತ್ತಾಯಿಸಿವೆ.',
      ],
      quote: 'ಎಲ್ಲೆಡೆ ಸಿಗ್ನಲ್ ಸಮಯ ಕಡಿಮೆ ಮಾಡುವುದಲ್ಲ, ಅಗತ್ಯವಿರುವಲ್ಲಿ ಬುದ್ಧಿವಂತ ಸಿಗ್ನಲ್ ಮಾಡುವುದು ಗುರಿ.',
    },
  },
  {
    key: 'relief',
    category: 'karnataka',
    district: 'Kalaburagi',
    status: 'rejected',
    author: 'contributor',
    tags: ['Relief', 'Rain'],
    views: 0,
    rejectionReason: 'Claims about the relief package could not be verified with the district administration. Please attach the official circular and resubmit.',
    image: { kicker: 'Kalaburagi', title: 'District reviews rain relief package for affected taluks', bg: '#232019', accent: '#b7a171' },
    en: {
      slug: 'kalaburagi-rain-relief-package-review',
      headline: 'Kalaburagi district reviews rain relief package for affected taluks',
      summary:
        'The district administration is assessing crop damage across five taluks after unseasonal rain, officials said.',
      paras: [
        'The Kalaburagi district administration is assessing crop damage across five taluks after unseasonal rain last week, officials said.',
        'A preliminary survey will be completed before compensation is announced. Farmers have been asked to report losses at their village accountant’s office.',
        'Several farmer groups have demanded a higher relief amount and faster verification, saying standing crops were damaged close to harvest.',
      ],
      quote: 'Verification is necessary, but it should not take a season.',
    },
    kn: {
      slug: 'kalaburagi-male-parishrama-package-punaravalokane',
      headline: 'ಕಲಬುರಗಿ ಜಿಲ್ಲೆಯಲ್ಲಿ ಮಳೆ ಪರಿಹಾರ ಪ್ಯಾಕೇಜ್ ಪರಿಶೀಲನೆ',
      summary:
        'ಅಕಾಲಿಕ ಮಳೆಯಿಂದ ಐದು ತಾಲೂಕುಗಳಲ್ಲಿ ಬೆಳೆ ಹಾನಿ ಪರಿಶೀಲನೆ ನಡೆಯುತ್ತಿದೆ ಎಂದು ಅಧಿಕಾರಿಗಳು ತಿಳಿಸಿದ್ದಾರೆ.',
      paras: [
        'ಕಳೆದ ವಾರ ಸುರಿದ ಅಕಾಲಿಕ ಮಳೆಯಿಂದ ಐದು ತಾಲೂಕುಗಳಲ್ಲಿ ಬೆಳೆ ಹಾನಿ ಪರಿಶೀಲನೆ ನಡೆಸುತ್ತಿದೆ ಎಂದು ಕಲಬುರಗಿ ಜಿಲ್ಲಾಡಳಿತ ತಿಳಿಸಿದೆ.',
        'ಪರಿಹಾರ ಘೋಷಣೆಗೆ ಮೊದಲು ಪ್ರಾಥಮಿಕ ಸಮೀಕ್ಷೆ ಪೂರ್ಣಗೊಳ್ಳಲಿದೆ. ರೈತರು ತಮ್ಮ ಗ್ರಾಮ ಲೆಕ್ಕಾಧಿಕಾರಿ ಕಚೇರಿಯಲ್ಲಿ ನಷ್ಟ ವರದಿ ಮಾಡುವಂತೆ ಸೂಚಿಸಲಾಗಿದೆ.',
        'ಕೊಯ್ಲಿಗೆ ಸಮೀಪದ ಬೆಳೆ ಹಾನಿಯಾಗಿದ್ದು, ಹೆಚ್ಚಿನ ಪರಿಹಾರ ಮತ್ತು ತ್ವರಿತ ಪರಿಶೀಲನೆ ಒದಗಿಸುವಂತೆ ಹಲವು ರೈತ ಸಂಘಗಳು ಒತ್ತಾಯಿಸಿವೆ.',
      ],
      quote: 'ಪರಿಶೀಲನೆ ಅಗತ್ಯ, ಆದರೆ ಅದು ಒಂದು ಋತುವಿಡೀ ತೆಗೆದುಕೊಳ್ಳಬಾರದು.',
    },
  },
  {
    key: 'cleanup',
    category: 'karnataka',
    district: 'Dakshina Kannada',
    status: 'draft',
    author: 'contributor',
    tags: ['Environment', 'Mangaluru'],
    views: 0,
    image: { kicker: 'Mangaluru', title: 'Coastal clean-up drive planned across four beaches', bg: '#122b2b', accent: '#77b9a8' },
    en: {
      slug: 'mangaluru-coastal-clean-up-four-beaches',
      headline: 'Coastal clean-up drive planned across four beaches in Mangaluru',
      summary:
        'Volunteer groups and college unions will coordinate a clean-up across four beaches next weekend, with waste segregation at collection points.',
      paras: [
        'Volunteer groups and college unions are coordinating a coastal clean-up across four beaches in Mangaluru next weekend.',
        'The plan includes segregated collection points for plastic, glass and general waste, along with a small awareness campaign for visitors.',
      ],
      quote: 'A clean beach is a daily practice, not a single event.',
    },
    kn: {
      slug: 'mangaluru-nalku-beach-swacchata-karyakrama',
      headline: 'ಮಂಗಳೂರಿನ ನಾಲ್ಕು ಕಡಲತೀರಗಳಲ್ಲಿ ಸ್ವಚ್ಛತಾ ಕಾರ್ಯಕ್ರಮ',
      summary:
        'ಸ್ವಯಂಸೇವಕ ಸಂಘಗಳು ಮತ್ತು ಕಾಲೇಜು ಒಕ್ಕೂಟಗಳು ಮುಂದಿನ ವಾರಾಂತ್ಯದಲ್ಲಿ ನಾಲ್ಕು ಕಡಲತೀರಗಳಲ್ಲಿ ಸ್ವಚ್ಛತಾ ಕಾರ್ಯಕ್ರಮ ಆಯೋಜಿಸುತ್ತಿವೆ.',
      paras: [
        'ಮಂಗಳೂರಿನ ನಾಲ್ಕು ಕಡಲತೀರಗಳಲ್ಲಿ ಮುಂದಿನ ವಾರಾಂತ್ಯದಲ್ಲಿ ಸ್ವಚ್ಛತಾ ಕಾರ್ಯಕ್ರಮ ಆಯೋಜಿಸಲು ಸ್ವಯಂಸೇವಕ ಸಂಘಗಳು ಮತ್ತು ಕಾಲೇಜು ಒಕ್ಕೂಟಗಳು ಸಿದ್ಧತೆ ನಡೆಸಿವೆ.',
        'ಪ್ಲಾಸ್ಟಿಕ್, ಗಾಜು ಮತ್ತು ಸಾಮಾನ್ಯ ಕಸಕ್ಕೆ ಪ್ರತ್ಯೇಕ ಸಂಗ್ರಹ ಕೇಂದ್ರಗಳನ್ನು ಒದಗಿಸಲಾಗುತ್ತದೆ. ಪ್ರವಾಸಿಗರಿಗೆ ಜಾಗೃತಿ ಕಾರ್ಯಕ್ರಮವೂ ನಡೆಯಲಿದೆ.',
      ],
      quote: 'ಸ್ವಚ್ಛ ಕಡಲತೀರ ದಿನನಿತ್ಯದ ಅಭ್ಯಾಸ, ಒಂದೇ ದಿನದ ಕಾರ್ಯಕ್ರಮವಲ್ಲ.',
    },
  },
  {
    key: 'market',
    category: 'business',
    district: 'Belagavi',
    status: 'approved',
    author: 'reporter',
    tags: ['Border Trade', 'Belagavi'],
    views: 0,
    image: { kicker: 'Belagavi', title: 'Border market survey points to steady recovery', bg: '#282016', accent: '#cda05c' },
    en: {
      slug: 'belagavi-border-market-survey-recovery',
      headline: 'Belagavi border market survey points to steady recovery',
      summary:
        'A trade survey found higher footfall and stable wholesale prices at the border market, though traders remain cautious about the year ahead.',
      paras: [
        'A trade survey of the Belagavi border market has found higher footfall and stable wholesale prices, pointing to a steady recovery after a slow start to the year.',
        'Traders said transport links and warehousing capacity remain the main constraints. The survey recommends better cold storage for perishable goods.',
        'The report will be discussed at a meeting of trade associations and the district industries centre next week.',
      ],
      quote: 'Recovery is visible, but confidence is still fragile.',
    },
    kn: {
      slug: 'belagavi-border-market-sarveke-nidhana-chetareke',
      headline: 'ಬೆಳಗಾವಿ ಗಡಿ ಮಾರುಕಟ್ಟೆ ಸರ್ವೇಕೆಯಲ್ಲಿ ನಿಧಾನ ಚೇತರಿಕೆ',
      summary:
        'ಸಂದರ್ಶಕರ ಸಂಖ್ಯೆ ಹೆಚ್ಚಳ ಮತ್ತು ಸಗಟು ಬೆಲೆ ಸ್ಥಿರತೆ ಕಂಡುಬಂದಿದ್ದು, ವರ್ಷದ ಮುಂದಿನ ಭಾಗದ ಬಗ್ಗೆ ವ್ಯಾಪಾರಿಗಳು ಜಾಗರೂಕತೆ ಉಳಿಸಿಕೊಂಡಿದ್ದಾರೆ.',
      paras: [
        'ಬೆಳಗಾವಿ ಗಡಿ ಮಾರುಕಟ್ಟೆಯ ವ್ಯಾಪಾರ ಸರ್ವೇಕ್ಷಣೆಯಲ್ಲಿ ಸಂದರ್ಶಕರ ಸಂಖ್ಯೆ ಹೆಚ್ಚಿದ್ದು ಸಗಟು ಬೆಲೆ ಸ್ಥಿರವಾಗಿದೆ. ವರ್ಷದ ಆರಂಭದ ನಿಧಾನತೆಯ ನಂತರ ನಿಧಾನ ಚೇತರಿಕೆ ಕಂಡುಬಂದಿದೆ.',
        'ಸಾಗಣೆ ಸಂಪರ್ಕ ಮತ್ತು ಗೋದಾಮು ಸಾಮರ್ಥ್ಯ ಪ್ರಮುಖ ಸಮಸ್ಯೆಗಳಾಗಿವೆ ಎಂದು ವ್ಯಾಪಾರಿಗಳು ತಿಳಿಸಿದ್ದಾರೆ. ಕೆಡುವ ವಸ್ತುಗಳಿಗೆ ಉತ್ತಮ ಶೀತಲ ಸಂಗ್ರಹ ಅಗತ್ಯ ಎಂದು ವರದಿ ಸೂಚಿಸಿದೆ.',
        'ವರದಿಯನ್ನು ಮುಂದಿನ ವಾರ ವ್ಯಾಪಾರ ಸಂಘಗಳು ಮತ್ತು ಜಿಲ್ಲಾ ಕೈಗಾರಿಕಾ ಕೇಂದ್ರದ ಸಭೆಯಲ್ಲಿ ಚರ್ಚಿಸಲಾಗುವುದು.',
      ],
      quote: 'ಚೇತರಿಕೆ ಕಾಣುತ್ತಿದೆ, ಆದರೆ ವಿಶ್ವಾಸ ಇನ್ನೂ ದುರ್ಬಲ.',
    },
  },
];

const COMMENT_TEXTS = [
  'Good reporting. More districts need this kind of coverage.',
  'Thanks for including the official figures. Hope the follow-up story tracks implementation.',
  'This is exactly the local news we need in Kannada as well.',
  'Could you share the source document for the numbers mentioned?',
  'ಉತ್ತಮ ವರದಿ. ಮುಂದಿನ ದಿನಗಳಲ್ಲಿ ಮತ್ತಷ್ಟು ವಿವರ ನೀಡಿ.',
  'Very useful update for commuters. Please keep tracking this.',
];

async function markSeedVersion() {
  await pool.query(
    `INSERT INTO settings(key, value) VALUES ('seed_version', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify({ version: 1, seeded_at: new Date().toISOString() })]
  );
}

async function main() {
  const seeded = await pool.query(`SELECT 1 FROM settings WHERE key = 'seed_version'`);
  if (seeded.rowCount) {
    console.log('[seed] database already seeded, skipping');
    await pool.end();
    return;
  }
  console.log('[seed] creating roles');
  for (const role of ['super_admin', 'editor', 'reporter', 'contributor', 'reader']) {
    await pool.query(`INSERT INTO roles(role_name) VALUES ($1) ON CONFLICT (role_name) DO NOTHING`, [role]);
  }

  const demo = !env.isProd || process.env.SEED_DEMO === 'true';
  const users = {};

  if (demo) {
    if (env.isProd) {
      console.warn(
        '[seed] SEED_DEMO=true in production: demo accounts with published passwords will be created. Use only for staging.'
      );
    }
    console.log('[seed] creating demo users');
    const userSpecs = [
      ['admin', 'Kavya Rao', 'admin@thajasuddi.in', 'super_admin', true],
      ['editor', 'Raghav Hegde', 'editor@thajasuddi.in', 'editor', true],
      ['reporter', 'Nandini Gowda', 'reporter@thajasuddi.in', 'reporter', true],
      ['contributor', 'Arjun Shetty', 'contributor@thajasuddi.in', 'contributor', false],
      ['reader', 'Meera Kulkarni', 'reader@thajasuddi.in', 'reader', false],
    ];
    for (const [key, name, email, role, canPublish] of userSpecs) {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      let id;
      if (existing.rowCount) {
        id = existing.rows[0].id;
      } else {
        const hash = await bcrypt.hash(PASSWORD[key], 10);
        const inserted = await pool.query(
          `INSERT INTO users(name, email, phone, password_hash, status, can_publish)
           VALUES ($1, $2, $3, $4, 'active', $5) RETURNING id`,
          [name, email, `+9198${String(76543210 + Object.keys(users).length).slice(0, 8)}`, hash, canPublish]
        );
        id = inserted.rows[0].id;
      }
      await pool.query(
        `INSERT INTO user_roles(user_id, role_id)
         SELECT $1, id FROM roles WHERE role_name = $2
         ON CONFLICT DO NOTHING`,
        [id, role]
      );
      users[key] = id;
    }
  } else {
    console.log('[seed] creating bootstrap super admin');
    const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD || '';
    if (!email || password.length < 12) {
      throw new Error(
        'Production seed requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12+ characters). ' +
          'Set SEED_DEMO=true only for staging environments.'
      );
    }
    const existing = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
    let id;
    if (existing.rowCount) {
      id = existing.rows[0].id;
    } else {
      const hash = await bcrypt.hash(password, 12);
      const inserted = await pool.query(
        `INSERT INTO users(name, email, password_hash, status, can_publish)
         VALUES ($1, $2, $3, 'active', TRUE) RETURNING id`,
        [process.env.SEED_ADMIN_NAME || 'Administrator', email, hash]
      );
      id = inserted.rows[0].id;
    }
    await pool.query(
      `INSERT INTO user_roles(user_id, role_id)
       SELECT $1, id FROM roles WHERE role_name = 'super_admin'
       ON CONFLICT DO NOTHING`,
      [id]
    );
    users.admin = id;
  }

  console.log('[seed] creating districts and categories');
  for (const [nameEn, nameKn] of DISTRICTS) {
    await pool.query(
      `INSERT INTO districts(name_en, name_kn, slug) VALUES ($1, $2, $3)
       ON CONFLICT (name_en) DO NOTHING`,
      [nameEn, nameKn, slugify(nameEn)]
    );
  }
  for (let i = 0; i < CATEGORIES.length; i += 1) {
    const [nameEn, nameKn, slug] = CATEGORIES[i];
    await pool.query(
      `INSERT INTO categories(name_en, name_kn, slug, sort_order) VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO NOTHING`,
      [nameEn, nameKn, slug, i]
    );
  }

  const districtRows = await pool.query('SELECT id, name_en FROM districts');
  const districtMap = Object.fromEntries(districtRows.rows.map((r) => [r.name_en, r.id]));

  const TALUKS = {
    'Bengaluru Urban': [
      ['Bengaluru North', 'ಬೆಂಗಳೂರು ಉತ್ತರ'],
      ['Bengaluru South', 'ಬೆಂಗಳೂರು ದಕ್ಷಿಣ'],
      ['Bengaluru East', 'ಬೆಂಗಳೂರು ಪೂರ್ವ'],
      ['Anekal', 'ಅನೇಕಲ್'],
    ],
    Mysuru: [
      ['Mysuru', 'ಮೈಸೂರು'],
      ['Nanjangud', 'ನಂಜನಗೂಡು'],
      ['Hunsur', 'ಹುಣಸೂರು'],
      ['T. Narasipura', 'ಟಿ. ನರಸೀಪುರ'],
    ],
    'Dakshina Kannada': [
      ['Mangaluru', 'ಮಂಗಳೂರು'],
      ['Puttur', 'ಪುತ್ತೂರು'],
      ['Bantwal', 'ಬಂಟ್ವಾಳ'],
      ['Sullia', 'ಸುಳ್ಯ'],
    ],
    Belagavi: [
      ['Belagavi', 'ಬೆಳಗಾವಿ'],
      ['Gokak', 'ಗೋಕಾಕ್'],
      ['Chikkodi', 'ಚಿಕ್ಕೋಡಿ'],
    ],
    Kalaburagi: [
      ['Kalaburagi', 'ಕಲಬುರಗಿ'],
      ['Sedam', 'ಸೇಡಂ'],
      ['Afzalpur', 'ಅಫಜಲಪುರ'],
    ],
    'Uttara Kannada': [
      ['Karwar', 'ಕಾರವಾರ'],
      ['Sirsi', 'ಸಿರ್ಸಿ'],
      ['Kumta', 'ಕುಮಟಾ'],
    ],
  };
  for (const [district, items] of Object.entries(TALUKS)) {
    for (const [nameEn, nameKn] of items) {
      await pool.query(
        `INSERT INTO taluks(district_id, name_en, name_kn)
         SELECT $1::integer, $2::text, $3::text
          WHERE NOT EXISTS (
            SELECT 1 FROM taluks WHERE district_id = $1::integer AND name_en = $2::text
          )`,
        [districtMap[district], nameEn, nameKn]
      );
    }
  }

  const categoryRows = await pool.query('SELECT id, slug FROM categories');
  const categoryMap = Object.fromEntries(categoryRows.rows.map((r) => [r.slug, r.id]));

  if (!demo) {
    await markSeedVersion();
    console.log('[seed] production seed complete: roles, admin, districts, categories and taluks only');
    await pool.end();
    return;
  }

  console.log('[seed] generating and storing cover images');
  const articleImageIds = {};
  for (const article of ARTICLES) {
    const buffer = await makeImage(article.image);
    const stored = await storeImage({
      buffer,
      filename: `${article.key}-cover.png`,
      uploadedBy: users.admin,
    });
    articleImageIds[article.key] = stored.id;
  }

  const ads = [
    {
      title: 'Avani Silks — Dasara Collection',
      advertiser: 'Avani Silks, Mysuru',
      placement: 'home_top',
      amount: 45000,
      sponsored: false,
      svg: { kicker: 'Advertisement', title: 'Avani Silks — Dasara Collection', bg: '#3a1218', accent: '#e1b45c' },
    },
    {
      title: 'Sri Venkateshwara Sweets — Festival Boxes',
      advertiser: 'Sri Venkateshwara Sweets',
      placement: 'home_mid',
      amount: 28000,
      sponsored: false,
      svg: { kicker: 'Advertisement', title: 'Sri Venkateshwara Sweets — Festival Boxes', bg: '#332412', accent: '#e4c379' },
    },
    {
      title: 'Udupi Coastal Resorts — Monsoon Offers',
      advertiser: 'Udupi Coastal Resorts',
      placement: 'article_sidebar',
      amount: 22000,
      sponsored: false,
      svg: { kicker: 'Advertisement', title: 'Udupi Coastal Resorts — Monsoon Offers', bg: '#102b2e', accent: '#8fc8b8' },
    },
  ];
  for (const ad of ads) {
    const buffer = await makeImage(ad.svg);
    const stored = await storeImage({ buffer, filename: `ad-${ad.placement}.png`, uploadedBy: users.admin });
    await pool.query(
      `INSERT INTO advertisements(title, advertiser_name, image_id, destination_url, placement,
          status, is_sponsored, amount_paid, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, NOW() - INTERVAL '10 days', NOW() + INTERVAL '60 days')`,
      [ad.title, ad.advertiser, stored.id, 'https://example.com/advertiser', ad.placement, ad.sponsored, ad.amount]
    );
  }

  console.log('[seed] creating articles, translations and engagement');
  const publishedIds = [];
  let offsetDays = ARTICLES.length + 2;
  for (const article of ARTICLES) {
    const authorId = users[article.author];
    const publishedAt = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
    offsetDays -= 1;
    const articleStatus = article.status;
    const inserted = await pool.query(
      `INSERT INTO articles(author_id, category_id, district_id, status, is_featured, is_sponsored,
          sponsor_label, view_count, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        authorId,
        categoryMap[article.category],
        districtMap[article.district] || null,
        articleStatus,
        Boolean(article.featured),
        Boolean(article.sponsored),
        article.sponsorLabel || null,
        article.views,
        ['published', 'approved'].includes(articleStatus) && article.key !== 'market' ? publishedAt : null,
      ]
    );
    const articleId = inserted.rows[0].id;
    for (const lang of ['en', 'kn']) {
      const t = article[lang];
      const langStatus =
        articleStatus === 'published'
          ? 'published'
          : articleStatus === 'submitted'
            ? 'submitted'
            : articleStatus === 'rejected'
              ? 'rejected'
              : articleStatus === 'approved'
                ? 'approved'
                : 'draft';
      const content = lang === 'en' ? EN(t.paras, t.quote) : KN(t.paras, t.quote);
      const translation = await pool.query(
        `INSERT INTO article_translations(article_id, language, headline, summary, content, slug,
            source, caption, seo_title, seo_description, status, submitted_at, published_at,
            reviewer_id, rejection_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [
          articleId,
          lang,
          t.headline,
          t.summary,
          content,
          t.slug,
          'Thaja Suddi newsroom',
          article.image.title,
          t.headline.slice(0, 60),
          t.summary,
          langStatus,
          ['submitted', 'rejected', 'approved', 'published'].includes(langStatus) ? publishedAt : null,
          langStatus === 'published' ? publishedAt : null,
          ['published', 'approved', 'rejected'].includes(langStatus) ? users.editor : null,
          articleStatus === 'rejected' ? article.rejectionReason : null,
        ]
      );
      if (['published', 'approved', 'rejected'].includes(langStatus)) {
        await pool.query(
          `INSERT INTO article_reviews(article_id, translation_id, reviewer_id, decision, comments)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            articleId,
            translation.rows[0].id,
            users.editor,
            langStatus === 'published' ? 'published' : langStatus,
            langStatus === 'rejected' ? article.rejectionReason : 'Reviewed and approved',
          ]
        );
      }
    }
    await pool.query(
      `INSERT INTO article_images(article_id, image_id, image_type, position, caption)
       VALUES ($1, $2, 'main', 0, $3)`,
      [articleId, articleImageIds[article.key], article.image.title]
    );
    for (const tag of article.tags) {
      const tagRow = await pool.query(
        `INSERT INTO tags(name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [tag.toLowerCase()]
      );
      await pool.query(
        `INSERT INTO article_tags(article_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [articleId, tagRow.rows[0].id]
      );
    }

    if (articleStatus === 'published') {
      publishedIds.push({ id: articleId, views: article.views, lang: 'en' });
      const comments = COMMENT_TEXTS.slice(4, 6);
      for (let i = 0; i < comments.length; i += 1) {
        await pool.query(
          `INSERT INTO comments(article_id, user_id, content, status, created_at)
           VALUES ($1, $2, $3, 'approved', NOW() - INTERVAL '1 day')`,
          [articleId, i % 2 === 0 ? users.reader : users.contributor, comments[i]]
        );
      }
      for (let i = 0; i < 4; i += 1) {
        const liker = [users.reader, users.contributor, users.reporter, users.editor][i];
        await pool.query(
          `INSERT INTO article_likes(article_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [articleId, liker]
        );
      }
      await pool.query(
        `INSERT INTO article_shares(article_id, platform) VALUES ($1, 'whatsapp'), ($1, 'facebook'), ($1, 'x')`,
        [articleId]
      );
      for (let v = 0; v < Math.min(30, Math.ceil(article.views / 150)); v += 1) {
        await pool.query(
          `INSERT INTO article_views(article_id, visitor_hash, viewed_at)
           VALUES ($1, $2, NOW() - ($3 || ' hours')::interval)`,
          [articleId, `seed-visitor-${article.key}-${v}`, v]
        );
      }
    }
  }

  const readerBookmarks = await pool.query(
    `INSERT INTO bookmarks(article_id, user_id) SELECT id, $1 FROM articles WHERE status = 'published' LIMIT 3`,
    [users.reader]
  );

  await markSeedVersion();

  console.log(`[seed] done. Published articles: ${publishedIds.length}, bookmarks: ${readerBookmarks.rowCount}`);
  if (!env.isProd) {
    console.log('[seed] demo accounts:');
    console.log('  super admin  admin@thajasuddi.in / Admin@12345');
    console.log('  editor       editor@thajasuddi.in / Editor@12345');
    console.log('  reporter     reporter@thajasuddi.in / Reporter@12345');
    console.log('  contributor  contributor@thajasuddi.in / Contributor@12345');
    console.log('  reader       reader@thajasuddi.in / Reader@12345');
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error('[seed] failed', err);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
