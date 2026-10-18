import type { CloudVoiceAccess, VoiceCloudMode } from "@/lib/voice/types";
import { normalizeWord } from "@/lib/signals/text";

export type ReadingLanguage = "quy_Latn" | "ayr_Latn";
/** ASR also accepts Spanish; native translation/TTS selectors stay unchanged. */
export type ReadingAsrLanguage = ReadingLanguage | "spa_Latn";
export type ReadingDialogueMode = "guided-reading" | "local-llm-reading";
export interface ReadingHistoryEntry { role: "user" | "assistant"; text: string }
export const READING_LANGUAGES: { value: ReadingLanguage; label: string }[] = [
  { value: "quy_Latn", label: "Quechua Ayacucho" },
  { value: "ayr_Latn", label: "Aimara central" },
];
export interface ReadingCapabilities {
  enabled: boolean;
  mode: VoiceCloudMode;
  reason: string | null;
  asr: { ready: boolean; model: string; languages: string[]; wordTimestamps: boolean; timingMethod: string | null };
  translation: { enabled: boolean; ready: boolean; languages: string[] };
  speech: { enabled: boolean; languages: string[]; models: Record<string, string>; ready?: Record<string, boolean> };
  dialogue?: { enabled: boolean; ready: boolean; model: string | null };
}
export interface TimedReadingWord { word: string; start: number; end: number; confidence: null }
export interface ReadingTranscript {
  text: string; model: string; language: ReadingAsrLanguage; durationSeconds: number;
  words: TimedReadingWord[]; wordTimestamps: true; timingMethod: "ctc-greedy-frames"; requiresHumanReview: true;
}
export interface PreparedReading { passage: string; opening: string; dialogueMode: ReadingDialogueMode; requiresHumanReview: true }
export interface ReadingReply { heardSpanish: string; replyText: string; replySpanish: string; dialogueMode: ReadingDialogueMode; requiresHumanReview: true; model?: string | null }

export class ReadingClientError extends Error {
  constructor(readonly code: string) { super(code); this.name = "ReadingClientError"; }
}
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const stringList = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === "string") ? value as string[] : [];
const validText = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;

async function boundedBytes(response: Response, maximum: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("Content-Length") ?? 0);
  if (declared > maximum) throw new ReadingClientError("response-too-large");
  const reader = response.body?.getReader();
  if (!reader) throw new ReadingClientError("invalid-response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new ReadingClientError("response-too-large"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) { joined.set(part, offset); offset += part.byteLength; }
  return joined;
}
async function jsonBody(response: Response): Promise<Record<string, unknown>> {
  try { return record(JSON.parse(new TextDecoder().decode(await boundedBytes(response, 256_000)))); }
  catch (error) { if (error instanceof ReadingClientError) throw error; throw new ReadingClientError("invalid-response"); }
}
const validDialogueMode = (value: unknown): value is ReadingDialogueMode => value === "guided-reading" || value === "local-llm-reading";

/** Keep only bounded excerpts of actual Spanish turns, never a system prompt. */
export function boundedReadingHistory(history: readonly ReadingHistoryEntry[]): ReadingHistoryEntry[] {
  const result = history.filter((entry) => (entry.role === "user" || entry.role === "assistant") && typeof entry.text === "string" && entry.text.trim())
    .slice(-6).map((entry) => ({ role: entry.role, text: entry.text.trim().slice(0, 600) }));
  while (result.reduce((total, entry) => total + entry.text.length, 0) > 2500) result.shift();
  return result;
}

/** Same-origin only. Holds authorization in memory, never saves audio or text. */
export class MetaReadingClient {
  private requests = new Set<AbortController>();
  private closed = false;
  constructor(private access: CloudVoiceAccess, private request: typeof fetch = fetch) {}

