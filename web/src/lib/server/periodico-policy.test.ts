import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPeriodicoPolicy, preflightPeriodicoRequest, reservePeriodicoJudge } from "./periodico-policy";
let serial = 0;
function request(headers: Record<string, string> = {}) { return new Request("https://demo.example/api/periodico/responder", { headers: { Origin: "https://demo.example", "X-Voice-Access-Code": process.env.VOICE_ACCESS_CODE ?? "", ...headers } }); }
beforeEach(() => { vi.stubEnv("PERIODICO_JUDGE_ENABLED", "true"); vi.stubEnv("OPENROUTER_API_KEY", "synthetic-provider-key"); vi.stubEnv("VOICE_ACCESS_CODE", `policy-test-private-code-${++serial}`); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("periodico private process guard", () => {
  it("requires exact explicit opt-in and substantial configured code", () => {
    expect(getPeriodicoPolicy()).toEqual({ enabled: true, reason: null });
    vi.stubEnv("PERIODICO_JUDGE_ENABLED", "TRUE"); expect(getPeriodicoPolicy().enabled).toBe(false);
    vi.stubEnv("PERIODICO_JUDGE_ENABLED", "true"); vi.stubEnv("VOICE_ACCESS_CODE", "short"); expect(getPeriodicoPolicy().reason).toBe("periodico-access-not-configured");
  });
  it("requires same origin and only a header code, including bounded code length", () => {
    expect(preflightPeriodicoRequest(request())).toBeNull();
    expect(preflightPeriodicoRequest(request({ Origin: "" }))?.status).toBe(403);
    expect(preflightPeriodicoRequest(request({ "X-Voice-Access-Code": "x".repeat(257) }))?.status).toBe(401);
  });
  it("expires the bounded quota and makes release idempotent", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 6; i++) { const admission = reservePeriodicoJudge(request()); expect(admission.ok).toBe(true); if (admission.ok) { admission.release(); admission.release(); } }
    expect(reservePeriodicoJudge(request())).toEqual({ ok: false, error: "periodico-rate-limit" });
    vi.advanceTimersByTime(10 * 60 * 1000);
    const fresh = reservePeriodicoJudge(request()); expect(fresh.ok).toBe(true); if (fresh.ok) fresh.release();
  });
});
