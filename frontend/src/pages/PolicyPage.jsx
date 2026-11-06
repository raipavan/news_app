import { Link, useParams } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import NotFound from './NotFound';

const UPDATED = '2026-11-01';

const POLICIES = {
  about: {
    en: {
      kicker: 'About us',
      title: 'About Thaja Suddi',
      intro:
        'Thaja Suddi is an independent digital newsroom publishing verified reporting from Bengaluru and every district of Karnataka, in Kannada and English.',
      sections: [
        {
          h: 'What we publish',
          p: 'Our reporters cover governance, politics, crime, business, education, technology, sport, entertainment and agriculture. Community contributors can submit news from their own districts, but every submission passes through an editorial desk before it reaches readers.',
        },
        {
          h: 'How we work',
          p: 'Each language version of a story is reviewed independently. A Kannada translation is not automatically verified because an English version was approved. Editors check sourcing, images, captions and language before publishing, and rejected stories can be corrected and resubmitted.',
        },
        {
          h: 'Funding and independence',
          p: 'The newsroom is funded by advertising and clearly labelled sponsored content. Advertisers never see editorial copy before publication and have no influence over what we report. Sponsored stories carry a visible label on the site and in search results.',
        },
      ],
    },
    kn: {
      kicker: 'ನಮ್ಮ ಬಗ್ಗೆ',
      title: 'ತಾಜಾ ಸುದ್ದಿ ಬಗ್ಗೆ',
      intro:
        'ತಾಜಾ ಸುದ್ದಿ ಒಂದು ಸ್ವತಂತ್ರ ಡಿಜಿಟಲ್ ಸುದ್ದಿಕೊಠಡಿ. ಬೆಂಗಳೂರು ಮತ್ತು ಕರ್ನಾಟಕದ ಪ್ರತಿ ಜಿಲ್ಲೆಯಿಂದ ಪರಿಶೀಲಿತ ವರದಿಗಳನ್ನು ಕನ್ನಡ ಮತ್ತು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಪ್ರಕಟಿಸುತ್ತದೆ.',
      sections: [
        {
          h: 'ನಾವು ಏನು ಪ್ರಕಟಿಸುತ್ತೇವೆ',
          p: 'ನಮ್ಮ ವರದಿಗಾರರು ಆಡಳಿತ, ರಾಜಕೀಯ, ಅಪರಾಧ, ವ್ಯಾಪಾರ, ಶಿಕ್ಷಣ, ತಂತ್ರಜ್ಞಾನ, ಕ್ರೀಡೆ, ಮನರಂಜನೆ ಮತ್ತು ಕೃಷಿಯನ್ನು ವರದಿ ಮಾಡುತ್ತಾರೆ. ಸಮುದಾಯ ಕರ್ತೃಗಳು ತಮ್ಮ ಜಿಲ್ಲೆಗಳಿಂದ ಸುದ್ದಿ ಸಲ್ಲಿಸಬಹುದು; ಆದರೆ ಪ್ರತಿ ಸಲ್ಲಿಕೆಯೂ ಓದುಗರಿಗೆ ತಲುಪುವ ಮೊದಲು ಸಂಪಾದಕೀಯ ಪರಿಶೀಲನೆಗೆ ಒಳಪಡುತ್ತದೆ.',
        },
        {
          h: 'ನಾವು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತೇವೆ',
          p: 'ಪ್ರತಿ ಭಾಷೆಯ ಆವೃತ್ತಿಯನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ. ಇಂಗ್ಲಿಷ್ ಆವೃತ್ತಿ ಅನುಮೋದನೆಗೊಂಡ ಕಾರಣಕ್ಕೆ ಕನ್ನಡ ಅನುವಾದ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪರಿಶೀಲಿತವಾಗುವುದಿಲ್ಲ. ಪ್ರಕಟಣೆಗೆ ಮೊದಲು ಮೂಲ, ಚಿತ್ರಗಳು, ಶೀರ್ಷಿಕೆಗಳು ಮತ್ತು ಭಾಷೆಯನ್ನು ಸಂಪಾದಕರು ಪರಿಶೀಲಿಸುತ್ತಾರೆ. ತಿರಸ್ಕೃತ ಸುದ್ದಿಗಳನ್ನು ಸರಿಪಡಿಸಿ ಮತ್ತೆ ಸಲ್ಲಿಸಬಹುದು.',
        },
        {
          h: 'ಧನಸಹಾಯ ಮತ್ತು ಸ್ವಾತಂತ್ರ್ಯ',
          p: 'ಜಾಹೀರಾತು ಮತ್ತು ಸ್ಪಷ್ಟವಾಗಿ ಗುರುತಿಸಿದ ಪ್ರಾಯೋಜಿತ ವಿಷಯಗಳಿಂದ ಸುದ್ದಿಕೊಠಡಿ ನಡೆಯುತ್ತದೆ. ಪ್ರಕಟಣೆಗೆ ಮೊದಲು ಜಾಹೀರಾತುದಾರರು ಸಂಪಾದಕೀಯ ವಿಷಯವನ್ನು ನೋಡುವುದಿಲ್ಲ ಮತ್ತು ನಾವು ಏನನ್ನು ವರದಿ ಮಾಡಬೇಕು ಎಂಬುದರ ಮೇಲೆ ಅವರ ಪ್ರಭಾವ ಇರುವುದಿಲ್ಲ. ಪ್ರಾಯೋಜಿತ ಸುದ್ದಿಗಳಿಗೆ ಸೈಟ್‌ನಲ್ಲಿ ಮತ್ತು ಹುಡುಕಾಟದಲ್ಲಿ ಕಾಣುವ ಲೇಬಲ್ ಇರುತ್ತದೆ.',
        },
      ],
    },
  },
  'editorial-policy': {
    en: {
      kicker: 'Standards',
      title: 'Editorial policy',
      intro:
        'These standards apply to every story, photo and community submission published by Thaja Suddi.',
      sections: [
        {
          h: 'Verification before publication',
          p: 'Reporters must attribute claims to named sources wherever possible, verify documents, and caption images accurately. Sensitive or high-risk stories require a second editorial review. When a claim cannot be verified, we say so or leave it out.',
        },
        {
          h: 'Community submissions',
          p: 'Community contributors can create drafts, upload images and submit stories. An editor checks accuracy, sourcing, image rights and language before approving. Rejections include a reason so the contributor can correct and resubmit. Publishing directly is a permission granted only to trusted reporters.',
        },
        {
          h: 'Translations and language versions',
          p: 'The Kannada and English versions of a story are linked but reviewed separately. Each version has its own headline, slug, SEO metadata and review history. A translation is never treated as verified merely because the original was approved.',
        },
        {
          h: 'Corrections and transparency',
          p: 'Errors are corrected promptly and visibly. Readers can use the “Report” button on any article to flag inaccuracies. Substantive corrections are recorded in the article review log, and sponsored content is always labelled.',
        },
      ],
    },
    kn: {
      kicker: 'ಮಾನದಂಡಗಳು',
      title: 'ಸಂಪಾದಕೀಯ ನೀತಿ',
      intro:
        'ತಾಜಾ ಸುದ್ದಿ ಪ್ರಕಟಿಸುವ ಪ್ರತಿ ಸುದ್ದಿ, ಚಿತ್ರ ಮತ್ತು ಸಮುದಾಯ ಸಲ್ಲಿಕೆಗೆ ಈ ಮಾನದಂಡಗಳು ಅನ್ವಯಿಸುತ್ತವೆ.',
      sections: [
        {
          h: 'ಪ್ರಕಟಣೆಗೆ ಮೊದಲು ಪರಿಶೀಲನೆ',
          p: 'ವರದಿಗಾರರು ಆದಷ್ಟು ಹೆಸರಿಸಿದ ಮೂಲಗಳಿಗೆ ಹೇಳಿಕೆಗಳನ್ನು ಆರೋಪಿಸಬೇಕು, ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಬೇಕು ಮತ್ತು ಚಿತ್ರಗಳ ಶೀರ್ಷಿಕೆಗಳನ್ನು ನಿಖರವಾಗಿ ನೀಡಬೇಕು. ಸೂಕ್ಷ್ಮ ಅಥವಾ ಹೆಚ್ಚಿನ ಅಪಾಯದ ಸುದ್ದಿಗಳಿಗೆ ಎರಡನೇ ಸಂಪಾದಕೀಯ ಪರಿಶೀಲನೆ ಅಗತ್ಯ. ಪರಿಶೀಲಿಸಲಾಗದ ಹೇಳಿಕೆಯನ್ನು ನಾವು ಹಾಗೆ ಹೇಳುತ್ತೇವೆ ಅಥವಾ ಬಿಟ್ಟುಬಿಡುತ್ತೇವೆ.',
        },
        {
          h: 'ಸಮುದಾಯ ಸಲ್ಲಿಕೆಗಳು',
          p: 'ಸಮುದಾಯ ಕರ್ತೃಗಳು ಕರಡು ಸಿದ್ಧಪಡಿಸಬಹುದು, ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ ಮಾಡಬಹುದು ಮತ್ತು ಸುದ್ದಿ ಸಲ್ಲಿಸಬಹುದು. ಅನುಮೋದನೆಗೆ ಮೊದಲು ಸಂಪಾದಕರು ನಿಖರತೆ, ಮೂಲ, ಚಿತ್ರ ಹಕ್ಕುಗಳು ಮತ್ತು ಭಾಷೆಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತಾರೆ. ತಿರಸ್ಕಾರಕ್ಕೆ ಕಾರಣ ನೀಡಲಾಗುತ್ತದೆ; ಕರ್ತೃ ಸರಿಪಡಿಸಿ ಮತ್ತೆ ಸಲ್ಲಿಸಬಹುದು. ನೇರ ಪ್ರಕಟಣೆ ನಂಬಿಕೆ ಇರುವ ವರದಿಗಾರರಿಗೆ ಮಾತ್ರ ನೀಡುವ ಅನುಮತಿ.',
        },
        {
          h: 'ಅನುವಾದಗಳು ಮತ್ತು ಭಾಷಾ ಆವೃತ್ತಿಗಳು',
          p: 'ಸುದ್ದಿಯ ಕನ್ನಡ ಮತ್ತು ಇಂಗ್ಲಿಷ್ ಆವೃತ್ತಿಗಳು ಸಂಬಂಧಿತವಾಗಿರುತ್ತವೆ ಆದರೆ ಪ್ರತ್ಯೇಕವಾಗಿ ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ. ಪ್ರತಿ ಆವೃತ್ತಿಗೆ ತನ್ನದೇ ಶೀರ್ಷಿಕೆ, ಸ್ಲಗ್, SEO ಮಾಹಿತಿ ಮತ್ತು ಪರಿಶೀಲನಾ ಇತಿಹಾಸ ಇರುತ್ತದೆ. ಮೂಲ ಅನುಮೋದನೆಗೊಂಡ ಕಾರಣಕ್ಕೆ ಅನುವಾದವನ್ನು ಪರಿಶೀಲಿತ ಎಂದು ಪರಿಗಣಿಸುವುದಿಲ್ಲ.',
        },
        {
          h: 'ತಿದ್ದುಪಡಿಗಳು ಮತ್ತು ಪಾರದರ್ಶಕತೆ',
          p: 'ತಪ್ಪುಗಳನ್ನು ತಕ್ಷಣ ಮತ್ತು ಕಾಣುವಂತೆ ಸರಿಪಡಿಸಲಾಗುತ್ತದೆ. ಓದುಗರು ಯಾವುದೇ ಸುದ್ದಿಯ “ವರದಿ ಮಾಡಿ” ಬಟನ್ ಬಳಸಿ ತಪ್ಪುಗಳನ್ನು ಸೂಚಿಸಬಹುದು. ಮಹತ್ವದ ತಿದ್ದುಪಡಿಗಳನ್ನು ಸುದ್ದಿಯ ಪರಿಶೀಲನಾ ದಾಖಲೆಯಲ್ಲಿ ಉಳಿಸಲಾಗುತ್ತದೆ ಮತ್ತು ಪ್ರಾಯೋಜಿತ ವಿಷಯವನ್ನು ಯಾವಾಗಲೂ ಗುರುತಿಸಲಾಗುತ್ತದೆ.',
        },
      ],
    },
  },
  'privacy-policy': {
    en: {
      kicker: 'Privacy',
      title: 'Privacy policy',
      intro:
        'We collect the minimum information needed to run a newsroom, keep accounts secure and understand which stories readers value.',
      sections: [
        {
          h: 'Information we collect',
          p: 'Reading Thaja Suddi needs no account. Guests can like stories and comment using an optional display name; we store only an anonymous visitor identifier on your device. Newsroom staff accounts provide a name and either an email address or phone number, and we store a hashed password plus any comments, bookmarks and reports submitted from that account.',
        },
        {
          h: 'Cookies and local storage',
          p: 'Sign-in uses a secure, HttpOnly refresh cookie. The browser stores an access token, your language preference and a random visitor identifier so we can count article views, prevent duplicate counting and measure advertisement impressions. We do not sell personal data.',
        },
        {
          h: 'Your choices',
          p: 'You can clear local storage at any time by signing out. To request access to, correction of, or deletion of your account data, write to privacy@thajasuddi.in. Comments you post are public and moderated; reports you file are visible only to the editorial team.',
        },
      ],
    },
    kn: {
      kicker: 'ಗೌಪ್ಯತೆ',
      title: 'ಗೌಪ್ಯತಾ ನೀತಿ',
      intro:
        'ಸುದ್ದಿಕೊಠಡಿ ನಡೆಸಲು, ಖಾತೆಗಳನ್ನು ಸುರಕ್ಷಿತವಾಗಿಡಲು ಮತ್ತು ಓದುಗರು ಯಾವ ಸುದ್ದಿಗಳನ್ನು ಇಷ್ಟಪಡುತ್ತಾರೆ ಎಂಬುದನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಅಗತ್ಯವಿರುವ ಕನಿಷ್ಠ ಮಾಹಿತಿಯನ್ನು ಮಾತ್ರ ಸಂಗ್ರಹಿಸುತ್ತೇವೆ.',
      sections: [
        {
          h: 'ನಾವು ಸಂಗ್ರಹಿಸುವ ಮಾಹಿತಿ',
          p: 'ಖಾತೆ ಹೊಂದಿರುವವರು ಹೆಸರು ಮತ್ತು ಇಮೇಲ್ ಅಥವಾ ಫೋನ್ ಸಂಖ್ಯೆ ನೀಡುತ್ತಾರೆ. ಹ್ಯಾಶ್ ಮಾಡಿದ ಪಾಸ್‌ವರ್ಡ್, ಪ್ರತಿಕ್ರಿಯೆಗಳು, ಇಷ್ಟಗಳು, ಉಳಿಸಿದ ಸುದ್ದಿಗಳು ಮತ್ತು ವರದಿಗಳನ್ನು ಸಂಗ್ರಹಿಸುತ್ತೇವೆ. ಸೈನ್ ಇನ್ ಆಗದ ಓದುಗರು ಖಾತೆ ಇಲ್ಲದೆಯೇ ಎಲ್ಲಾ ಪ್ರಕಟಿತ ಸುದ್ದಿಗಳನ್ನು ಓದಬಹುದು.',
        },
        {
          h: 'ಕುಕೀಗಳು ಮತ್ತು ಸ್ಥಳೀಯ ಸಂಗ್ರಹಣೆ',
          p: 'ಸೈನ್ ಇನ್‌ಗೆ ಸುರಕ್ಷಿತ HttpOnly ರಿಫ್ರೆಶ್ ಕುಕೀ ಬಳಸುತ್ತೇವೆ. ಸುದ್ದಿ ವೀಕ್ಷಣೆ ಎಣಿಸಲು, ಪುನರಾವರ್ತಿತ ಎಣಿಕೆ ತಡೆಯಲು ಮತ್ತು ಜಾಹೀರಾತು ಪ್ರಭಾವ ಅಳೆಯಲು ಬ್ರೌಸರ್ ಒಂದು ಆಕ್ಸೆಸ್ ಟೋಕನ್, ನಿಮ್ಮ ಭಾಷಾ ಆಯ್ಕೆ ಮತ್ತು ಯಾದೃಚ್ಛಿಕ ಸಂದರ್ಶಕ ಗುರುತನ್ನು ಸಂಗ್ರಹಿಸುತ್ತದೆ. ನಾವು ವೈಯಕ್ತಿಕ ಮಾಹಿತಿಯನ್ನು ಮಾರಾಟ ಮಾಡುವುದಿಲ್ಲ.',
        },
        {
          h: 'ನಿಮ್ಮ ಆಯ್ಕೆಗಳು',
          p: 'ಸೈನ್ ಔಟ್ ಮಾಡುವ ಮೂಲಕ ಯಾವಾಗಲೂ ಸ್ಥಳೀಯ ಸಂಗ್ರಹಣೆಯನ್ನು ತೆರವುಗೊಳಿಸಬಹುದು. ನಿಮ್ಮ ಖಾತೆ ಮಾಹಿತಿಯ ಪ್ರವೇಶ, ತಿದ್ದುಪಡಿ ಅಥವಾ ಅಳಿಸುವಿಕೆಗಾಗಿ privacy@thajasuddi.in ಗೆ ಬರೆಯಿರಿ. ನೀವು ನೀಡುವ ಪ್ರತಿಕ್ರಿಯೆಗಳು ಸಾರ್ವಜನಿಕ ಮತ್ತು ಮಾಡರೇಟ್ ಆಗುತ್ತವೆ; ನೀವು ಸಲ್ಲಿಸುವ ವರದಿಗಳು ಸಂಪಾದಕೀಯ ತಂಡಕ್ಕೆ ಮಾತ್ರ ಕಾಣುತ್ತವೆ.',
        },
      ],
    },
  },
  terms: {
    en: {
      kicker: 'Terms',
      title: 'Terms of use',
      intro: 'By reading, sharing or contributing to Thaja Suddi you agree to these terms.',
      sections: [
        {
          h: 'Using the site',
          p: 'You may read and share published stories for personal, non-commercial use. You may not scrape the site at scale, bypass access controls, impersonate our journalists or republish complete articles without written permission.',
        },
        {
          h: 'Your submissions',
          p: 'When you submit a story, photograph or comment you confirm that you have the right to share it. You grant Thaja Suddi a licence to edit, translate, publish and distribute the material. Editors may reject or remove content that is unlawful, misleading, plagiarised or harmful.',
        },
        {
          h: 'Accounts and moderation',
          p: 'Keep your password confidential. We may suspend accounts that abuse the platform, post spam or harass others. Sponsored content and advertisements are labelled; editorial decisions remain independent of advertisers.',
        },
        {
          h: 'Limitation and changes',
          p: 'News changes quickly. We work to correct errors but cannot guarantee that every article reflects events after publication. We may update these terms and will publish the revision date on this page.',
        },
      ],
    },
    kn: {
      kicker: 'ನಿಯಮಗಳು',
      title: 'ಬಳಕೆಯ ನಿಯಮಗಳು',
      intro: 'ತಾಜಾ ಸುದ್ದಿಯನ್ನು ಓದುವ, ಹಂಚಿಕೊಳ್ಳುವ ಅಥವಾ ಕೊಡುಗೆ ನೀಡುವ ಮೂಲಕ ನೀವು ಈ ನಿಯಮಗಳಿಗೆ ಒಪ್ಪುತ್ತೀರಿ.',
      sections: [
        {
          h: 'ಸೈಟ್ ಬಳಕೆ',
          p: 'ವೈಯಕ್ತಿಕ, ವಾಣಿಜ್ಯೇತರ ಬಳಕೆಗಾಗಿ ಪ್ರಕಟಿತ ಸುದ್ದಿಗಳನ್ನು ಓದಬಹುದು ಮತ್ತು ಹಂಚಿಕೊಳ್ಳಬಹುದು. ಸೈಟ್ ಅನ್ನು ದೊಡ್ಡ ಪ್ರಮಾಣದಲ್ಲಿ ಸ್ಕ್ರ್ಯಾಪ್ ಮಾಡುವುದು, ಪ್ರವೇಶ ನಿಯಂತ್ರಣಗಳನ್ನು ಬೈಪಾಸ್ ಮಾಡುವುದು, ನಮ್ಮ ಪತ್ರಕರ್ತರೆಂದು ಸೋಗು ಹಾಕುವುದು ಅಥವಾ ಲಿಖಿತ ಅನುಮತಿ ಇಲ್ಲದೆ ಪೂರ್ಣ ಸುದ್ದಿಗಳನ್ನು ಮರುಪ್ರಕಟಿಸುವುದು ನಿಷೇಧಿತ.',
        },
        {
          h: 'ನಿಮ್ಮ ಸಲ್ಲಿಕೆಗಳು',
          p: 'ಸುದ್ದಿ, ಫೋಟೋ ಅಥವಾ ಪ್ರತಿಕ್ರಿಯೆ ಸಲ್ಲಿಸುವಾಗ ಅದನ್ನು ಹಂಚಿಕೊಳ್ಳುವ ಹಕ್ಕು ನಿಮಗಿದೆ ಎಂದು ದೃಢೀಕರಿಸುತ್ತೀರಿ. ಸಂಪಾದಿಸಲು, ಅನುವಾದಿಸಲು, ಪ್ರಕಟಿಸಲು ಮತ್ತು ಹಂಚಲು ತಾಜಾ ಸುದ್ದಿಗೆ ಅನುಮತಿ ನೀಡುತ್ತೀರಿ. ಕಾನೂನುಬಾಹಿರ, ದಾರಿ ತಪ್ಪಿಸುವ, ಕದ್ದ ಅಥವಾ ಹಾನಿಕರ ವಿಷಯವನ್ನು ಸಂಪಾದಕರು ತಿರಸ್ಕರಿಸಬಹುದು ಅಥವಾ ತೆಗೆದುಹಾಕಬಹುದು.',
        },
        {
          h: 'ಖಾತೆಗಳು ಮತ್ತು ಮಾಡರೇಶನ್',
          p: 'ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ಅನ್ನು ಗೋಪ್ಯವಾಗಿಡಿ. ವೇದಿಕೆಯನ್ನು ದುರುಪಯೋಗಪಡಿಸುವ, ಸ್ಪ್ಯಾಮ್ ಮಾಡುವ ಅಥವಾ ಇತರರಿಗೆ ಕಿರುಕುಳ ನೀಡುವ ಖಾತೆಗಳನ್ನು ಅಮಾನತುಗೊಳಿಸಬಹುದು. ಪ್ರಾಯೋಜಿತ ವಿಷಯ ಮತ್ತು ಜಾಹೀರಾತುಗಳನ್ನು ಗುರುತಿಸಲಾಗುತ್ತದೆ; ಸಂಪಾದಕೀಯ ನಿರ್ಧಾರಗಳು ಜಾಹೀರಾತುದಾರರಿಂದ ಸ್ವತಂತ್ರವಾಗಿರುತ್ತವೆ.',
        },
        {
          h: 'ಮಿತಿಗಳು ಮತ್ತು ಬದಲಾವಣೆಗಳು',
          p: 'ಸುದ್ದಿ ಬೇಗನೆ ಬದಲಾಗುತ್ತದೆ. ತಪ್ಪುಗಳನ್ನು ಸರಿಪಡಿಸಲು ನಾವು ಶ್ರಮಿಸುತ್ತೇವೆ ಆದರೆ ಪ್ರಕಟಣೆಯ ನಂತರದ ಘಟನೆಗಳನ್ನು ಪ್ರತಿ ಸುದ್ದಿಯೂ ಪ್ರತಿಬಿಂಬಿಸುತ್ತದೆ ಎಂದು ಖಾತರಿಪಡಿಸಲಾಗದು. ಈ ನಿಯಮಗಳನ್ನು ನವೀಕರಿಸಬಹುದು ಮತ್ತು ಪರಿಷ್ಕರಣ ದಿನಾಂಕವನ್ನು ಈ ಪುಟದಲ್ಲಿ ಪ್ರಕಟಿಸುತ್ತೇವೆ.',
        },
      ],
    },
  },
  corrections: {
    en: {
      kicker: 'Accountability',
      title: 'Corrections policy',
      intro:
        'Accuracy is a process, not a claim. When we get something wrong, readers help us fix it quickly and visibly.',
      sections: [
        {
          h: 'How to report an error',
          p: 'Use the “Report” button on any published article and describe what is inaccurate. Authors can also submit a correction request from the newsroom, which creates a revision for editors to review. For urgent matters, write to corrections@thajasuddi.in.',
        },
        {
          h: 'What happens next',
          p: 'An editor checks the source, the article and any linked language version. Substantive corrections are applied with a note in the article review log. Where the meaning of a story changes, we add a visible correction note rather than quietly rewriting the record.',
        },
        {
          h: 'Translations',
          p: 'A correction to one language version does not automatically change the other. Editors ensure both versions are reviewed and updated where the error appears in both.',
        },
      ],
    },
    kn: {
      kicker: 'ಹೊಣೆಗಾರಿಕೆ',
      title: 'ತಿದ್ದುಪಡಿ ನೀತಿ',
      intro:
        'ನಿಖರತೆ ಒಂದು ಪ್ರಕ್ರಿಯೆ, ಕೇವಲ ಹೇಳಿಕೆ ಅಲ್ಲ. ನಾವು ತಪ್ಪು ಮಾಡಿದಾಗ ಓದುಗರು ಅದನ್ನು ತ್ವರಿತವಾಗಿ ಮತ್ತು ಕಾಣುವಂತೆ ಸರಿಪಡಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತಾರೆ.',
      sections: [
        {
          h: 'ತಪ್ಪನ್ನು ಹೇಗೆ ವರದಿ ಮಾಡುವುದು',
          p: 'ಯಾವುದೇ ಪ್ರಕಟಿತ ಸುದ್ದಿಯಲ್ಲಿನ “ವರದಿ ಮಾಡಿ” ಬಟನ್ ಬಳಸಿ ಏನು ತಪ್ಪಾಗಿದೆ ಎಂಬುದನ್ನು ವಿವರಿಸಿ. ಲೇಖಕರು ಸುದ್ದಿಕೊಠಡಿಯಿಂದ ತಿದ್ದುಪಡಿ ವಿನಂತಿಯನ್ನೂ ಸಲ್ಲಿಸಬಹುದು; ಅದು ಸಂಪಾದಕರ ಪರಿಶೀಲನೆಗೆ ಪರಿಷ್ಕರಣವನ್ನು ಸೃಷ್ಟಿಸುತ್ತದೆ. ತುರ್ತು ವಿಷಯಗಳಿಗೆ corrections@thajasuddi.in ಗೆ ಬರೆಯಿರಿ.',
        },
        {
          h: 'ಮುಂದೆ ಏನಾಗುತ್ತದೆ',
          p: 'ಸಂಪಾದಕರು ಮೂಲ, ಸುದ್ದಿ ಮತ್ತು ಸಂಬಂಧಿತ ಭಾಷಾ ಆವೃತ್ತಿಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತಾರೆ. ಮಹತ್ವದ ತಿದ್ದುಪಡಿಗಳನ್ನು ಸುದ್ದಿಯ ಪರಿಶೀಲನಾ ದಾಖಲೆಯ ಟಿಪ್ಪಣಿಯೊಂದಿಗೆ ಅನ್ವಯಿಸಲಾಗುತ್ತದೆ. ಸುದ್ದಿಯ ಅರ್ಥ ಬದಲಾಗುವ ಸಂದರ್ಭದಲ್ಲಿ, ದಾಖಲೆಯನ್ನು ಮೌನವಾಗಿ ಮರುಬರೆಯುವ ಬದಲು ಕಾಣುವ ತಿದ್ದುಪಡಿ ಟಿಪ್ಪಣಿ ಸೇರಿಸುತ್ತೇವೆ.',
        },
        {
          h: 'ಅನುವಾದಗಳು',
          p: 'ಒಂದು ಭಾಷಾ ಆವೃತ್ತಿಯ ತಿದ್ದುಪಡಿ ಇನ್ನೊಂದನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಬದಲಾಯಿಸುವುದಿಲ್ಲ. ತಪ್ಪು ಎರಡೂ ಆವೃತ್ತಿಗಳಲ್ಲಿ ಇದ್ದರೆ ಎರಡನ್ನೂ ಪರಿಶೀಲಿಸಿ ನವೀಕರಿಸುವುದನ್ನು ಸಂಪಾದಕರು ಖಚಿತಪಡಿಸುತ್ತಾರೆ.',
        },
      ],
    },
  },
};

