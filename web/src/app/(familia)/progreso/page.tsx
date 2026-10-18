"use client";
import Link from "next/link";
import type { Level, QuestionKind, Report } from "@/lib/types";
import { useStore } from "@/lib/useStore";
import { LevelCell, MetricCard } from "@/components/ui";

const ROWS: Array<{ k: QuestionKind; label: string }> = [
  { k: "obtiene", label: "Qué dice" },
  { k: "infiere", label: "Por qué pasó" },
  { k: "reflexiona", label: "Qué opina" },
];

const num = (l: Level) => (l === "NO" ? null : l);
const pct = (a: number, b: number) => (b === 0 ? "—" : `${Math.round((a / b) * 100)} %`);
const day = (iso: string) => new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short" });

function spanDays(rs: Report[]) {
  if (rs.length < 2) return 0;
  const t = rs.map((r) => Date.parse(r.createdAt));
  return (Math.max(...t) - Math.min(...t)) / 86_400_000;
}

function focusFor(rs: Report[]): string {
  const avg = (k: QuestionKind) => {
    const v = rs.map((r) => num(r.levels[k].level)).filter((x): x is 0 | 1 | 2 | 3 => x !== null);
    return v.length ? v.reduce<number>((a, b) => a + b, 0) / v.length : 3;
  };
  const weakest = ROWS.map((r) => ({ ...r, v: avg(r.k) })).sort((a, b) => a.v - b.v)[0];
  if (weakest.v >= 2.5) return "dar razones que consideren otra opción: pregúntale «¿y qué más pudo hacer?».";
  if (weakest.k === "obtiene") return "encontrar datos en la lectura: pídele que te muestre dónde lo dice.";
  if (weakest.k === "infiere") return "explicar por qué pasan las cosas: pregunta «¿por qué crees que pasó?».";
  return "dar su opinión con una razón del texto: pregunta «¿qué parte de la lectura te hace pensar eso?».";
}

export default function ProgressPage() {
  const store = useStore();
  if (!store) return <div className="skeleton" style={{ height: 420 }} />;
  const all = [...store.listReports()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const alias = store.loadProfile()?.alias ?? "tu hijo";
  const recent = all.slice(-8);

  if (all.length === 0)
    return (
      <div className="page">
        <span className="eyebrow">Últimas 4 semanas</span>
        <h1>Progreso de {alias}</h1>
        <div className="card stack">
          <p>Todavía no hay sesiones. Cuando haga la primera misión, aquí verás su avance.</p>
          <Link className="btn" href="/chat" style={{ justifySelf: "start" }}>
            Ir al chat
          </Link>
        </div>
      </div>
    );

  const pcpms = recent.map((r) => r.fluency.pcpm);
  const max = Math.max(60, ...pcpms.filter((v): v is number => v !== null));
  const withDecision = all.filter((r) => r.chain.revision.decision !== null);
  const justified = withDecision.filter((r) => r.conversation.changedWithReason || r.conversation.keptWithReason).length;
  const calibrated = all.filter((r) => r.process.calibration !== "sin_dato");
  const adjusted = calibrated.filter((r) => r.process.calibration === "ajustada").length;
  const cols = recent.slice(-4);
  const hasQuechua = all.some((r) => r.lang === "qu");
  const enough = spanDays(all) >= 14;
  const first = pcpms.find((v) => v !== null) ?? null;
  const last = [...pcpms].reverse().find((v) => v !== null) ?? null;
  const headline =
    first !== null && last !== null && recent.length > 1
      ? last > first
        ? `${alias} lee ${last - first} palabras más por minuto que al inicio`
        : `${alias} sigue practicando su lectura`
      : `${alias} hizo su primera misión`;

  return (
    <div className="page">
      <div className="stack-sm">
        <span className="eyebrow">Últimas 4 semanas</span>
        <h1>{headline}</h1>
        <p className="notice info">Este panel incluye resultados provisionales. Confirma la evidencia en cada informe antes de usarla en una evaluación; las señales de duda no forman parte de los niveles.</p>
        {!enough && <p className="notice info">Necesitamos 2 semanas para mostrar una tendencia. Mientras tanto, mostramos cada sesión.</p>}
      </div>

      <section className="card stack">
        <h2>Palabras correctas por minuto</h2>
        <div className="bars" role="img" aria-label={`Palabras correctas por minuto por sesión: ${recent.map((r) => `${day(r.createdAt)} ${r.fluency.pcpm ?? "sin dato"}`).join(", ")}`}>
          {recent.map((r, i) => (
            <div key={r.id} className={`bar${i === recent.length - 1 ? " current" : ""}`}>
              <span className="mono small">{r.fluency.pcpm ?? "—"}</span>
              <div className="fill" style={{ height: `${r.fluency.pcpm ? Math.max(4, (r.fluency.pcpm / max) * 100) : 2}%` }} />
              <span className="small muted">{day(r.createdAt)}</span>
            </div>
          ))}
        </div>
        {hasQuechua && <p className="small muted">Las metas de palabras por minuto en quechua están por definir hasta tener datos del piloto.</p>}
      </section>

      <section className="card stack">
        <h2>Niveles por sesión</h2>
        <div className="level-grid" style={{ ["--cols" as string]: cols.length }}>
          <div className="lg-row">
            <span />
            {cols.map((r) => (
              <span key={r.id} className="small muted" style={{ textAlign: "center" }}>
                {day(r.createdAt)}
                <br />{r.review?.status === "revisado" ? "Revisado" : "Provisional"}
              </span>
            ))}
          </div>
          {ROWS.map((row) => (
            <div key={row.k} className="lg-row">
              <span className="small">{row.label}</span>
              {cols.map((r) => (
                <LevelCell key={r.id} level={r.levels[row.k].level} />
              ))}
            </div>
          ))}
        </div>
        <p className="small muted">0 a 3 por rúbrica; «NO» significa que no se pudo observar (no es un 0).</p>
      </section>

      <div className="metric-grid">
        <MetricCard title="Lecturas SOLO" value="—" caption="Lecturas sin ayuda de los viernes: por definir en el piloto." />
        <MetricCard title="Cambios con razón" value={pct(justified, withDecision.length)} caption="Ante el dato nuevo, mantuvo o cambió su idea con una buena razón." />
        <MetricCard title="Seguridad ajustada" value={pct(adjusted, calibrated.length)} caption="Cuando dice estar segura, acierta." />
        <MetricCard title="Misiones hechas" value={all.length} caption="Sesiones completas guardadas en este dispositivo." />
      </div>

      <section className="card soft stack-sm">
        <h2>Esta semana trabajamos…</h2>
        <p>{focusFor(recent)}</p>
      </section>
    </div>
  );
}