  static async capabilities(signal: AbortSignal, request: typeof fetch = fetch): Promise<ReadingCapabilities> {
    const response = await request("/api/reading", { cache: "no-store", signal });
    const data = await jsonBody(response);
    if (!response.ok || typeof data.enabled !== "boolean" || !["disabled", "adult-demo", "approved-pilot"].includes(String(data.mode))) throw new ReadingClientError("status-unavailable");
    const asr = record(data.asr), translation = record(data.translation), speech = record(data.speech);
    if (typeof asr.ready !== "boolean" || typeof translation.enabled !== "boolean" || typeof translation.ready !== "boolean" || typeof speech.enabled !== "boolean") throw new ReadingClientError("invalid-response");
    return { enabled: data.enabled, mode: data.mode as VoiceCloudMode, reason: typeof data.reason === "string" ? data.reason : null,
      asr: { ready: asr.ready, model: typeof asr.model === "string" ? asr.model : "Omnilingual ASR", languages: stringList(asr.languages), wordTimestamps: asr.wordTimestamps === true, timingMethod: typeof asr.timingMethod === "string" ? asr.timingMethod : null },
      translation: { enabled: translation.enabled, ready: translation.ready, languages: stringList(translation.languages) },
      speech: { enabled: speech.enabled, languages: stringList(speech.languages), models: Object.fromEntries(Object.entries(record(speech.models)).filter((entry): entry is [string, string] => typeof entry[1] === "string")), ready: Object.fromEntries(Object.entries(record(speech.ready)).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")) },
      ...(typeof record(data.dialogue).enabled === "boolean" && typeof record(data.dialogue).ready === "boolean"
        ? { dialogue: { enabled: record(data.dialogue).enabled as boolean, ready: record(data.dialogue).ready as boolean, model: typeof record(data.dialogue).model === "string" ? record(data.dialogue).model as string : null } } : {}) };
  }

  private async send(body: BodyInit, json: boolean, audio = false): Promise<Record<string, unknown> | Blob> {
    if (this.closed) throw new ReadingClientError("cancelled");
    const controller = new AbortController();
    this.requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 65_000);
    try {
      // Native browser fetch must not receive this client as its receiver.
      const request = this.request;
      const response = await request("/api/reading", { method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { "X-Voice-Access-Code": this.access.accessCode, ...(json ? { "Content-Type": "application/json" } : {}) }, body });
      if (controller.signal.aborted || this.closed) throw new ReadingClientError("cancelled");
      if (!response.ok) {
        const error = await jsonBody(response);
        throw new ReadingClientError(typeof error.error === "string" && /^[a-z0-9-]{1,80}$/.test(error.error) ? error.error : "service-unavailable");
      }
      if (!audio) return await jsonBody(response);
      if (!response.headers.get("Content-Type")?.toLowerCase().startsWith("audio/wav")) throw new ReadingClientError("invalid-audio-response");
      const bytes = await boundedBytes(response, 2_000_000);
      if (bytes.length < 44 || new TextDecoder().decode(bytes.slice(0, 4)) !== "RIFF" || new TextDecoder().decode(bytes.slice(8, 12)) !== "WAVE") throw new ReadingClientError("invalid-audio-response");
      return new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" });
    } catch (error) {
      if (error instanceof ReadingClientError) throw error;
      throw new ReadingClientError(controller.signal.aborted ? "cancelled-or-timeout" : "network");
    } finally { clearTimeout(timeout); this.requests.delete(controller); }
  }

  async prepare(passage: string, language: ReadingLanguage): Promise<PreparedReading> {
    const data = record(await this.send(JSON.stringify({ action: "prepare", passage, language }), true));
    if (!validText(data.passage, 20_000) || !validText(data.opening, 300) || !validDialogueMode(data.dialogueMode) || data.requiresHumanReview !== true) throw new ReadingClientError("invalid-response");
    return data as unknown as PreparedReading;
  }
  async transcribe(audio: Blob, language: ReadingAsrLanguage): Promise<ReadingTranscript> {
    if (audio.size < 44 || audio.size > 1_000_000) throw new ReadingClientError("invalid-audio");
    const form = new FormData();
    form.set("action", "transcribe"); form.set("file", audio, "turno.wav"); form.set("language", language);
    const data = record(await this.send(form, false));
    if (!validText(data.text, 8000) || !validText(data.model, 200) || data.language !== language || typeof data.durationSeconds !== "number" || !Number.isFinite(data.durationSeconds) || data.durationSeconds < 0.1 || data.durationSeconds > 30 || !Array.isArray(data.words) || data.words.length > 2000 || data.wordTimestamps !== true || data.timingMethod !== "ctc-greedy-frames" || data.requiresHumanReview !== true) throw new ReadingClientError("invalid-timed-transcript");
    let last = 0;
    const words = data.words.map((value): TimedReadingWord => {
      const word = record(value);
      if (!validText(word.word, 200) || typeof word.start !== "number" || typeof word.end !== "number" || !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < last || word.end < word.start || word.end > (data.durationSeconds as number) + 0.1) throw new ReadingClientError("invalid-word-timing");
      last = word.start;
      return { word: word.word as string, start: word.start, end: word.end, confidence: null };
    });
    if (!words.length) throw new ReadingClientError("no-observable-words");
    return { text: data.text as string, model: data.model as string, language, durationSeconds: data.durationSeconds,
      words, wordTimestamps: true, timingMethod: "ctc-greedy-frames", requiresHumanReview: true };
  }
  async turn(passage: string, heard: string, language: ReadingLanguage, turn: number, history: readonly ReadingHistoryEntry[] = []): Promise<ReadingReply> {
    if (!Number.isInteger(turn) || turn < 0 || turn > 8 || !heard.trim()) throw new ReadingClientError("invalid-turn");
    const data = record(await this.send(JSON.stringify({ action: "turn", passage, heard, language, turn, ...(history.length ? { history: boundedReadingHistory(history) } : {}) }), true));
    if (!validText(data.heardSpanish, 8000) || !validText(data.replyText, 300) || !validText(data.replySpanish, 1500) || !validDialogueMode(data.dialogueMode) || data.requiresHumanReview !== true || (data.model !== undefined && data.model !== null && !validText(data.model, 200))) throw new ReadingClientError("invalid-response");
    return data as unknown as ReadingReply;
  }
  async speak(text: string, language: ReadingLanguage): Promise<Blob> {
    if (!validText(text, 300)) throw new ReadingClientError("speech-text-too-long");
    return await this.send(JSON.stringify({ action: "speak", text, language }), true, true) as Blob;
  }
  cancel() { for (const request of this.requests) request.abort(); this.requests.clear(); }
  close() { this.closed = true; this.cancel(); this.access = { ...this.access, accessCode: "" }; }
}

export function referenceWords(passage: string): string[] { return passage.split(/\s+/).filter((word) => normalizeWord(word).length > 0); }

/** Only exact observed matches are colored, never an inferred skipped prefix. */
export function matchObservedWords(passage: string, words: TimedReadingWord[], previous: ReadonlySet<number> = new Set(), cursor = 0, lookahead = 8): { observed: Set<number>; cursor: number } {
  const expected = referenceWords(passage).map(normalizeWord);
  const observed = new Set([...previous].filter((index) => Number.isInteger(index) && index >= 0 && index < expected.length));
  let next = Math.min(expected.length, Math.max(0, cursor));
  for (const token of words) {
    const spoken = normalizeWord(token.word);
    if (!spoken) continue;
    const end = Math.min(expected.length, next + Math.min(12, Math.max(1, lookahead)));
    for (let index = next; index < end; index++) {
      if (expected[index] === spoken) { observed.add(index); next = index + 1; break; }
    }
  }
  return { observed, cursor: next };
}

/** At most one request + one waiting chunk. Overflow is explicit, never hidden. */
export class ReadingChunkQueue<T> {
  private active = false;
  private pending: T | null = null;
  private cancelled = false;
  private waiters: (() => void)[] = [];
  constructor(private process: (value: T) => Promise<void>, private onError: (error: unknown) => void) {}
  enqueue(value: T): boolean {
    if (this.cancelled || this.pending !== null) return false;
    if (this.active) this.pending = value;
    else { this.active = true; void this.run(value); }
    return true;
  }
  private async run(value: T) {
    try {
      await this.process(value);
      if (this.cancelled) return;
      if (this.pending !== null) { const next = this.pending; this.pending = null; await this.run(next); }
    } catch (error) { this.cancelled = true; this.pending = null; this.onError(error); }
    finally {
      this.active = false;
      if (this.pending === null) { for (const resolve of this.waiters) resolve(); this.waiters = []; }
    }
  }
  idle(): Promise<void> { return this.active ? new Promise((resolve) => this.waiters.push(resolve)) : Promise.resolve(); }
  cancel() { this.cancelled = true; this.pending = null; for (const resolve of this.waiters) resolve(); this.waiters = []; }
}
