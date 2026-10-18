import { createHash, timingSafeEqual } from "node:crypto";
import { GUIDED_READING_OPENING, guidedReadingReply, READING_LANGUAGES, type ReadingLanguage } from "@/lib/reading-dialogue";
import { getIndigenousCapabilities, IndigenousProxyError, readIndigenousBody, translateIndigenousText, validateIndigenousWav } from "./indigenous-proxy";
import { getIndigenousBackendConfig, getVoicePolicyStatus } from "./voice-policy";

const CTC_MODEL = "omniASR_CTC_300M_v2";
const TIMING_METHOD = "ctc-greedy-frames";
const SPEECH_MODELS = { quy_Latn: "facebook/mms-tts-quy", ayr_Latn: "facebook/mms-tts-ayr" } as const;
const SPEECH_LANGUAGES = ["quy_Latn", "ayr_Latn"] as const;
const AUDIO_MAX_BYTES = 2_000_000;
const MAX_JSON_BYTES = 65_536;

export class ReadingVoiceError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Reject unauthorized uploads before buffering; full consent and rate-limit
 * authorization still runs against the actual body in the route handler. */
export function preflightReadingRequest(request: Request): void {
  const policy = getVoicePolicyStatus("meta");
  if (!policy.enabled) throw new ReadingVoiceError(policy.reason ?? "cloud-disabled", 503);
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ReadingVoiceError("same-origin-required", 403);
  }
  const code = request.headers.get("x-voice-access-code") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (code.length > 256 || !timingSafeEqual(digest(code), digest(process.env.VOICE_ACCESS_CODE ?? ""))) {
    throw new ReadingVoiceError("voice-access-required", 401);
  }
}

const SAFE_ERRORS: Record<string, { upstream: number; status: number; code: string }> = {
  "model-busy": { upstream: 503, status: 503, code: "indigenous-busy" },
  "timed-asr-unavailable": { upstream: 503, status: 503, code: "reading-timed-asr-required" },
  "timed-audio-duration-invalid": { upstream: 422, status: 422, code: "reading-audio-too-long" },
  "no-audio-signal": { upstream: 422, status: 422, code: "audio-not-observable" },
  "no-observable-transcript": { upstream: 422, status: 422, code: "asr-not-observable" },
  "audio-duration-invalid": { upstream: 422, status: 422, code: "audio-duration-invalid" },
  "asr-model-unavailable": { upstream: 503, status: 503, code: "backend-not-ready" },
  "research-tts-disabled": { upstream: 403, status: 503, code: "reading-speech-disabled" },
  "unsupported-speech-language": { upstream: 422, status: 422, code: "reading-speech-language-unsupported" },
  "speech-text-too-long-or-empty": { upstream: 422, status: 422, code: "reading-speech-text-invalid" },
  "speech-input-exceeds-256-tokens": { upstream: 422, status: 422, code: "speech-input-exceeds-256-tokens" },
  "speech-input-exceeds-768-tokens": { upstream: 422, status: 422, code: "speech-input-exceeds-768-tokens" },
  "tts-model-unavailable": { upstream: 503, status: 503, code: "backend-not-ready" },
  "tts-inference-failed": { upstream: 503, status: 503, code: "reading-speech-unavailable" },
  "speech-output-too-long": { upstream: 503, status: 503, code: "reading-speech-output-invalid" },
  "dialogue-disabled": { upstream: 403, status: 503, code: "reading-dialogue-unavailable" },
  "invalid-dialogue-request": { upstream: 422, status: 422, code: "invalid-reading-history" },
  "dialogue-context-too-long": { upstream: 422, status: 422, code: "reading-dialogue-context-too-long" },
  "dialogue-model-unavailable": { upstream: 503, status: 503, code: "reading-dialogue-unavailable" },
  "dialogue-inference-failed": { upstream: 503, status: 503, code: "reading-dialogue-unavailable" },
  "dialogue-reply-too-long": { upstream: 503, status: 503, code: "reading-reply-too-long" },
};