export const POLICY_KEYS = Object.keys(POLICIES);

export default function PolicyPage() {
  const { policy } = useParams();
  const { lang } = useLocale();
  const content = POLICIES[policy]?.[lang];
  if (!content) return <NotFound />;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 820 }}>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/">{lang === 'kn' ? 'ಮುಖಪುಟ' : 'Home'}</Link>
          <span className="sep">/</span>
          <span>{content.kicker}</span>
        </nav>
        <article className="article-head">
          <span className="kicker">{content.kicker}</span>
          <h1 style={{ fontSize: 'clamp(30px, 4vw, 44px)', marginTop: 10 }}>{content.title}</h1>
          <p className="article-summary">{content.intro}</p>
          <div className="meta">
            <span>{lang === 'kn' ? 'ಕೊನೆಯ ನವೀಕರಣ' : 'Last updated'}: {new Date(UPDATED).toLocaleDateString(lang === 'kn' ? 'kn-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </article>
        <div className="article-body">
          {content.sections.map((section) => (
            <section key={section.h}>
              <h2>{section.h}</h2>
              <p>{section.p}</p>
            </section>
          ))}
          <div className="article-note">
            {lang === 'kn'
              ? 'ಪ್ರಶ್ನೆಗಳಿದ್ದರೆ newsroom@thajasuddi.in ಗೆ ಬರೆಯಿರಿ.'
              : 'Questions? Write to newsroom@thajasuddi.in or read our '}
            {lang === 'kn' ? null : <Link to="/editorial-policy">editorial policy</Link>}
            {lang === 'kn' ? null : '.'}
          </div>
          <p className="mt-3">
            <Link className="btn btn-outline btn-sm" to="/">&larr; {lang === 'kn' ? 'ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ' : 'Back to homepage'}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
