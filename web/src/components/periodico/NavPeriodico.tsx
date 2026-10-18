import Link from "next/link";

// Languages actually wired today: Omnilingual ASR (quy, quz, ayr, spa), NLLB research
// translation (quy, ayr, spa) and guided reading with MMS voice (quy, ayr).
export const LENGUAS_RESUMEN = "Quechua (Ayacucho y Cusco), aimara y castellano";

const ENLACES = [
  { href: "/", label: "Periódico" },
  { href: "/chat", label: "Lectura por voz" },
  { href: "/lenguas", label: "Lenguas" },
  { href: "/insights", label: "Mis insights" },
] as const;

export function NavPeriodico({ actual }: { actual?: (typeof ENLACES)[number]["href"] }) {
  return (
    <nav className="pd-nav" aria-label="Secciones de Fixazo">
      {ENLACES.map((e) => (
        <Link key={e.href} href={e.href} className={`pd-nav-link${actual === e.href ? " activo" : ""}`} aria-current={actual === e.href ? "page" : undefined}>{e.label}</Link>
      ))}
    </nav>
  );
}

/** Visible entries to the existing voice-reading analysis and the languages lab. */
export function ExplorarVozYLenguas() {
  return (
    <section className="pd-explorar" aria-label="Más formas de practicar">
      <Link className="pd-card pd-explorar-item" href="/chat">
        <div className="eyebrow">Lectura por voz</div>
        <h3>Lee en voz alta y mira tu análisis</h3>
        <p className="muted small">Palabras por minuto, precisión, pausas largas y entonación de tu lectura, con una estimación experimental de emociones desde la voz.</p>
        <span className="pd-leer">Abrir lectura por voz</span>
      </Link>
      <Link className="pd-card pd-explorar-item" href="/lenguas">
        <div className="eyebrow">Lenguas</div>
        <h3>{LENGUAS_RESUMEN}</h3>
        <p className="muted small">Transcribe tu voz con Omnilingual ASR de Meta y traduce entre quechua Ayacucho, aimara y castellano (investigación, revisar con hablantes).</p>
        <span className="pd-leer">Abrir lenguas</span>
      </Link>
    </section>
  );
}
