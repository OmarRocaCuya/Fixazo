// One authorized answer WAV, held in memory only. No transcript, retry or
// heuristic emotion fallback. The caller displays failures as unavailable.
import type { CloudVoiceAccess } from "@/lib/voice/types";
import { MODEL_LABELS_ES, type EmotionModelResult } from "@/lib/signals/affect";

const LABELS = Object.keys(MODEL_LABELS_ES);
const MODEL = "emotion2vec/emotion2vec_plus_base";
const REVISION = "b318240bfe67db81a8c572ecb37ce9c3759b81c9";
export const EMOTION_TIMEOUT_MS = 45_000;

export class EmotionClientError extends Error {
  constructor(readonly code: string) { super(code); this.name = "EmotionClientError"; }
}

function valid(value: unknown): value is EmotionModelResult & { experimental: true } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const item = (x: unknown): x is EmotionModelResult["top"] => {
    if (!x || typeof x !== "object" || Array.isArray(x)) return false;
    const entry = x as Record<string, unknown>;
    return typeof entry.label === "string" && LABELS.includes(entry.label)
      && typeof entry.score === "number" && Number.isFinite(entry.score) && entry.score >= 0 && entry.score <= 1;
  };
  if (v.experimental !== true || v.model !== MODEL || v.revision !== REVISION || !Array.isArray(v.labels)
    || v.labels.length !== 9 || !v.labels.every(item) || !item(v.top)) return false;
  const labels = v.labels as EmotionModelResult["labels"];
  const top = v.top as EmotionModelResult["top"];
  const sum = labels.reduce((total, entry) => total + entry.score, 0);
  return new Set(labels.map((entry) => entry.label)).size === 9 && Math.abs(sum - 1) <= 0.02
    && labels.some((entry) => entry.label === top.label && Math.abs(entry.score - top.score) < 0.00001)
    && labels.every((entry) => entry.score <= top.score + 0.00001);
}

async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (Number(response.headers.get("Content-Length")) > 16_384) throw new EmotionClientError("invalid-response");
  const reader = response.body?.getReader();
  if (!reader) throw new EmotionClientError("invalid-response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const onAbort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    while (true) {
      const next = await reader.read();
      if (signal.aborted) throw new EmotionClientError("cancelled");
      if (next.done) break;
      size += next.value.length;
      if (size > 16_384) { await reader.cancel(); throw new EmotionClientError("invalid-response"); }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new EmotionClientError("invalid-response"); }
  } finally { signal.removeEventListener("abort", onAbort); reader.releaseLock(); }
}

export async function requestEmotionModel(wav: Uint8Array, access: CloudVoiceAccess, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<EmotionModelResult> {
  if (signal?.aborted) throw new EmotionClientError("cancelled");
  if (!access.accessCode.trim() || !["adult-demo", "approved-pilot"].includes(access.audience)) throw new EmotionClientError("not-authorized");
  if (wav.byteLength < 44 + 32_000 || wav.byteLength > 44 + 480_000) throw new EmotionClientError("invalid-audio");
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, EMOTION_TIMEOUT_MS);
  const form = new FormData();
  form.set("file", new Blob([wav as BlobPart], { type: "audio/wav" }), "turn.wav");
  try {
    const response = await fetcher("/api/emotion", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "X-Voice-Access-Code": access.accessCode }, body: form, signal: controller.signal });
    if (controller.signal.aborted) throw new EmotionClientError("cancelled");
    const body = await readJson(response, controller.signal);
    if (!response.ok) {
      const code = body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : null;
      throw new EmotionClientError(typeof code === "string" && /^[a-z0-9-]{1,80}$/.test(code) ? code : "service-unavailable");
    }
    if (!valid(body)) throw new EmotionClientError("invalid-response");
    return { labels: body.labels.map(({ label, score }) => ({ label, score })), top: { label: body.top.label, score: body.top.score }, model: body.model };
  } catch (error) {
    if (controller.signal.aborted) throw new EmotionClientError(timedOut ? "timeout" : "cancelled");
    if (error instanceof EmotionClientError) throw error;
    throw new EmotionClientError("network");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}
