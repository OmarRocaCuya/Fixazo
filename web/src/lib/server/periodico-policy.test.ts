import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPeriodicoPolicy, preflightPeriodicoRequest, reservePeriodicoJudge } from "./periodico-policy";
let serial = 0;
function request(headers: Record<string, string> = {}) { return new Request("https://demo.example/api/periodico/responder", { headers: { Origin: "https://demo.example", "X-Forwarded-For": `203.0.113.${serial}`, ...headers } }); }
beforeEach(() => { serial++; vi.stubEnv("PERIODICO_JUDGE_ENABLED", "true"); vi.stubEnv("OPENROUTER_API_KEY", "synthetic-provider-key"); vi.stubEnv("VOICE_ACCESS_CODE", ""); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("periodico private process guard", () => {
  it("requires exact explicit opt-in and a provider key, but no private access code", () => {
    expect(getPeriodicoPolicy()).toEqual({ enabled: true, reason: null });
    vi.stubEnv("PERIODICO_JUDGE_ENABLED", "TRUE"); expect(getPeriodicoPolicy().enabled).toBe(false);
    vi.stubEnv("PERIODICO_JUDGE_ENABLED", "true"); vi.stubEnv("OPENROUTER_API_KEY", ""); expect(getPeriodicoPolicy().reason).toBe("periodico-provider-not-configured");
  });
  it("requires same origin and ignores any access-code header", () => {
    expect(preflightPeriodicoRequest(request())).toBeNull();
    expect(preflightPeriodicoRequest(request({ "X-Voice-Access-Code": "wrong" }))).toBeNull();
    expect(preflightPeriodicoRequest(request({ Origin: "" }))?.status).toBe(403);
    expect(preflightPeriodicoRequest(request({ "sec-fetch-site": "cross-site" }))?.status).toBe(403);
  });
  it("keys the quota by a hashed IP, so another IP keeps its own budget", () => {
    for (let i = 0; i < 200; i++) { const admission = reservePeriodicoJudge(request()); expect(admission.ok).toBe(true); if (admission.ok) admission.release(); }
    expect(reservePeriodicoJudge(request())).toEqual({ ok: false, error: "periodico-rate-limit" });
    const other = reservePeriodicoJudge(request({ "X-Forwarded-For": "198.51.100.250" })); expect(other.ok).toBe(true); if (other.ok) other.release();
  });
  it("expires the bounded quota and makes release idempotent", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 200; i++) { const admission = reservePeriodicoJudge(request()); expect(admission.ok).toBe(true); if (admission.ok) { admission.release(); admission.release(); } }
    expect(reservePeriodicoJudge(request())).toEqual({ ok: false, error: "periodico-rate-limit" });
    vi.advanceTimersByTime(10 * 60 * 1000);
    const fresh = reservePeriodicoJudge(request()); expect(fresh.ok).toBe(true); if (fresh.ok) fresh.release();
  });
});
