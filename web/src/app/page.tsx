
import { TranslatedText } from "@/components/i18n/LanguageProvider";
// Portada del periódico: ediciones guardadas en data/ediciones, sin programador automático configurado.
// La app de familia de Fixazo sigue disponible en /chat (/consentimiento redirige ahí).
import Link from "next/link";
import { PracticeMemory } from "@/components/periodico/PracticeMemory";
import { connection } from "next/server";
import { Suspense } from "react";
import EstadoNoticia from "@/components/periodico/EstadoNoticia";
import { ExplorarVozYLenguas, NavPeriodico } from "@/components/periodico/NavPeriodico";
import { RachaChip } from "@/components/periodico/Racha";
import Reveladas, { type Reservada } from "@/components/periodico/Reveladas";
import { noticiasPublicadas, noticiasReservadas, type NoticiaGuardada } from "@/lib/periodico/ediciones";

const LIMA = { timeZone: "America/Lima" } as const;
const fechaEdicion = (iso: string) => new Date(iso).toLocaleDateString("es-PE", { ...LIMA, day: "numeric", month: "long", year: "numeric" });

function Miradas({ n }: { n: NoticiaGuardada }) {
  const m = n.miradas ?? [];
  if (!m.length) return null;
  return (
    <div className="pd-miradas" aria-label="Cómo lo cuenta cada medio o voz">
      {m.map((x, k) => (
        <div key={k} className={`pd-mirada ${k ? "b" : "a"}`}>
          <div className="pd-mirada-medio">{x.medio}</div>
          {x.texto ? <div className="pd-mirada-cita">«<TranslatedText text={x.texto} />»</div> : <div className="pd-mirada-cita sin-cita"><TranslatedText text="Otra voz en la misma nota" /></div>}
        </div>
      ))}
    </div>
  );
}

function Meta({ n }: { n: NoticiaGuardada }) {
  return (
    <div className="pd-meta">
      <EstadoNoticia id={n.id} />
      <span>{n.minutos} <TranslatedText text="min" /></span>
    </div>
  );
}

export default function Portada() {
  return (
    <Suspense fallback={<div className="pd-wrap"><p className="pd-vacio"><TranslatedText text="Cargando la edición…" /></p></div>}>
      <Edicion />
    </Suspense>
  );
}

// Lee las ediciones guardadas; publicar nuevas ediciones requiere ejecutar el pipeline aparte.
async function Edicion() {
  await connection();
  const noticias = await noticiasPublicadas();
  const [principal, ...resto] = noticias;
  // Para la demo: solo datos públicos de las reservadas; se muestran cuando /generar las revela.
  const reservadas: Reservada[] = (await noticiasReservadas()).map((n) => ({
    id: n.id, seccion: n.seccion, titular: n.titular, bajada: n.bajada, creada: n.creada, minutos: n.minutos,
    medios: n.fuentes.map((f) => f.medio), miradas: n.miradas ?? [],
  }));
  const ultima = principal?.creada;

  return (
    <div className="pd-wrap">
      <div className="pd-top">
        <span className="pd-hoy">{ultima ? `Edición del ${fechaEdicion(ultima)}` : ""}</span>
        <div className="pd-top-der">
          <RachaChip />
          <Link className="pd-insights pd-plus" href="/plus">Plus</Link>
          <NavPeriodico actual="/" />
        </div>
      </div>
      <header className="pd-masthead">
        <h1>Fixazo</h1>
        <div className="pd-lema"><TranslatedText text="Periódico para leer con criterio" /></div>
      </header>

      <PracticeMemory />
      <Reveladas reservadas={reservadas} />
      {!principal ? (
        <p className="pd-vacio"><TranslatedText text="Todavía no hay noticias publicadas." /></p>
      ) : (
        <main className="pd-grid">
          <Link className="pd-card pd-principal" href={`/noticia/${principal.id}`}>
            <div className="eyebrow"><TranslatedText text={principal.seccion} /></div>
            <h2><TranslatedText text={principal.titular} /></h2>
            <p className="pd-bajada"><TranslatedText text={principal.bajada} /></p>
            <Miradas n={principal} />
            <Meta n={principal} />
            <span className="pd-leer"><TranslatedText text="Leer y responder" /></span>
          </Link>
          {resto.length > 0 && (
            <section className="pd-lista" aria-label="Más noticias">
              <p className="eyebrow"><TranslatedText text="Más noticias" /></p>
              {resto.map((n) => (
                <Link key={n.id} className="pd-card pd-item" href={`/noticia/${n.id}`}>
                  <div className="eyebrow"><TranslatedText text={n.seccion} /></div>
                  <h3><TranslatedText text={n.titular} /></h3>
                  <Meta n={n} />
                </Link>
              ))}
            </section>
          )}
        </main>
      )}
      <ExplorarVozYLenguas />
      <p className="pd-pie"><TranslatedText text="Fragmentos citados de cada medio, con enlace al original." /></p>
    </div>
  );
}
