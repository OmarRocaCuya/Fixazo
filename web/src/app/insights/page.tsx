"use client";
// Mis insights: lo que el joven hizo en el periódico, desde su propio navegador.
// Reusa MetricCard y la idea de calibración del informe de Daniel (seguridad declarada frente a lo logrado).
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { MetricCard } from "@/components/ui";
import { leerResultados, suscribirProgreso, type ResultadoNoticia } from "@/lib/periodico/progreso";

const vacio: ResultadoNoticia[] = [];
let cache: { raw: string; lista: ResultadoNoticia[] } = { raw: "", lista: vacio };
function leer(): ResultadoNoticia[] {
  let raw = "";
  try {
    raw = localStorage.getItem("fixazo:resultados") ?? "";
  } catch {
    return vacio;
  }
  if (raw !== cache.raw) cache = { raw, lista: Object.values(leerResultados()).sort((a, b) => b.fecha.localeCompare(a.fecha)) };
  return cache.lista;
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const contar = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

export default function Insights() {
  // Se actualiza en vivo si la noticia está abierta en otra pestaña.
  const todas = useSyncExternalStore(suscribirProgreso, leer, () => vacio);
  const lista = todas.filter((r) => !r.enCurso);
  const enCurso = todas.filter((r) => r.enCurso);

  const habilidades = new Map<string, { si: number; total: number }>();
  for (const r of todas) for (const [h, ok] of Object.entries(r.habilidades)) {
    const v = habilidades.get(h) ?? { si: 0, total: 0 };
    habilidades.set(h, { si: v.si + (ok ? 1 : 0), total: v.total + 1 });
  }
  const conVoz = lista.filter((r) => r.voz);
  const porVoz = conVoz.filter((r) => r.voz?.porVoz).length;
  const explicadas = conVoz.filter((r) => r.voz?.listo).length;
  const dudas = contar(conVoz.flatMap((r) => r.voz?.dudas ?? []));
  const muletillas = contar(conVoz.flatMap((r) => r.voz?.muletillas ?? []));
  const pausas = conVoz.map((r) => r.voz?.pausasLargas).filter((x): x is number => typeof x === "number");
  const cambios = lista.filter((r) => r.decision?.startsWith("Cambio")).length;
  const seguros = lista.filter((r) => r.seguridad === "Muy seguro" && r.voz);
  const dudosos = lista.filter((r) => r.seguridad === "Poco" && r.voz);

  return (
    <div className="pd-wrap pd-angosto">
      <div className="pd-top">
        <Link className="pd-marca" href="/">Fixazo</Link>
        <Link className="pd-insights" href="/">Volver a la portada</Link>
      </div>
      <header className="pd-noticia-cabeza">
        <div className="eyebrow">Mis insights</div>
        <h1>Cómo vas leyendo las noticias</h1>
        <p className="muted">Se guarda solo en este navegador. No es una nota: muestra qué ya haces y qué practicar.</p>
      </header>

      {enCurso.length > 0 && (
        <p className="pd-calibracion">En curso: {enCurso.map((r) => r.titular).join(" · ")}. Tus habilidades se actualizan mientras respondes.</p>
      )}
      {todas.length === 0 ? (
        <div className="pd-card">
          <p>Todavía no terminaste ninguna noticia. Cuando termines una, aquí vas a ver tus habilidades y cómo explicas con tu voz.</p>
          <Link className="btn" href="/">Ir a la portada</Link>
        </div>
      ) : (
        <div className="stack">
          <div className="metric-grid">
            <MetricCard title="Noticias leídas" value={lista.length} caption="Terminadas de principio a fin" />
            <MetricCard title="Porqués bien explicados" value={pct(explicadas, conVoz.length)} caption={`${explicadas} de ${conVoz.length} con razones de la noticia`} />
            <MetricCard title="Respondiste con tu voz" value={pct(porVoz, conVoz.length)} caption="El resto, escribiendo" />
            <MetricCard title="Cambiaste de idea" value={cambios} caption="Cambiar con una buena razón vale igual que mantener" />
          </div>

          <section className="pd-card">
            <h2>Tus habilidades</h2>
            <ul className="pd-habilidades">
              {[...habilidades].map(([h, v]) => (
                <li key={h}>
                  <div className="spread"><span>{h}</span><span className="muted small">{v.si} de {v.total}</span></div>
                  <div className="pd-barra-nivel" role="img" aria-label={`${h}: ${v.si} de ${v.total}`}><span style={{ width: `${(v.si / v.total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </section>

          <section className="pd-card">
            <h2>Cómo explicas cuando hablas</h2>
            <p className="muted small">Lo mide la capa de voz en tu navegador: palabras, pausas y ritmo. No intenta adivinar cómo te sientes.</p>
            <ul className="pd-senales">
              <li><span>Palabras de duda que usas</span><span>{dudas.length ? dudas.map(([w, n]) => `«${w}» ×${n}`).join(", ") : "Ninguna"}</span></li>
              <li><span>Muletillas</span><span>{muletillas.length ? muletillas.map(([w, n]) => `«${w}» ×${n}`).join(", ") : "Ninguna"}</span></li>
              <li><span>Pausas largas por respuesta</span><span>{pausas.length ? (pausas.reduce((a, b) => a + b, 0) / pausas.length).toFixed(1) : "—"}</span></li>
            </ul>
            {(seguros.length > 0 || dudosos.length > 0) && (
              <p className="pd-calibracion">
                {seguros.length > 0 && <>Cuando dijiste estar <b>muy seguro</b>, explicaste bien el porqué {seguros.filter((r) => r.voz?.listo).length} de {seguros.length} veces. </>}
                {dudosos.length > 0 && <>Cuando dijiste estar <b>poco seguro</b>, igual lo lograste {dudosos.filter((r) => r.voz?.listo).length} de {dudosos.length} veces{dudosos.some((r) => r.voz?.listo) ? ": puedes confiar más en lo que piensas." : "."}</>}
              </p>
            )}
          </section>

          <section className="pd-card">
            <h2>Noticias que leíste</h2>
            <ul className="pd-historial">
              {lista.map((r) => (
                <li key={r.noticiaId}>
                  <Link href={`/noticia/${r.noticiaId}`}>{r.titular}</Link>
                  <span className="muted small">{new Date(r.fecha).toLocaleDateString("es-PE", { day: "numeric", month: "short" })} · {r.voz?.listo ? "porqué logrado" : "porqué para practicar"}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="pd-pie">Lo que no medimos: tus emociones, tu inteligencia ni cómo te comparas con otros.</p>
        </div>
      )}
    </div>
  );
}
