"use client";

import { useId, useSyncExternalStore } from "react";
import { LANGUAGES, LANGUAGE_NAMES, isLanguage } from "@/lib/i18n/language";
import { LANGUAGE_UI_TEXTS } from "@/lib/i18n/ui-texts";
import { useLanguage, usePublicTranslations } from "./LanguageProvider";
import styles from "./language.module.css";

const subscribeHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverHydrationSnapshot = () => false;

/** One selection controls public text and microphone language on every screen. */
export default function LanguageSelector() {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribeHydration, hydratedSnapshot, serverHydrationSnapshot);
  const { language, setLanguage, t, translationStatus, retry } = useLanguage();
  usePublicTranslations(LANGUAGE_UI_TEXTS);
  return <div className={styles.control}>
    <label className={styles.label} htmlFor={id}>{t("Idioma")}</label>
    <select id={id} className="pd-nav-link" data-language-ready={hydrated ? "true" : "false"} data-translation-status={translationStatus} aria-label={t("Idioma del texto y de la transcripción")} disabled={!hydrated} value={language} onChange={(event) => { if (isLanguage(event.target.value)) setLanguage(event.target.value); }}>
      {LANGUAGES.map((code) => <option value={code} key={code}>{LANGUAGE_NAMES[code]}</option>)}
    </select>
    {language !== "es" && <span className={translationStatus === "ready" ? styles.label : styles.status} role="status" aria-live="polite">{t(translationStatus === "loading" ? LANGUAGE_UI_TEXTS[0] : translationStatus === "error" ? LANGUAGE_UI_TEXTS[1] : LANGUAGE_UI_TEXTS[2])}</span>}
    {language !== "es" && translationStatus === "error" && <button type="button" className={styles.retry} onClick={retry}>{t("Reintentar traducción")}</button>}
  </div>;
}
