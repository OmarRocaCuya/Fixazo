import type { RespuestaVoz } from "@/lib/periodico/tipos";

/** Each recognizer returns only its own recording, never the previous answer. */
export class RecordingAnswer {
  private epoch = 0;
  private base = "";
  private current = "";
  begin(previous: string): number {
    this.base = previous.trim();
    this.current = this.base;
    return ++this.epoch;
  }
  partial(epoch: number, transcript: string): string | null {
    if (epoch !== this.epoch) return null;
    this.current = [this.base, transcript.trim()].filter(Boolean).join(" ");
    return this.current;
  }
  finish(epoch: number, transcript: string): string | null {
    if (epoch !== this.epoch) return null;
    const answer = transcript.trim() ? this.partial(epoch, transcript)! : this.current;
    this.epoch++;
    return answer;
  }
  cancel() { this.epoch++; }
}

/** Availability is not evidence about a reader. Only actual judgments consume attempts. */
export function applyVoiceEvaluation(result: RespuestaVoz, attempts: number) {
  const evaluated = result.evaluacion === "evaluada" && result.cuenta === true;
  const nextAttempts = attempts + (evaluated ? 1 : 0);
  return { evaluated, attempts: nextAttempts, complete: evaluated && (result.listo || nextAttempts >= 2) };
}

export function voiceHistoryLabel(voice: { listo: boolean } | null): string {
  return voice ? voice.listo ? "porqué logrado" : "porqué para practicar" : "sin evaluación de voz";
}
