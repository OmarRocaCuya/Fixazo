"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useLanguage, usePublicTranslations } from "@/components/i18n/LanguageProvider";
import { companionExpression, resetVoiceCompanion, useVoiceCompanion, type CompanionExpression } from "@/lib/browser/voice-companion";
import styles from "./voice-mascot.module.css";

const FRAMES: Record<CompanionExpression, string> = {
  idle: "0% 0%", listening: "50% 0%", happy: "100% 0%",
  sad: "0% 50%", surprised: "50% 50%", concerned: "100% 50%",
  thinking: "0% 100%", success: "50% 100%", retry: "100% 100%",
};
const MASCOT_TEXT = [
  "Escuchando", "Estimación de voz",
  "Reacción a una estimación experimental del audio, no a tus sentimientos ni a tus respuestas.",
  "El movimiento sigue el nivel del micrófono mientras grabas.",
  "Compañero de voz. El micrófono solo se activa cuando tú grabas.",
  "Compañero de voz", "Mostrar compañero de voz", "Minimizar compañero de voz", "Mostrar compañero", "Minimizar compañero",
  "Revisando tu respuesta", "Bien hecho", "Inténtalo de nuevo",
  "La reacción sigue la validación de tu respuesta, no la emoción de tu voz.",
  "Tu voz mueve al cóndor en tiempo real.", "Cóndor compañero",
] as const;

/** A nonverbal companion, driven only by existing audio capture/model signals. */
export default function VoiceMascot() {
  const { t } = useLanguage();
  usePublicTranslations(MASCOT_TEXT);
  const state = useVoiceCompanion();
  const { active, level, emotion, validation } = state;
  const [collapsed, setCollapsed] = useState(false);
  const expression = companionExpression(state);
  const status = validation === "thinking" ? "Revisando tu respuesta" : validation === "success" ? "Bien hecho" : validation === "retry" ? "Inténtalo de nuevo" : active ? "Escuchando" : emotion !== null ? "Estimación de voz" : "";
  const explanation = validation !== null ? "La reacción sigue la validación de tu respuesta, no la emoción de tu voz." : emotion !== null
    ? "Reacción a una estimación experimental del audio, no a tus sentimientos ni a tus respuestas."
    : active ? "Tu voz mueve al cóndor en tiempo real." : "Compañero de voz. El micrófono solo se activa cuando tú grabas.";
  const style = { "--audio-level": level, backgroundPosition: FRAMES[expression] } as CSSProperties;
  useEffect(() => {
    const hidden = () => { if (document.hidden) resetVoiceCompanion(); };
    window.addEventListener("fixazo:language-changing", resetVoiceCompanion);
    window.addEventListener("pagehide", resetVoiceCompanion);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      resetVoiceCompanion();
      window.removeEventListener("fixazo:language-changing", resetVoiceCompanion);
      window.removeEventListener("pagehide", resetVoiceCompanion);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  return (
    <aside className={`${styles.widget}${collapsed ? ` ${styles.collapsed}` : ""}`} aria-label={t("Cóndor compañero")}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setCollapsed(!collapsed)}
        aria-label={t(collapsed ? "Mostrar compañero de voz" : "Minimizar compañero de voz")}
        aria-expanded={!collapsed}
        aria-controls="voice-companion-figure"
        title={t(collapsed ? "Mostrar compañero" : "Minimizar compañero")}
      >
        {collapsed
          ? <span className={styles.miniature} aria-hidden="true" />
          : <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 12h12" /></svg>}
      </button>
      <div id="voice-companion-figure" className={styles.figure} hidden={collapsed} title={t(explanation)}>
        <div className={styles.condor} style={style} data-expression={expression} data-speaking={active && level > 0.04} aria-hidden="true" />
        {active && <span className={styles.wave} style={{ "--audio-level": level } as CSSProperties} aria-hidden="true"><i /><i /><i /><i /><i /></span>}
        {status && <span className={styles.caption}>{active && <span className={styles.dot} />} {t(status)}</span>}
        <span className="sr-only" role="status" aria-live="polite">{status ? `${t(status)}. ${t(explanation)}` : t(explanation)}</span>
      </div>
    </aside>
  );
}
