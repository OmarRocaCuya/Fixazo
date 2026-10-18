// Agent voice via the browser's speechSynthesis. Records when the agent was
// speaking (for barge-in detection). Degrades to silent text when unavailable.

export interface SpeakingInterval {
  start: number;
  end: number;
}

function pickVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang.toLowerCase() === "es-pe") ??
      voices.find((v) => v.lang.toLowerCase().startsWith("es-4") || v.lang.toLowerCase() === "es-us" || v.lang.toLowerCase() === "es-mx") ??
      voices.find((v) => v.lang.toLowerCase().startsWith("es")) ??
      null
    );
  } catch {
    return null;
  }
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export class AgentVoice {
  muted = false;
  speaking = false;
  intervals: SpeakingInterval[] = [];
  private finish: (() => void) | null = null;

  constructor(private clock: () => number) {}

  /** Resolves when the utterance ends (or immediately when muted/unsupported). */
  speak(text: string, onStart?: () => void): Promise<void> {
    this.cancel();
    if (this.muted || !ttsSupported() || !text.trim()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const start = this.clock();
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        this.speaking = false;
        this.finish = null;
        this.intervals.push({ start, end: this.clock() });
        if (this.intervals.length > 50) this.intervals.shift();
        clearTimeout(guard);
        resolve();
      };
      this.finish = end;
      // Some browsers never fire `end`; guard with a length-based timeout.
      const guard = setTimeout(end, Math.max(2500, text.length * 90));
      try {
        const u = new SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? "es-PE";
        u.rate = 0.95;
        u.onstart = () => {
          this.speaking = true;
          onStart?.();
        };
        u.onend = end;
        u.onerror = end;
        this.speaking = true;
        window.speechSynthesis.speak(u);
      } catch {
        end();
      }
    });
  }

  cancel() {
    try {
      if (ttsSupported()) window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    this.finish?.();
  }
}
