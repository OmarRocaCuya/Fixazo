import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeVoiceRequest, getIndigenousBackendConfig, getVoicePolicyStatus } from "./voice-policy";

let serial = 0;
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
    expect(authorizeVoiceRequest(request(), "deepgram")).toMatchObject({ ok: false, status: 503 });
  });
  it("fails closed without a provider key or a strong shared access code", () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "");
    expect(getVoicePolicyStatus("deepgram").reason).toBe("provider-not-configured");
    vi.stubEnv("VOICE_ACCESS_CODE", "tiny");
    expect(getVoicePolicyStatus("deepgram").reason).toBe("access-not-configured");
  });
  it("authorizes with the operator access code alone, without any adult or guardian attestation", () => {
    expect(authorizeVoiceRequest(request(), "deepgram")).toEqual({ ok: true, mode: "adult-demo" });
    expect(authorizeVoiceRequest(request(), "meta")).toMatchObject({ ok: false, status: 503 });
  });
  it.each<Record<string, string>>([{ Origin: "https://evil.example" }, { Origin: "" }, { "sec-fetch-site": "cross-site" }])("rejects a cross-origin or missing Origin request %j", (headers) => {
    expect(authorizeVoiceRequest(request(headers), "deepgram")).toMatchObject({ ok: false, error: "same-origin-required" });
  });
  it("rejects an incorrect secret without reflecting it", () => {
    expect(authorizeVoiceRequest(request({ "X-Voice-Access-Code": "wrong" }), "deepgram")).toEqual({ ok: false, status: 401, error: "voice-access-required" });
  });
  it("gates child pilots and separately requires OpenAI ZDR confirmation", () => {
    vi.stubEnv("VOICE_CLOUD_MODE", "approved-pilot");
    expect(getVoicePolicyStatus("deepgram").reason).toBe("privacy-approval-required");
    vi.stubEnv("CHILD_VOICE_PRIVACY_APPROVED", "true");
    expect(getVoicePolicyStatus("deepgram").enabled).toBe(true);
    expect(getVoicePolicyStatus("openai").reason).toBe("provider-privacy-approval-required");
    vi.stubEnv("OPENAI_ZDR_CONFIRMED", "true");
    expect(authorizeVoiceRequest(request(), "openai")).toEqual({ ok: true, mode: "approved-pilot" });
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
  it("allows only explicitly opted-in exact loopback during development", () => {
    vi.stubEnv("INDIGENOUS_BACKEND_TOKEN", "backend-token-longer-than-thirty-two-chars");
    vi.stubEnv("INDIGENOUS_BACKEND_URL", "http://127.0.0.1:18080/");
    vi.stubEnv("NODE_ENV", "development");
    expect(getIndigenousBackendConfig()).toBeNull();
    vi.stubEnv("INDIGENOUS_ALLOW_LOOPBACK", "true");
    expect(getIndigenousBackendConfig()?.baseUrl.toString()).toBe("http://127.0.0.1:18080/");
    for (const url of ["http://localhost:18080/", "http://127.0.0.2:18080/", "http://127.0.0.1/", "http://127.0.0.1:18080/private/", "http://127.0.0.1:18080/?x=1", "http://x:y@127.0.0.1:18080/", "http://2130706433:18080/", "http://192.168.1.2:18080/"]) {
      vi.stubEnv("INDIGENOUS_BACKEND_URL", url);
      expect(getIndigenousBackendConfig()).toBeNull();
    }
    vi.stubEnv("INDIGENOUS_BACKEND_URL", "http://127.0.0.1:18080/");
    for (const mode of ["production", "test"]) {
      vi.stubEnv("NODE_ENV", mode);
      expect(getIndigenousBackendConfig()).toBeNull();
    }
  });
  it("caps grants even if the caller varies proxy IP headers and resets after ten minutes", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 12; i++) expect(authorizeVoiceRequest(request({ "x-forwarded-for": `1.2.3.${i}` }), "deepgram").ok).toBe(true);
    expect(authorizeVoiceRequest(request(), "deepgram")).toMatchObject({ status: 429 });
    // Another provider has a separate budget, not an accidentally exhausted TTS.
    expect(authorizeVoiceRequest(request(), "openai").ok).toBe(true);
    vi.advanceTimersByTime(600_001);
    expect(authorizeVoiceRequest(request(), "deepgram").ok).toBe(true);
  });
  it("bounds Meta guided-reading chunks at 90 requests without changing other provider budgets", () => {
    vi.useFakeTimers();
    vi.stubEnv("INDIGENOUS_BACKEND_URL", "https://indigenous.example");
    vi.stubEnv("INDIGENOUS_BACKEND_TOKEN", "backend-token-longer-than-thirty-two-chars");
    for (let i = 0; i < 90; i++) expect(authorizeVoiceRequest(request(), "meta").ok).toBe(true);
    expect(authorizeVoiceRequest(request(), "meta")).toMatchObject({ ok: false, status: 429 });
    for (let i = 0; i < 12; i++) expect(authorizeVoiceRequest(request(), "deepgram").ok).toBe(true);
    expect(authorizeVoiceRequest(request(), "deepgram")).toMatchObject({ status: 429 });
    for (let i = 0; i < 30; i++) expect(authorizeVoiceRequest(request(), "openai").ok).toBe(true);
    expect(authorizeVoiceRequest(request(), "openai")).toMatchObject({ status: 429 });
    vi.advanceTimersByTime(600_001);
    expect(authorizeVoiceRequest(request(), "meta").ok).toBe(true);
  });
});
