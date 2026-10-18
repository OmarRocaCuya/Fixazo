import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeVoiceRequest, getVoicePolicyStatus } from "./voice-policy";

let serial = 0;
const body = { audience: "adult-demo", consent: true, adultConfirmed: true };
function request(headers: Record<string, string> = {}) {
  return new Request("https://education.example/api/asr/session", { method: "POST", headers: { Origin: "https://education.example", "X-Voice-Access-Code": process.env.VOICE_ACCESS_CODE ?? "", ...headers } });
}

beforeEach(() => {
  vi.stubEnv("VOICE_CLOUD_MODE", "adult-demo");
  vi.stubEnv("VOICE_ACCESS_CODE", `demo-access-code-${++serial}`);
  vi.stubEnv("DEEPGRAM_API_KEY", "server-secret");
  vi.stubEnv("OPENAI_API_KEY", "other-server-secret");
  vi.stubEnv("CHILD_VOICE_PRIVACY_APPROVED", "false");
  vi.stubEnv("OPENAI_ZDR_CONFIRMED", "false");
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("cloud voice policy", () => {
  it("defaults to disabled and does not mistake a key for permission", () => {
    vi.stubEnv("VOICE_CLOUD_MODE", "");
    expect(getVoicePolicyStatus("deepgram")).toEqual({ enabled: false, mode: "disabled", reason: "cloud-disabled" });
    expect(authorizeVoiceRequest(request(), body, "deepgram")).toMatchObject({ ok: false, status: 503 });
  });
  it("fails closed without a provider key or a strong shared access code", () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "");
    expect(getVoicePolicyStatus("deepgram").reason).toBe("provider-not-configured");
    vi.stubEnv("VOICE_ACCESS_CODE", "tiny");
    expect(getVoicePolicyStatus("deepgram").reason).toBe("access-not-configured");
  });
  it("requires explicit audience, consent, and adult attestation", () => {
    expect(authorizeVoiceRequest(request(), {}, "deepgram")).toMatchObject({ ok: false, error: "voice-consent-required" });
    expect(authorizeVoiceRequest(request(), { ...body, adultConfirmed: false }, "deepgram")).toMatchObject({ ok: false, error: "adult-demo-only" });
    expect(authorizeVoiceRequest(request(), { ...body, audience: "approved-pilot" }, "deepgram")).toMatchObject({ ok: false, status: 403 });
    expect(authorizeVoiceRequest(request(), body, "deepgram")).toEqual({ ok: true, mode: "adult-demo" });
  });
  it.each<Record<string, string>>([{ Origin: "https://evil.example" }, { Origin: "" }, { "sec-fetch-site": "cross-site" }])("rejects a cross-origin or missing Origin request %j", (headers) => {
    expect(authorizeVoiceRequest(request(headers), body, "deepgram")).toMatchObject({ ok: false, error: "same-origin-required" });
  });
  it("rejects an incorrect secret without reflecting it", () => {
    expect(authorizeVoiceRequest(request({ "X-Voice-Access-Code": "wrong" }), body, "deepgram")).toEqual({ ok: false, status: 401, error: "voice-access-required" });
  });
  it("gates child pilots and separately requires OpenAI ZDR confirmation", () => {
    vi.stubEnv("VOICE_CLOUD_MODE", "approved-pilot");
    expect(getVoicePolicyStatus("deepgram").reason).toBe("privacy-approval-required");
    vi.stubEnv("CHILD_VOICE_PRIVACY_APPROVED", "true");
    expect(getVoicePolicyStatus("deepgram").enabled).toBe(true);
    expect(getVoicePolicyStatus("openai").reason).toBe("provider-privacy-approval-required");
    vi.stubEnv("OPENAI_ZDR_CONFIRMED", "true");
    expect(authorizeVoiceRequest(request(), { audience: "approved-pilot", consent: true }, "openai")).toEqual({ ok: true, mode: "approved-pilot" });
  });
  it("requires an explicit fixed HTTPS backend for Meta, not another provider's key", () => {
    vi.stubEnv("INDIGENOUS_BACKEND_URL", ""); vi.stubEnv("INDIGENOUS_BACKEND_TOKEN", "");
    expect(getVoicePolicyStatus("meta").reason).toBe("provider-not-configured");
    vi.stubEnv("INDIGENOUS_BACKEND_URL", "https://indigenous.example");
    vi.stubEnv("INDIGENOUS_BACKEND_TOKEN", "backend-token-longer-than-thirty-two-chars");
    expect(getVoicePolicyStatus("meta").enabled).toBe(true);
    vi.stubEnv("VOICE_CLOUD_MODE", "approved-pilot");
    expect(getVoicePolicyStatus("meta").reason).toBe("privacy-approval-required");
  });
  it("caps grants even if the caller varies proxy IP headers and resets after ten minutes", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 12; i++) expect(authorizeVoiceRequest(request({ "x-forwarded-for": `1.2.3.${i}` }), body, "deepgram").ok).toBe(true);
    expect(authorizeVoiceRequest(request(), body, "deepgram")).toMatchObject({ status: 429 });
    // Another provider has a separate budget, not an accidentally exhausted TTS.
    expect(authorizeVoiceRequest(request(), body, "openai").ok).toBe(true);
    vi.advanceTimersByTime(600_001);
    expect(authorizeVoiceRequest(request(), body, "deepgram").ok).toBe(true);
  });
  it("bounds Meta guided-reading chunks at 90 requests without changing other provider budgets", () => {
    vi.useFakeTimers();
    vi.stubEnv("INDIGENOUS_BACKEND_URL", "https://indigenous.example");
    vi.stubEnv("INDIGENOUS_BACKEND_TOKEN", "backend-token-longer-than-thirty-two-chars");
    for (let i = 0; i < 90; i++) expect(authorizeVoiceRequest(request(), body, "meta").ok).toBe(true);
    expect(authorizeVoiceRequest(request(), body, "meta")).toMatchObject({ ok: false, status: 429 });
    for (let i = 0; i < 12; i++) expect(authorizeVoiceRequest(request(), body, "deepgram").ok).toBe(true);
    expect(authorizeVoiceRequest(request(), body, "deepgram")).toMatchObject({ status: 429 });
    for (let i = 0; i < 30; i++) expect(authorizeVoiceRequest(request(), body, "openai").ok).toBe(true);
    expect(authorizeVoiceRequest(request(), body, "openai")).toMatchObject({ status: 429 });
    vi.advanceTimersByTime(600_001);
    expect(authorizeVoiceRequest(request(), body, "meta").ok).toBe(true);
  });
});
