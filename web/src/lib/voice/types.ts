/** No audio, credentials, speaker identity or inferred emotions belong in these types. */
export type VoiceCloudMode = "disabled" | "adult-demo" | "approved-pilot";
export type VoiceAudience = Exclude<VoiceCloudMode, "disabled">;
export type VoiceProvider = "deepgram" | "openai" | "meta";

export interface VoicePolicyStatus {
  enabled: boolean;
  mode: VoiceCloudMode;
  reason: string | null;
}

/** A short-lived, in-memory permission; never put accessCode in localStorage. */
export interface CloudVoiceAccess {
  accessCode: string;
  audience: VoiceAudience;
  consent: true;
  adultConfirmed?: boolean;
}

export interface AsrWordTiming {
  word: string;
  start: number;
  end: number;
  /** ASR confidence is not a reading score or evidence about the child. */
  confidence: number | null;
}

export interface AsrResult {
  text: string;
  isFinal: boolean;
  words: AsrWordTiming[];
  provider: "deepgram" | "local-whisper" | "web-speech";
  model: string;
  language: string;
}
