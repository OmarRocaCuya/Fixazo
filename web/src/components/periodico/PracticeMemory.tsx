"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { practiceGoals, type PracticeGoal } from "@/lib/periodico/practice-goals";

const responseSchema = z.object({ state: z.enum(["disabled", "ready", "unavailable"]), goals: z.array(z.enum(["evidence", "explain", "accompanied"])).optional() });
type MemoryState = { kind: "loading" } | { kind: "disabled" } | { kind: "unavailable" } | { kind: "ready"; goals: PracticeGoal[] };

export function PracticeMemory({ goal }: { goal?: PracticeGoal }) {
  const [state, setState] = useState<MemoryState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/periodico/practice-memory", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const parsed = responseSchema.parse(await response.json());
        if (parsed.state === "ready") setState({ kind: "ready", goals: parsed.goals ?? [] });
        else setState({ kind: parsed.state });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ kind: "unavailable" }); });
    return () => controller.abort();
  }, []);

  async function update(clear: boolean) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/periodico/practice-memory", {
        method: clear ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: clear ? undefined : JSON.stringify({ goal }),
      });
      if (!response.ok) throw new Error("unavailable");
      const parsed = responseSchema.parse(await response.json());
      if (parsed.state !== "ready") throw new Error("unavailable");
      if (clear) {
        setState({ kind: "ready", goals: [] });
        setNotice("Tus objetivos guardados se eliminaron de Atomic Memory.");
      } else if (goal) {
        const goals = state.kind === "ready" ? state.goals : [];
        setState({ kind: "ready", goals: [...new Set([...goals, goal])] });
        setNotice("Objetivo guardado para tu próxima lectura en este navegador.");
      }
    } catch {
      setNotice(clear ? "No pudimos eliminar los objetivos. Se conservan para que puedas volver a intentarlo." : "No pudimos guardar el objetivo. Tu lectura y tus resultados siguen disponibles aquí.");
    } finally { setBusy(false); }
  }

  if (state.kind === "loading" || state.kind === "disabled") return null;
  const goals = state.kind === "ready" ? state.goals : [];
  const saved = goal !== undefined && goals.includes(goal);
  if (!goal && state.kind === "ready" && !goals.length) return null;
  return <section className="pd-card stack" aria-label="Objetivos para tu próxima lectura">
    <div className="eyebrow">Para tu próxima lectura</div>
    <h2>{goal ? "Llévate un objetivo" : "Retoma lo que querías practicar"}</h2>
    {goal && <p>{practiceGoals[goal]}</p>}
    {!goal && goals.length > 0 && <ul className="pd-lista-logros">{goals.map((item) => <li key={item}>{practiceGoals[item]}</li>)}</ul>}
    <p className="small muted">Solo si tú lo eliges, Atomic Memory guarda este objetivo. No enviamos nombres, respuestas, notas, audio ni emociones. Está asociado a este navegador, no a una cuenta.</p>
    {state.kind === "unavailable" && <p className="small">No pudimos consultar tus objetivos guardados. Puedes continuar leyendo.</p>}
    <div className="row">
      {goal && <button type="button" className="btn primary" disabled={busy || saved} onClick={() => void update(false)}>{saved ? "Objetivo guardado" : "Recordar este objetivo"}</button>}
      {(goals.length > 0 || state.kind === "unavailable") && <button type="button" className="btn ghost" disabled={busy} onClick={() => void update(true)}>Borrar objetivos guardados</button>}
    </div>
    <p className="small" role="status" aria-live="polite">{busy ? "Actualizando tus objetivos…" : notice}</p>
  </section>;
}
