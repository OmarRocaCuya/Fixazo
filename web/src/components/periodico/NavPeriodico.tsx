"use client";

import Link from "next/link";
import LanguageSelector from "@/components/i18n/LanguageSelector";
import { TranslatedText, useLanguage, usePublicTranslations } from "@/components/i18n/LanguageProvider";

// Languages actually wired today: Omnilingual ASR (quy, quz, ayr, spa), NLLB research
// translation (quy, ayr, spa) and guided reading with MMS voice (quy, ayr).
export const LENGUAS_RESUMEN = "Quechua chanka, aimara y castellano";

const ENLACES = [
  { href: "/", label: "Periódico" },
  { href: "/chat", label: "Lectura por voz" },
  { href: "/insights", label: "Mis insights" },
] as const;

export function NavPeriodico({ actual }: { actual?: (typeof ENLACES)[number]["href"] }) {
  const { t } = useLanguage();
  usePublicTranslations(["Secciones de Fixazo"]);
  return (
    <nav className="pd-nav" aria-label={t("Secciones de Fixazo")}>
      {ENLACES.map((e) => (
        <Link key={e.href} href={e.href} className={`pd-nav-link${actual === e.href ? " activo" : ""}`} aria-current={actual === e.href ? "page" : undefined}><TranslatedText text={e.label} /></Link>
      ))}
      <LanguageSelector />
    </nav>
  );
}

/** Visible entries to the existing voice-reading analysis and the languages lab. */
export function ExplorarVozYLenguas() {
  const { t } = useLanguage();
  usePublicTranslations(["Más formas de practicar"]);
  return (
    <section className="pd-explorar" aria-label={t("Más formas de practicar")}>
      <Link className="pd-card pd-explorar-item" href="/chat">
        <div className="eyebrow"><TranslatedText text="Lectura por voz" /></div>
        <h3><TranslatedText text="Lee en voz alta y mira tu análisis" /></h3>
        <p className="muted small"><TranslatedText text="Palabras por minuto, precisión, pausas largas y entonación de tu lectura, con una estimación experimental de emociones desde la voz." /></p>
        <span className="pd-leer"><TranslatedText text="Abrir lectura por voz" /></span>
      </Link>
      <Link className="pd-card pd-explorar-item" href="/lenguas">
        <div className="eyebrow"><TranslatedText text="Lenguas" /></div>
        <h3><TranslatedText text={LENGUAS_RESUMEN} /></h3>
        <p className="muted small"><TranslatedText text="Transcribe tu voz con Omnilingual ASR de Meta y traduce entre quechua Ayacucho, aimara y castellano (investigación, revisar con hablantes)." /></p>
        <span className="pd-leer"><TranslatedText text="Abrir lenguas" /></span>
      </Link>
    </section>
  );
}
