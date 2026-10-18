// Child-facing projection of the session snapshot. It is an explicit allowlist:
// adult-only data (live signals, the experimental emotion estimate, scores) can
// never reach the child zone, because it is simply not copied here.
import type { SessionState, Utterance } from "./machine";

export interface ChildLine {
  who: "agente" | "nino";
  show: string;
  showEs?: string;
}

export interface ChildViewSource {
  phase: string;
  ctx: { state: SessionState; resumeState: SessionState | null; awaitingConfidence: boolean } | null;
  utterance: Utterance | null;
  lines: ChildLine[];
  readProgress: number;
  caption: string;
  listening: boolean;
  simulation: boolean;
}

export interface ChildView {
  phase: string;
  state: SessionState | null;
  awaitingConfidence: boolean;
  utterance: { show: string; showEs?: string } | null;
  lines: ChildLine[];
  readProgress: number;
  caption: string;
  listening: boolean;
  simulation: boolean;
}

export function toChildView(src: ChildViewSource): ChildView {
  const ctx = src.ctx;
  return {
    phase: src.phase,
    state: ctx ? (ctx.state === "PAUSED" ? ctx.resumeState : ctx.state) : null,
    awaitingConfidence: ctx?.awaitingConfidence ?? false,
    utterance: src.utterance ? { show: src.utterance.show, ...(src.utterance.showEs ? { showEs: src.utterance.showEs } : {}) } : null,
    lines: src.lines.map((l) => ({ who: l.who, show: l.show, ...(l.showEs ? { showEs: l.showEs } : {}) })),
    readProgress: src.readProgress,
    caption: src.caption,
    listening: src.listening,
    simulation: src.simulation,
  };
}
