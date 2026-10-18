// Portada del periódico. Lee lo que el pipeline publicó (data/ediciones) en cada visita.
// La app de familia de Ñawinchay sigue disponible en /consentimiento y /chat.
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import EstadoNoticia from "@/components/periodico/EstadoNoticia";
import { noticiasPublicadas, type NoticiaGuardada } from "@/lib/periodico/ediciones";

const LIMA = { timeZone: "America/Lima" } as const;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { ...LIMA, hour: "2-digit", minute: "2-digit", hour12: false });
const hace = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ""}`;
};
// ponytail: cadencia fija de la demo; en producción, una edición diaria a una hora fija.
const CADA_MIN = 30;

function Miradas({ n }: { n: NoticiaGuardada }) {
  const m = n.miradas ?? [];
  if (!m.length) return null;
  return (
    <div className="pd-miradas" aria-label="Cómo lo cuenta cada medio o voz">
      {m.map((x, k) => (
        <div key={k} className={`pd-mirada ${k ? "b" : "a"}`}>
          <div className="pd-mirada-medio">{x.medio}</div>
          {x.texto ? <div className="pd-mirada-cita">«{x.texto}»</div> : <div className="pd-mirada-cita sin-cita">Otra voz en la misma nota</div>}
        </div>
      ))}
    </div>
  );
}

function Meta({ n }: { n: NoticiaGuardada }) {
  const preguntas = n.pasos.filter((p) => p.tipo !== "fragmento").length;
  return (
    <div className="pd-meta">
      <EstadoNoticia id={n.id} />
      <span>{n.minutos} min</span>
      <span>{preguntas} preguntas</span>
      <span>🎤 1 con tu voz</span>
    </div>
  );
}

export default function Portada() {
  return (
    <Suspense fallback={<div className="pd-wrap"><p className="pd-vacio">Cargando la edición…</p></div>}>
      <Edicion />
    </Suspense>
  );
}

// Se lee en cada visita: el pipeline agrega noticias mientras la app corre.
async function Edicion() {
  await connection();
  const noticias = await noticiasPublicadas();
  const [principal, ...resto] = noticias;
  const ultima = principal?.creada;
  const proxima = ultima ? new Date(new Date(ultima).getTime() + CADA_MIN * 60000).toISOString() : null;
  const hoy = new Date().toLocaleDateString("es-PE", { ...LIMA, weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="pd-wrap">
      <div className="pd-top">
        <span className="pd-hoy">{hoy}</span>
        <Link className="pd-insights" href="/insights">Mis insights</Link>
      </div>
      <header className="pd-masthead">
        <h1>Fixazo</h1>
        <div className="pd-lema">Noticias del día para leer con criterio</div>
      </header>
      <div className="pd-barra">
        <span className="pd-vivo">{ultima ? <>Edición de las <b>{hora(ultima)}</b></> : "Preparando la primera edición"}</span>
        <span>Tema de hoy: <b>Inteligencia artificial</b></span>
        {proxima && <span>Próxima noticia: <b>{hora(proxima)}</b></span>}
      </div>

      {!principal ? (
        <p className="pd-vacio">Todavía no hay noticias publicadas. El pipeline agrega una cada {CADA_MIN} minutos.</p>
      ) : (
        <main className="pd-grid">
          <Link className="pd-card pd-principal" href={`/noticia/${principal.id}`}>
            <div className="eyebrow">{principal.seccion} · {hace(principal.creada)}</div>
            <h2>{principal.titular}</h2>
            <p className="pd-bajada">{principal.bajada}</p>
            <Miradas n={principal} />
            <Meta n={principal} />
            <span className="pd-leer">Leer y responder</span>
          </Link>
          {resto.length > 0 && (
            <section className="pd-lista" aria-label="Más noticias">
              <p className="eyebrow">Más noticias</p>
              {resto.map((n) => (
                <Link key={n.id} className="pd-card pd-item" href={`/noticia/${n.id}`}>
                  <div className="eyebrow">{n.seccion} · {hace(n.creada)}</div>
                  <h3>{n.titular}</h3>
                  <Miradas n={n} />
                  <Meta n={n} />
                </Link>
              ))}
            </section>
          )}
        </main>
      )}
      <p className="pd-pie">
        Fragmentos citados de sus medios con enlace al original. Las preguntas no te dan la respuesta: te ayudan a encontrarla.
      </p>
    </div>
  );
}
