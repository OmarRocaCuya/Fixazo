"use client";
import { TranslatedText, useLanguage, usePublicTranslations } from "@/components/i18n/LanguageProvider";

// Mis insights: lo que el joven hizo en el periódico, desde su propio navegador.
// Reusa MetricCard y la idea de calibración del informe de Daniel (seguridad declarada frente a lo logrado).
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { RachaSemana } from "@/components/periodico/Racha";
import { voiceHistoryLabel } from "@/components/periodico/voz-state";
import { ResumenVozQuiz } from "@/components/periodico/EmocionRespuesta";
import { ExplorarVozYLenguas, NavPeriodico } from "@/components/periodico/NavPeriodico";
import { acumularMetricas, type MetricasVoz } from "@/lib/periodico/voz-quiz";
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
  const { t } = useLanguage();
  usePublicTranslations(["Noticias leídas", "De principio a fin", "Porqués bien explicados", "Respondiste con tu voz", "El resto, escribiendo", "Cambiaste de idea", "Cambiar con una buena razón vale igual que mantener", "Ninguna", "porqué logrado", "porqué para practicar", "sin evaluación de voz"]);
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
  const emociones = todas.flatMap((r) => r.emociones ?? []);
  const metricasVoz = todas.reduce<MetricasVoz | null>((m, r) => (r.audioQuiz ? acumularMetricas(m, r.audioQuiz) : m), null);

  return (
    <div className="pd-wrap pd-angosto">
      <div className="pd-top">
        <Link className="pd-marca" href="/">Fixazo</Link>
        <NavPeriodico actual="/insights" />
      </div>
      <header className="pd-noticia-cabeza">
        <div className="eyebrow"><TranslatedText text="Mis insights" /></div>
        <h1><TranslatedText text="Cómo vas leyendo las noticias" /></h1>
        <p className="muted"><TranslatedText text="No es una nota: muestra qué ya haces y qué practicar. Se guarda solo en este navegador." /></p>
      </header>

      {enCurso.length > 0 && (
        <p className="pd-calibracion"><TranslatedText text="En curso:" />{" "}{enCurso.map((r) => r.titular).join(" · ")}<TranslatedText text=". Tus habilidades se actualizan mientras respondes." /></p>
      )}
      {todas.length === 0 ? (
        <div className="pd-card">
          <p><TranslatedText text="Todavía no terminaste ninguna noticia. Cuando termines una, aquí vas a ver tus habilidades y cómo explicas con tu voz." /></p>
          <Link className="btn" href="/"><TranslatedText text="Ir a la portada" /></Link>
        </div>
      ) : (
        <div className="stack">
          {lista.length > 0 && <RachaSemana />}
          {/* Solo se muestra lo que ya tiene datos, para no llenar la pantalla de ceros. */}
          {lista.length > 0 && (
            <div className="metric-grid">
              <MetricCard title={t("Noticias leídas")} value={lista.length} caption={t("De principio a fin")} />
              {conVoz.length > 0 && <MetricCard title={t("Porqués bien explicados")} value={pct(explicadas, conVoz.length)} caption={`${explicadas} ${t("de")} ${conVoz.length}`} />}
              {conVoz.length > 0 && <MetricCard title={t("Respondiste con tu voz")} value={pct(porVoz, conVoz.length)} caption={t("El resto, escribiendo")} />}
              <MetricCard title={t("Cambiaste de idea")} value={cambios} caption={t("Cambiar con una buena razón vale igual que mantener")} />
            </div>
          )}

          <section className="pd-card">
            <h2><TranslatedText text="Tus habilidades" /></h2>
            <ul className="pd-habilidades">
              {[...habilidades].map(([h, v]) => (
                <li key={h}>
                  <div className="spread"><span>{h}</span><span className="muted small">{v.si} <TranslatedText text="de" />{" "}{v.total}</span></div>
                  <div className="pd-barra-nivel" role="img" aria-label={`${h}: ${v.si} de ${v.total}`}><span style={{ width: `${(v.si / v.total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </section>

          {conVoz.length > 0 && <section className="pd-card">
            <h2><TranslatedText text="Cómo explicas cuando hablas" /></h2>
            <p className="muted small"><TranslatedText text="Palabras y pausas de tus respuestas. Las emociones solo se estiman de forma experimental desde el audio (abajo)." /></p>
            <ul className="pd-senales">
              <li><span><TranslatedText text="Palabras de duda que usas" /></span><span>{dudas.length ? dudas.map(([w, n]) => `«${w}» ×${n}`).join(", ") : t("Ninguna")}</span></li>
              <li><span><TranslatedText text="Muletillas" /></span><span>{muletillas.length ? muletillas.map(([w, n]) => `«${w}» ×${n}`).join(", ") : t("Ninguna")}</span></li>
              <li><span><TranslatedText text="Pausas largas por respuesta" /></span><span>{pausas.length ? (pausas.reduce((a, b) => a + b, 0) / pausas.length).toFixed(1) : "—"}</span></li>
            </ul>
            {(seguros.length > 0 || dudosos.length > 0) && (
              <p className="pd-calibracion">
                {seguros.length > 0 && <><TranslatedText text="Cuando dijiste estar" />{" "}<b><TranslatedText text="muy seguro" /></b><TranslatedText text=", explicaste bien el porqué" />{" "}{seguros.filter((r) => r.voz?.listo).length} <TranslatedText text="de" />{" "}{seguros.length} <TranslatedText text="veces." />{" "}</>}
                {dudosos.length > 0 && <><TranslatedText text="Cuando dijiste estar" />{" "}<b><TranslatedText text="poco seguro" /></b><TranslatedText text=", igual lo lograste" />{" "}{dudosos.filter((r) => r.voz?.listo).length} <TranslatedText text="de" />{" "}{dudosos.length} <TranslatedText text="veces" />{dudosos.some((r) => r.voz?.listo) ? ": puedes confiar más en lo que piensas." : "."}</>}
              </p>
            )}
          </section>}

          <ResumenVozQuiz emociones={emociones} metricas={metricasVoz} />

          {lista.length > 0 && <section className="pd-card">
            <h2><TranslatedText text="Noticias que leíste" /></h2>
            <ul className="pd-historial">
              {lista.map((r) => (
                <li key={r.noticiaId}>
                  <Link href={`/noticia/${r.noticiaId}`}>{r.titular}</Link>
                  <span className="muted small">{new Date(r.fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" })} · {t(voiceHistoryLabel(r.voz))}</span>
                </li>
              ))}
            </ul>
          </section>}

          <p className="pd-pie"><TranslatedText text="Lo que no medimos: tu inteligencia ni cómo te comparas con otros. La emoción es una estimación experimental de la voz, nunca una nota." /></p>
        </div>
      )}
      <ExplorarVozYLenguas />
    </div>
  );
}
