// Interface language (#156) and colour theme (#158), remembered per browser.
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGS, setLanguage, type Lang } from './text';

export type ThemePref = 'system' | 'light' | 'dark';
export const THEMES: ThemePref[] = ['system', 'light', 'dark'];
const LANG_KEY = 'retrace_lang';
const THEME_KEY = 'retrace_theme';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
};

export const readLang = (): Lang => (LANGS.includes(read(LANG_KEY) as Lang) ? (read(LANG_KEY) as Lang) : 'ru');
export const readTheme = (): ThemePref => (THEMES.includes(read(THEME_KEY) as ThemePref) ? (read(THEME_KEY) as ThemePref) : 'system');

/** `system` leaves the attribute off so the prefers-color-scheme media query decides (see styles.css). */
export function applyTheme(theme: ThemePref) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

interface Prefs {
  lang: Lang;
  theme: ThemePref;
  setLang(lang: Lang): void;
  setTheme(theme: ThemePref): void;
}
const PrefsContext = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = readLang();
    setLanguage(l);
    return l;
  });
  const [theme, setThemeState] = useState<ThemePref>(readTheme);
  useEffect(() => applyTheme(theme), [theme]);

  const setLang = useCallback((l: Lang) => {
    setLanguage(l);
    write(LANG_KEY, l);
    setLangState(l);
  }, []);
  const setTheme = useCallback((th: ThemePref) => {
    write(THEME_KEY, th);
    setThemeState(th);
  }, []);
  const value = useMemo(() => ({ lang, theme, setLang, setTheme }), [lang, theme, setLang, setTheme]);
  // The dictionaries are swapped in place, so the screens re-render from scratch under the new language.
  return (
    <PrefsContext.Provider value={value}>
      <Fragment key={lang}>{children}</Fragment>
    </PrefsContext.Provider>
  );
}

export function usePrefs(): Prefs {
  const v = useContext(PrefsContext);
  if (!v) throw new Error('usePrefs outside PrefsProvider');
  return v;
}
