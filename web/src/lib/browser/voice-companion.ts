"use client";

import { useSyncExternalStore } from "react";

export type CompanionEmotion = "idle" | "happy" | "sad" | "surprised" | "concerned";
export type CompanionValidation = "thinking" | "success" | "retry";
export type CompanionExpression = CompanionEmotion | CompanionValidation | "listening";
export interface CompanionSnapshot {
  readonly active: boolean;
  /** Normalized amplitude from the existing microphone stream, never stored. */
  readonly level: number;
  readonly emotion: CompanionEmotion | null;
  /** Real answer validation, independent from voice emotion or loudness. */
  readonly validation: CompanionValidation | null;
}

const INITIAL: CompanionSnapshot = Object.freeze({ active: false, level: 0, emotion: null, validation: null });
const listeners = new Set<() => void>();
let snapshot: CompanionSnapshot = INITIAL;
let emotionExpiry: ReturnType<typeof setTimeout> | undefined;
let validationExpiry: ReturnType<typeof setTimeout> | undefined;
export const COMPANION_EMOTION_DURATION_MS = 12_000;
export const COMPANION_VALIDATION_DURATION_MS = 5_000;

/** Only known AUDIO-model labels are accepted. Text and volume do not infer emotion. */
export function companionEmotion(label: string | null): CompanionEmotion | null {
  switch (label?.trim().toLowerCase()) {
    case "happy": case "contento/a": return "happy";
    case "sad": case "triste": return "sad";
    case "surprised": case "sorprendido/a": return "surprised";
    case "angry": case "disgusted": case "fearful":
    case "enojado/a": case "disgustado/a": case "con miedo": return "concerned";
    case "neutral": return "idle";
    default: return null;
  }
}

function emit(next: CompanionSnapshot) {
  if (snapshot.active === next.active && snapshot.level === next.level && snapshot.emotion === next.emotion && snapshot.validation === next.validation) return;
  snapshot = Object.freeze(next);
  for (const listener of listeners) listener();
}

/** Call from existing capture lifecycle only; this never opens a microphone. */
export function publishCompanionAudio(active: boolean, level: number) {
  const starting = active && !snapshot.active;
  if (starting) { clearTimeout(emotionExpiry); clearTimeout(validationExpiry); }
  // Quantization avoids rerendering every PCM sample without inventing activity.
  const normalized = active && Number.isFinite(level) ? Math.round(Math.max(0, Math.min(1, level)) * 50) / 50 : 0;
  emit({ active, level: normalized, emotion: starting ? null : snapshot.emotion, validation: starting ? null : snapshot.validation });
}

/** Only call for a genuine quiz evaluation lifecycle, never an emotion result. */
export function publishCompanionValidation(validation: CompanionValidation | null) {
  clearTimeout(validationExpiry);
  emit({ ...snapshot, validation });
  if (validation !== null && validation !== "thinking") {
    validationExpiry = setTimeout(() => emit({ ...snapshot, validation: null }), COMPANION_VALIDATION_DURATION_MS);
  }
}

/** Cancellation/hidden/navigation clears all ephemeral reactions, never restarts capture. */
export function resetVoiceCompanion() {
  clearTimeout(emotionExpiry); clearTimeout(validationExpiry);
  emit(INITIAL);
}

/** Live PCM changes the speaking pose immediately, before any ASR/model response. */
export function companionExpression(state: CompanionSnapshot): CompanionExpression {
  if (state.validation) return state.validation;
  if (state.active && state.level > 0.04 && (!state.emotion || state.emotion === "idle")) return "listening";
  return state.emotion ?? "idle";
}

/** Caller must first check the existing request epoch/abort guard. No transport side effects. */
export function publishCompanionEmotion(label: string | null) {
  clearTimeout(emotionExpiry);
  const emotion = companionEmotion(label);
  emit({ ...snapshot, emotion });
  if (emotion !== null) {
    emotionExpiry = setTimeout(() => emit({ ...snapshot, emotion: null }), COMPANION_EMOTION_DURATION_MS);
  }
}

export function getCompanionSnapshot(): CompanionSnapshot { return snapshot; }
export function getCompanionServerSnapshot(): CompanionSnapshot { return INITIAL; }
export function subscribeCompanion(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useVoiceCompanion() {
  return useSyncExternalStore(subscribeCompanion, getCompanionSnapshot, getCompanionServerSnapshot);
}
