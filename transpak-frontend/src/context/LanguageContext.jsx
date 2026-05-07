import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations.js';

const STORAGE_KEY = 'transpak_lang';

export const LanguageContext = createContext(null);

// Language provider with a minimal t("scope.key") helper.
export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ur' || stored === 'en') setLang(stored);
  }, []);

  const toggleLanguage = () => {
    setLang((prev) => {
      const next = prev === 'en' ? 'ur' : 'en';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const setLanguage = (next) => {
    const safe = next === 'ur' ? 'ur' : 'en';
    setLang(safe);
    localStorage.setItem(STORAGE_KEY, safe);
  };

  const t = useCallback((key, vars = {}) => {
    const parts = String(key).split('.').filter(Boolean);
    let cur = translations?.[lang];
    for (const p of parts) {
      cur = cur?.[p];
      if (cur == null) return key;
    }
    // Never return objects/arrays directly into JSX (prevents "Objects are not valid as React child")
    if (typeof cur === 'object') return key;
    if (typeof cur !== 'string') return cur;
    // Lightweight {{var}} interpolation
    return cur.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{{${k}}}`));
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      isUrdu: lang === 'ur',
      t,
      toggleLanguage,
      setLanguage
    }),
    [lang, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};

