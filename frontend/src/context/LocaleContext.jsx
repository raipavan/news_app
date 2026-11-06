import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translate } from '../lib/i18n';

const LocaleContext = createContext(null);

function initialLang() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (fromUrl === 'kn' || fromUrl === 'en') return fromUrl;
    return localStorage.getItem('kv_lang') === 'kn' ? 'kn' : 'en';
  } catch {
    return 'en';
  }
}

export function LocaleProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('kv_lang', lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (next !== 'kn' && next !== 'en') return;
    setLangState(next);
    try {
      const url = new URL(window.location.href);
      if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/login')) return;
      url.searchParams.set('lang', next);
      window.history.replaceState({}, '', url);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((key) => translate(lang, key), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider');
  return context;
}
