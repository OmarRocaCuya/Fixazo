import type { TranscriptionProvenance } from "./types";

const MODELS = {
  manual: "human-entered", "web-speech": "browser-managed", deepgram: "nova-3",
  "local-whisper": "onnx-community/whisper-base_timestamped",
} as const;

/** Strict, field-by-field allowlist shared by reports and paused-session saves. */
export function cleanTranscriptionProvenance(value: unknown): TranscriptionProvenance | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.provider !== "string" || !Object.hasOwn(MODELS, v.provider)) return null;
  const provider = v.provider as TranscriptionProvenance["provider"];
  if (v.model !== MODELS[provider] || !["es", "qu"].includes(String(v.language)) || typeof v.timingsAvailable !== "boolean") return null;
  const normalization = provider === "manual" ? "manual-unverified" : "asr-may-normalize";
  if (v.normalization !== normalization) return null;
  if ((provider === "deepgram" || provider === "local-whisper") && v.language !== "es") return null;
  return { provider, model: MODELS[provider], language: v.language as TranscriptionProvenance["language"],
    timingsAvailable: (provider === "deepgram" || provider === "local-whisper") && v.timingsAvailable, normalization };
}
