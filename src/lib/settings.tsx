import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import type { OutputLanguage } from '../core/extraction/prompt';
import { type StringKey, translate } from './i18n';

const STORAGE_KEY = 'settings.language';

interface Settings {
  /** Language of the UI and of the extracted results. */
  language: OutputLanguage;
  setLanguage(language: OutputLanguage): void;
  t(key: StringKey, params?: Record<string, string | number>): string;
}

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({
  children,
  initialLanguage = 'tr',
}: {
  children: ReactNode;
  initialLanguage?: OutputLanguage;
}) {
  const [language, setLanguageState] = useState<OutputLanguage>(initialLanguage);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'tr' || stored === 'en') setLanguageState(stored);
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((next: OutputLanguage) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback(
    (key: StringKey, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );

  return (
    <SettingsContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Settings {
  const settings = useContext(SettingsContext);
  if (!settings) throw new Error('useSettings must be used inside SettingsProvider');
  return settings;
}
