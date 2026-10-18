// Portada del periódico: ediciones guardadas en data/ediciones, sin programador automático configurado.
// La app de familia de Ñawinchay sigue disponible en /chat (/consentimiento redirige ahí).
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import EstadoNoticia from "@/components/periodico/EstadoNoticia";
import { noticiasPublicadas, type NoticiaGuardada } from "@/lib/periodico/ediciones";

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
      <span>Escritura o voz opcional</span>
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

// Lee las ediciones guardadas; publicar nuevas ediciones requiere ejecutar el pipeline aparte.
async function Edicion() {
  await connection();
  const noticias = await noticiasPublicadas();
  const [principal, ...resto] = noticias;
  const ultima = principal?.creada;

  return (
    <div className="pd-wrap">
      <div className="pd-top">
        <span className="pd-hoy">Periódico · archivo de lectura</span>
        <Link className="pd-insights" href="/chat">Lectura por voz</Link>
        <Link className="pd-insights" href="/insights">Mis insights</Link>
      </div>
      <header className="pd-masthead">
        <h1>Ñawinchay</h1>
        <div className="pd-lema">Periódico para leer con criterio</div>
      </header>
      <div className="pd-barra">
        <span>{ultima ? <>Última edición guardada: <b>{fechaEdicion(ultima)}</b></> : "Sin ediciones guardadas"}</span>
        <span>Publicación manual · sin actualización automática configurada</span>
      </div>

      {!principal ? (
        <p className="pd-vacio">Todavía no hay ediciones guardadas. Puedes usar la lectura por voz mientras se publica una edición manualmente.</p>
      ) : (
        <main className="pd-grid">
          <Link className="pd-card pd-principal" href={`/noticia/${principal.id}`}>
            <div className="eyebrow">{principal.seccion} · {fechaEdicion(principal.creada)}</div>
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
                  <div className="eyebrow">{n.seccion} · {fechaEdicion(n.creada)}</div>
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
        Ediciones de archivo: las fechas corresponden al material guardado, no a noticias en tiempo real. Fragmentos citados de sus medios con enlace al original. Las preguntas no te dan la respuesta: te ayudan a encontrarla.
      </p>
    </div>
  );
}
