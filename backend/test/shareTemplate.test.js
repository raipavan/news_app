const test = require('node:test');
const assert = require('node:assert/strict');
const { formatWhatsAppShareText } = require('../src/services/shareSettingsService');
const { renderArticlePage } = require('../src/services/ssr');

test('formatWhatsAppShareText formats headline, URL, and WhatsApp group link', () => {
  const msg = formatWhatsAppShareText({
    headline: 'ಧರ್ಮಸ್ಥಳ ಲಕ್ಷ ದೀಪೋತ್ಸವ ಪಾದಯಾತ್ರೆ ಸಮಾಲೋಚನಾ ಸಭೆ',
    summary: 'ಬೆಳ್ತಂಗಡಿ: ಪಾದಯಾತ್ರೆ ಕೇವಲ ಭೌತಿಕ ಪ್ರಕ್ರಿಯೆಯಲ್ಲ',
    url: 'https://tajanewssuddi.in/kn/news/dharmasthala-padayatre',
    whatsappGroupUrl: 'https://chat.whatsapp.com/CK4vKTbBpHpBt6s0klP8Sv',
    includeSummaryInShare: true,
  });

  assert.equal(
    msg,
    [
      '🔶 *ಧರ್ಮಸ್ಥಳ ಲಕ್ಷ ದೀಪೋತ್ಸವ ಪಾದಯಾತ್ರೆ ಸಮಾಲೋಚನಾ ಸಭೆ :* ಬೆಳ್ತಂಗಡಿ: ಪಾದಯಾತ್ರೆ ಕೇವಲ ಭೌತಿಕ ಪ್ರಕ್ರಿಯೆಯಲ್ಲ',
      '',
      'https://tajanewssuddi.in/kn/news/dharmasthala-padayatre',
      '',
      '🟢 *Join Whatsapp Group:* https://chat.whatsapp.com/CK4vKTbBpHpBt6s0klP8Sv',
    ].join('\n')
  );
});

test('formatWhatsAppShareText omits summary and group footer when disabled or empty', () => {
  const msg = formatWhatsAppShareText({
    headline: 'Karnataka cabinet approves tech corridor',
    summary: 'Summary text',
    url: 'https://tajanewssuddi.in/en/news/tech-corridor',
    whatsappGroupUrl: '',
    includeSummaryInShare: false,
  });

  assert.equal(
    msg,
    [
      '🔶 *Karnataka cabinet approves tech corridor*',
      '',
      'https://tajanewssuddi.in/en/news/tech-corridor',
    ].join('\n')
  );
});

test('renderArticlePage renders Open Graph dimensions and formatted wa.me share link', () => {
  const html = renderArticlePage(
    {
      id: 'art-1',
      slug: 'dharmasthala-padayatre',
      headline: 'ಧರ್ಮಸ್ಥಳ ಪಾದಯಾತ್ರೆ',
      summary: 'ಸಮಾಲೋಚನಾ ಸಭೆ ವರದಿ',
      content: '<p>Full news story body.</p>',
      main_image_id: '11111111-1111-4111-8111-111111111111',
      author_name: 'Reporter',
      category_slug: 'karnataka',
      category_name_kn: 'ಕರ್ನಾಟಕ',
      category_name_en: 'Karnataka',
      alternates: [],
      related: [],
      tags: [],
    },
    {
      lang: 'kn',
      base: 'https://tajanewssuddi.in',
      categories: [],
      trending: [],
      latest: [],
      shareSettings: {
        whatsappGroupUrl: 'https://chat.whatsapp.com/ABC123',
        includeSummaryInShare: false,
      },
    }
  );

  assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(html, /<meta property="og:image:height" content="675" \/>/);
  const expectedText = encodeURIComponent(
    '🔶 *ಧರ್ಮಸ್ಥಳ ಪಾದಯಾತ್ರೆ*\n\nhttps://tajanewssuddi.in/kn/news/dharmasthala-padayatre\n\n🟢 *Join Whatsapp Group:* https://chat.whatsapp.com/ABC123'
  );
  assert.ok(html.includes(`https://wa.me/?text=${expectedText}`));
});
