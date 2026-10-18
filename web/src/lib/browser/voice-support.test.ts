import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getVoiceSupport, voiceErrorMessage } from "./voice-support";

const getUserMedia = vi.fn();

beforeEach(() => {
  getUserMedia.mockClear();
  vi.stubGlobal("window", { isSecureContext: true, SpeechRecognition: class {} });
  vi.stubGlobal("navigator", { userAgent: "Chrome/131", mediaDevices: { getUserMedia } });
});

afterEach(() => vi.unstubAllGlobals());

describe("getVoiceSupport", () => {
  it("checks prerequisites without asking for microphone permission", () => {
    expect(getVoiceSupport("es")).toMatchObject({ canRecord: true, canTranscribe: true, reason: "ready", browser: "other" });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(getVoiceSupport("es").message).toContain("proveedor externo");
  });

  it("distinguishes microphone capture from absent recognition in Opera", () => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Chrome/131 OPR/115.0", mediaDevices: { getUserMedia } });
    expect(getVoiceSupport("es")).toMatchObject({ canRecord: true, canTranscribe: false, reason: "recognition-unavailable", browser: "opera" });
    expect(getVoiceSupport("es").message).toContain("no necesitas cambiar a celular");
  });

  it("does not block Opera solely by user agent or promise that its service works", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 OPR/115.0", mediaDevices: { getUserMedia } });
    expect(getVoiceSupport("es")).toMatchObject({ canRecord: true, canTranscribe: true, reason: "ready", browser: "opera" });
    expect(getVoiceSupport("es").message).toContain("no garantiza");
    expect(getVoiceSupport("es").message).toContain("proveedor externo");
  });

  it("offers manual Quechua transcription while preserving microphone capability", () => {
    expect(getVoiceSupport("qu")).toMatchObject({ canRecord: true, canTranscribe: false, reason: "quechua-unavailable" });
    expect(getVoiceSupport("qu").message).toContain("sin traducir ni corregir");
  });

  it("explains insecure mobile LAN access rather than suggesting a phone fixes it", () => {
    vi.stubGlobal("window", { isSecureContext: false, SpeechRecognition: class {} });
    expect(getVoiceSupport("es")).toMatchObject({ canRecord: false, canTranscribe: false, reason: "insecure-context" });
    expect(getVoiceSupport("es").message).toContain("IP local con HTTP no basta");
  });

  it("detects missing microphone APIs even if recognition exists", () => {
    vi.stubGlobal("navigator", { userAgent: "Firefox/131" });
    expect(getVoiceSupport("es")).toMatchObject({ canRecord: false, canTranscribe: false, reason: "microphone-unavailable" });
  });

  it("is safe during server rendering", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);
    expect(getVoiceSupport("es")).toMatchObject({ canRecord: false, canTranscribe: false });
  });
});

describe("voiceErrorMessage", () => {
  it.each(["network", "not-allowed", "service-not-allowed", "no-speech", "audio-capture", "unsupported", "aborted", "recognition-ended", "start-failed"])("gives an actionable alternative for %s", (code) => {
    expect(voiceErrorMessage(code)).toMatch(/escrib/);
  });

  it("does not claim a phone fixes network errors or classify the child's speech", () => {
    expect(voiceErrorMessage("network")).toContain("No es necesario cambiar a celular");
    expect(voiceErrorMessage("no-speech")).toContain("no evalúa cómo habla el niño");
    expect(voiceErrorMessage("language-not-supported")).toContain("manual");
  });
});
