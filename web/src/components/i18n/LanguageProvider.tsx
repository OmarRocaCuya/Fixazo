"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { isLanguage, LANGUAGE_STORAGE_KEY, type Language } from "@/lib/i18n/language";
import { PublicTranslationStore, type TranslationStatus } from "@/lib/i18n/translation-store";
import translations from "@/lib/i18n/public-translations.json";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (source: string) => string;
  register: (texts: readonly string[]) => () => void;
  translationStatus: TranslationStatus;
  retry: () => void;
}
const LanguageContext = createContext<LanguageContextValue | null>(null);
const spanishContext: LanguageContextValue = { language: "es", setLanguage: () => {}, t: (text) => text, register: () => () => {}, translationStatus: "ready", retry: () => {} };

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new PublicTranslationStore(async (language, texts) => {
    const response = await fetch("/api/periodico/translate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ language, texts }), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error("translation-unavailable");
    return response.json();
  }, translations));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    try { const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); if (isLanguage(stored)) store.setLanguage(stored); } catch { /* Selection still works without storage. */ }
    const sync = (event: StorageEvent) => { if (event.key === LANGUAGE_STORAGE_KEY && isLanguage(event.newValue)) { window.dispatchEvent(new Event("fixazo:language-changing")); store.setLanguage(event.newValue); } };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [store]);

  useEffect(() => {
    document.documentElement.lang = snapshot.translationStatus === "ready" ? snapshot.language : "es";
  }, [snapshot.language, snapshot.translationStatus]);

  const setLanguage = useCallback((language: Language) => {
    if (!isLanguage(language)) return;
    // Stop active capture and invalidate outstanding callbacks synchronously.
    window.dispatchEvent(new Event("fixazo:language-changing"));
    store.setLanguage(language);
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Persist only language, never responses or access codes. */ }
  }, [store]);
  const value = useMemo(() => ({ ...snapshot, setLanguage, t: store.t, register: store.register, retry: store.retry }), [snapshot, setLanguage, store]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  return context ?? spanishContext;
}

/** Register only static interface strings or published news, never learner input. */
export function usePublicTranslations(texts: readonly string[]) {
  const { register } = useLanguage();
  const key = JSON.stringify(texts);
  useEffect(() => register(JSON.parse(key) as string[]), [register, key]);
}

export function TranslatedText({ text }: { text: string }) {
  const { t } = useLanguage();
  usePublicTranslations([text]);
  return <>{t(text)}</>;
}
