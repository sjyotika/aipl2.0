// src/context/LanguageContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type SupportedLanguage = 'en' | 'hi' | 'mr' | 'te' | 'ta';

export const SUPPORTED_LANGUAGES: Array<{ value: SupportedLanguage; label: string; locale: string }> = [
  { value: 'en', label: 'English', locale: 'en-US' },
  { value: 'hi', label: 'Hindi', locale: 'hi-IN' },
  { value: 'mr', label: 'Marathi', locale: 'mr-IN' },
  { value: 'te', label: 'Telugu', locale: 'te-IN' },
  { value: 'ta', label: 'Tamil', locale: 'ta-IN' },
];

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