async function readingBackend<T>(path: "health" | "speak" | "transcribe-timed" | "dialogue", init: RequestInit, consume: (response: Response) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const config = getIndigenousBackendConfig();
  if (!config) throw new ReadingVoiceError("indigenous-not-configured", 503);
  const abort = new AbortController();
  const cancel = () => abort.abort();
  const timer = setTimeout(cancel, path === "health" ? 3000 : 45_000);
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    if (signal?.aborted) throw new Error("aborted");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${config.token}`);
    const response = await fetch(new URL(path, config.baseUrl), { ...init, headers, cache: "no-store", redirect: "error", signal: abort.signal });
    if (!response.ok) {
      let code: unknown;
      try { code = object(JSON.parse(new TextDecoder().decode(await readIndigenousBody(response.body, MAX_JSON_BYTES)))).error; } catch { /* redacted */ }
      const safe = typeof code === "string" && Object.hasOwn(SAFE_ERRORS, code) ? SAFE_ERRORS[code] : null;
      if (safe && safe.upstream === response.status) throw new ReadingVoiceError(safe.code, safe.status);
      throw new ReadingVoiceError(response.status === 429 ? "indigenous-busy" : "reading-unavailable", response.status === 429 ? 429 : 502);
    }
    return await consume(response);
  } catch (error) {
    if (error instanceof ReadingVoiceError) throw error;
    throw new ReadingVoiceError("reading-unavailable", 502);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

async function backendJson(path: "health" | "transcribe-timed" | "dialogue", init: RequestInit = {}, signal?: AbortSignal) {
  return readingBackend(path, init, async (response) => object(JSON.parse(new TextDecoder().decode(await readIndigenousBody(response.body, MAX_JSON_BYTES)))), signal);
}

function dialogueStatus(value: unknown) {
  const raw = object(value);
  const model = typeof raw.model === "string" && /^[a-zA-Z0-9_./:@-]{1,180}$/u.test(raw.model) ? raw.model : null;
  const enabled = raw.enabled === true;
  return { enabled, ready: enabled && model !== null && raw.ready === true, model };
}

export async function getReadingCapabilities(signal?: AbortSignal) {
  const base = await getIndigenousCapabilities(signal);
  let timedSupported = false;
  let timedReady = false;
  let asrLanguages: string[] = [];
  let speechEnabled = false;
  const speechReady = { quy_Latn: false, ayr_Latn: false };
  const speechModels: Partial<Record<typeof SPEECH_LANGUAGES[number], string>> = {};
  let speechLanguages: string[] = [];
  let dialogue = dialogueStatus(undefined);
  if (base.enabled && base.backendReachable) {
    try {
      const health = await backendJson("health", {}, signal);
      const asr = object(health.asr);
      const speech = object(health.speech);
      dialogue = dialogueStatus(health.dialogue);
      const ready = object(speech.ready);
      const models = object(speech.models);
      const announcedAsrLanguages = Array.isArray(asr.languages) ? asr.languages : [];
      asrLanguages = READING_LANGUAGES.filter((lang) => announcedAsrLanguages.includes(lang));
      timedSupported = asr.model === CTC_MODEL && asr.wordTimestamps === true && asr.timingMethod === TIMING_METHOD && asrLanguages.length > 0;
      timedReady = timedSupported && asr.ready === true;
      const announcedSpeechLanguages = Array.isArray(speech.languages) ? speech.languages : [];
      speechLanguages = SPEECH_LANGUAGES.filter((lang) => announcedSpeechLanguages.includes(lang) && models[lang] === SPEECH_MODELS[lang]);
      speechEnabled = speech.enabled === true && speech.researchOnly === true && speechLanguages.length > 0;
      for (const lang of speechLanguages as (typeof SPEECH_LANGUAGES[number])[]) {
        speechModels[lang] = SPEECH_MODELS[lang];
        speechReady[lang] = speechEnabled && ready[lang] === true;
      }
    } catch { /* configuration never implies model readiness or timing support */ }
  }
  const languages = speechLanguages.filter((lang) => asrLanguages.includes(lang) && base.translation.languages.includes(lang as "spa_Latn" | "quy_Latn" | "ayr_Latn"));
  const validDialogue = !dialogue.enabled || dialogue.model !== null;
  const enabled = base.enabled && base.backendReachable && timedReady && speechEnabled && base.translation.enabled && base.translation.ready && languages.length > 0 && validDialogue;
  return {
    ...base, enabled,
    reason: !base.enabled ? base.reason : !base.backendReachable ? "reading-backend-unavailable" : !timedSupported ? "reading-timed-asr-required" : !timedReady ? "reading-backend-not-ready" : !speechEnabled ? "reading-speech-unavailable" : !base.translation.enabled ? "translation-research-mode-required" : !base.translation.ready ? "reading-backend-not-ready" : languages.length === 0 ? "unsupported-language" : !validDialogue ? "reading-dialogue-unavailable" : null,
    languages, adultOnly: true, dialogueMode: dialogue.enabled ? "local-llm-reading" as const : "guided-reading" as const, dialogue,
    asr: { ...base.asr, model: timedSupported ? CTC_MODEL : base.asr.model, languages: asrLanguages, ready: timedReady, wordTimestamps: timedSupported, timingMethod: timedSupported ? TIMING_METHOD : null },
    speech: { enabled: speechEnabled, ready: speechReady, models: speechModels, languages: speechLanguages, researchOnly: true },
    limits: { ...base.limits, audioChunkSeconds: 15, speechTextCharacters: 300, turns: 9 },
    limitations: [dialogue.enabled ? "local-llm-may-hallucinate" : "guided-not-general-conversation", "ctc-frame-times-not-validated-reading-scores", "research-noncommercial-only", "not-validated-for-children", "no-emotion-inference"],
  };
}

export function readingLanguage(value: unknown): ReadingLanguage {
  if (typeof value !== "string" || !(READING_LANGUAGES as readonly string[]).includes(value)) throw new ReadingVoiceError("unsupported-language", 422);
  return value as ReadingLanguage;
}

function text(value: unknown, max: number, code: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ReadingVoiceError(code, 422);
  return value.trim();
}

export interface ReadingHistoryMessage { role: "user" | "assistant"; text: string }

function readingHistory(value: unknown): ReadingHistoryMessage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 6) throw new ReadingVoiceError("invalid-reading-history", 422);
  const history: ReadingHistoryMessage[] = [];
  let total = 0;
  for (const entry of value) {
    const message = object(entry);
    if (message.role !== "user" && message.role !== "assistant") throw new ReadingVoiceError("invalid-reading-history", 422);
    const content = text(message.text, 600, "invalid-reading-history");
    total += content.length;
    if (total > 2500) throw new ReadingVoiceError("invalid-reading-history", 422);
    // No caller-controlled system role, extra properties or model selection.
    history.push({ role: message.role, text: content });
  }
  return history;
}

async function toNative(spanish: string, language: ReadingLanguage, signal?: AbortSignal): Promise<string> {
  if (language === "spa_Latn") return spanish;
  return (await translateIndigenousText(spanish, "spa_Latn", language, signal)).text;
}

export async function prepareGuidedReading(passageValue: unknown, languageValue: unknown, signal?: AbortSignal) {
  const passageSpanish = text(passageValue, 1500, "invalid-reading-passage");
  const language = readingLanguage(languageValue);
  const passage = await toNative(passageSpanish, language, signal);
  const opening = await toNative(GUIDED_READING_OPENING, language, signal);
  if (opening.length > 300) throw new ReadingVoiceError("reading-reply-too-long", 422);
  return { passage, opening, dialogueMode: "guided-reading" as const, requiresHumanReview: true };
}

export async function guidedReadingTurn(passageValue: unknown, heardValue: unknown, languageValue: unknown, turnValue: unknown, signal?: AbortSignal, historyValue?: unknown) {
  const passage = text(passageValue, 1500, "invalid-reading-passage");
  const heard = text(heardValue, 1500, "invalid-reading-heard");
  const language = readingLanguage(languageValue);
  if (typeof turnValue !== "number" || !Number.isInteger(turnValue) || turnValue < 0 || turnValue > 8) throw new ReadingVoiceError("invalid-reading-turn", 422);
  const history = readingHistory(historyValue);
  const heardSpanish = language === "spa_Latn" ? heard : (await translateIndigenousText(heard, language, "spa_Latn", signal)).text;
  if (heardSpanish.length > 1500) throw new ReadingVoiceError("invalid-reading-heard", 422);
  const health = await backendJson("health", {}, signal);
  const dialogue = dialogueStatus(health.dialogue);
  let replySpanish: string;
  let mode: "guided-reading" | "local-llm-reading";
  let model: string | null = null;
  if (dialogue.enabled) {
    if (!dialogue.model) throw new ReadingVoiceError("reading-dialogue-unavailable", 503);
    const generated = await backendJson("dialogue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passage, heardSpanish, history }) }, signal);
    if (generated.dialogueMode !== "local-llm-reading" || generated.model !== dialogue.model || generated.requiresHumanReview !== true) throw new ReadingVoiceError("reading-dialogue-unavailable", 502);
    replySpanish = text(generated.replySpanish, 300, "reading-reply-too-long");
    mode = "local-llm-reading";
    model = dialogue.model;
  } else {
    replySpanish = guidedReadingReply(passage, heardSpanish, turnValue).replySpanish;
    mode = "guided-reading";
  }
  const replyText = await toNative(replySpanish, language, signal);
  if (replyText.length > 300) throw new ReadingVoiceError("reading-reply-too-long", 422);
  return { heardSpanish, replyText, replySpanish, dialogueMode: mode, model, requiresHumanReview: true };
}

export interface ReadingTimedWord { word: string; start: number; end: number; confidence: number | null }

export async function transcribeTimedReading(file: Blob, languageValue: unknown, signal?: AbortSignal) {
  const language = readingLanguage(languageValue);
  if (file.size > 1_000_000) throw new ReadingVoiceError("request-too-large", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const duration = validateIndigenousWav(bytes);
  if (duration > 15) throw new ReadingVoiceError("reading-audio-too-long", 422);
  const form = new FormData();
  form.set("file", new Blob([bytes as BlobPart], { type: "audio/wav" }), "reading.wav");
  form.set("language", language);
  const response = await backendJson("transcribe-timed", { method: "POST", body: form }, signal);
  const fail = () => { throw new ReadingVoiceError("reading-invalid-timing-response", 502); };
  if (response.model !== CTC_MODEL || response.language !== language || response.wordTimestamps !== true || response.timingMethod !== TIMING_METHOD
    || response.languageConditioned !== false || typeof response.durationSeconds !== "number" || !Number.isFinite(response.durationSeconds)
    || Math.abs(response.durationSeconds - duration) > 0.001 || typeof response.text !== "string" || !response.text.trim() || response.text.length > 8000
    || !Array.isArray(response.words) || response.words.length === 0 || response.words.length > 512) return fail();
  const words: ReadingTimedWord[] = [];
  let previousEnd = 0;
  for (const value of response.words) {
    const word = object(value);
    if (typeof word.word !== "string" || !word.word.trim() || word.word.length > 120 || /\s/u.test(word.word)
      || typeof word.start !== "number" || !Number.isFinite(word.start) || word.start < previousEnd - 1e-6 || word.start < 0
      || typeof word.end !== "number" || !Number.isFinite(word.end) || word.end <= word.start || word.end > duration + 1e-6
      || (word.confidence != null && (typeof word.confidence !== "number" || !Number.isFinite(word.confidence) || word.confidence < 0 || word.confidence > 1))) return fail();
    words.push({ word: word.word, start: word.start, end: word.end, confidence: typeof word.confidence === "number" ? word.confidence : null });
    previousEnd = word.end;
  }
  const recognized = response.text.trim().replace(/\s+/gu, " ");
  if (recognized !== words.map((word) => word.word).join(" ")) return fail();
  return { text: recognized, language, model: CTC_MODEL, durationSeconds: duration, words, wordTimestamps: true, timingMethod: TIMING_METHOD, languageConditioned: false, requiresHumanReview: true };
}

/** Validate returned speech independently of Content-Type; never accept a JSON
 * error disguised as WAV, a fake duration, or non-PCM compressed data. */
export function validateReadingSpeechWav(bytes: Uint8Array): number {
  const fail = () => { throw new ReadingVoiceError("reading-speech-output-invalid", 502); };
  if (bytes.byteLength < 44 || bytes.byteLength > AUDIO_MAX_BYTES) return fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || view.getUint32(4, true) + 8 !== bytes.byteLength) return fail();
  let rate = 0; let dataSize = 0; let data = false; let offset = 12;
  for (; offset + 8 <= bytes.byteLength;) {
    const size = view.getUint32(offset + 4, true); const start = offset + 8;
    if (start + size > bytes.byteLength) return fail();
    if (tag(offset) === "fmt ") {
      if (rate || size < 16 || view.getUint16(start, true) !== 1 || view.getUint16(start + 2, true) !== 1 || view.getUint16(start + 14, true) !== 16) return fail();
      rate = view.getUint32(start + 4, true);
      if (rate < 8000 || rate > 48000 || view.getUint32(start + 8, true) !== rate * 2 || view.getUint16(start + 12, true) !== 2) return fail();
    } else if (tag(offset) === "data") {
      if (data || size % 2) return fail();
      data = true; dataSize = size;
    }
    offset = start + size + size % 2;
  }
  const duration = dataSize / (rate * 2);
  if (offset !== bytes.byteLength || !data || !Number.isFinite(duration) || duration <= 0 || duration > 30) return fail();
  return duration;
}

export async function speakGuidedReading(textValue: unknown, languageValue: unknown, signal?: AbortSignal): Promise<Uint8Array> {
  const value = text(textValue, 300, "reading-speech-text-invalid");
  const language = readingLanguage(languageValue);
  if (!(SPEECH_LANGUAGES as readonly string[]).includes(language)) throw new ReadingVoiceError("reading-speech-language-unsupported", 422);
  return readingBackend("speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value, language }) }, async (response) => {
    if (!response.headers.get("content-type")?.toLowerCase().startsWith("audio/wav")) throw new ReadingVoiceError("reading-speech-output-invalid", 502);
    const bytes = await readIndigenousBody(response.body, AUDIO_MAX_BYTES);
    const duration = validateReadingSpeechWav(bytes);
    const durationHeader = response.headers.get("x-speech-duration");
    const reportedDuration = durationHeader?.trim() ? Number(durationHeader) : NaN;
    if (response.headers.get("x-speech-model") !== SPEECH_MODELS[language as typeof SPEECH_LANGUAGES[number]]
      || response.headers.get("x-speech-language") !== language || response.headers.get("x-speech-research-only") !== "true"
      || !Number.isFinite(reportedDuration) || Math.abs(reportedDuration - duration) > 0.001) throw new ReadingVoiceError("reading-speech-output-invalid", 502);
    return bytes;
  }, signal);
}

/** Existing translation/audio validation errors are also fixed, safe codes. */
export function readingError(error: unknown): { error: string; status: number } {
  if (error instanceof ReadingVoiceError || error instanceof IndigenousProxyError) return { error: error.code, status: error.status };
  return { error: "reading-unavailable", status: 502 };
}
