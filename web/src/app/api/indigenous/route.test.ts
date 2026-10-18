import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const fetcher = vi.fn();
const TOKEN = "never-expose-this-backend-secret-123456";
let serial = 0;
const auth = { audience: "adult-demo" };
function request(body: unknown = { action: "translate", text: "hola", sourceLanguage: "spa_Latn", targetLanguage: "quy_Latn", ...auth }, headers: Record<string, string> = {}) {
  return new Request("https://education.example/api/indigenous", { method: "POST", headers: { Origin: "https://education.example", "Content-Type": "application/json", "X-Voice-Access-Code": process.env.VOICE_ACCESS_CODE ?? "", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}
function wav() {
  const bytes = new Uint8Array(32044); const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
  write(0, "RIFF"); view.setUint32(4, 32036, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, 32000, true); return bytes;
}
beforeEach(() => {
  vi.stubEnv("VOICE_CLOUD_MODE", "adult-demo"); vi.stubEnv("VOICE_ACCESS_CODE", `indigenous-access-${++serial}`);
  vi.stubEnv("INDIGENOUS_BACKEND_URL", "https://indigenous.example"); vi.stubEnv("INDIGENOUS_BACKEND_TOKEN", TOKEN);
  vi.stubEnv("INDIGENOUS_TRANSLATION_RESEARCH_ONLY", "true"); fetcher.mockReset(); vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("indigenous demo route", () => {
  it("reports absent models honestly even with configured credentials", async () => {
    fetcher.mockResolvedValue(Response.json({ asr: { model: "omniASR_LLM_300M_v2", ready: false }, translation: { ready: false, enabled: true } }));
    const response = await GET(new Request("https://education.example/api/indigenous"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    const status = await response.json(); expect(status).toMatchObject({ configured: true, backendReachable: true, asr: { ready: false } });
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });
  it("requires same origin, but no access code, adult attestation or consent, before an inference request", async () => {
    expect((await POST(request(undefined, { Origin: "https://evil.example" }))).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(Response.json({ text: "rimay", sourceLanguage: "spa_Latn", targetLanguage: "quy_Latn", model: "facebook/nllb-200-distilled-600M", researchOnly: true }));
    const response = await POST(request({ action: "translate", text: "hola", sourceLanguage: "spa_Latn", targetLanguage: "quy_Latn" }));
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("fails closed by default without upstream contact", async () => {
    vi.stubEnv("VOICE_CLOUD_MODE", "disabled");
    expect((await POST(request())).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not use an arbitrary request URL or forward access credentials to the backend", async () => {
    fetcher.mockResolvedValue(Response.json({ text: "rimay", sourceLanguage: "spa_Latn", targetLanguage: "quy_Latn", model: "facebook/nllb-200-distilled-600M", researchOnly: true }));
    const response = await POST(request({ action: "translate", text: "hola", sourceLanguage: "spa_Latn", targetLanguage: "quy_Latn", url: "https://evil.example", accessCode: "not-forwarded", ...auth }));
    expect(response.status).toBe(200);
    expect(fetcher.mock.calls[0][0].toString()).toBe("https://indigenous.example/translate");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ text: "hola", sourceLanguage: "spa_Latn", targetLanguage: "quy_Latn" });
    expect(await response.json()).toMatchObject({ researchOnly: true, requiresHumanReview: true });
  });
  it("accepts bounded WAV form data and does not forward the original filename", async () => {
    const form = new FormData(); form.set("action", "transcribe"); form.set("language", "ayr_Latn");
    form.set("file", new Blob([wav() as BlobPart], { type: "audio/wav" }), "child-real-name.wav");
    form.set("audience", "adult-demo");
    fetcher.mockResolvedValue(Response.json({ text: "aruma", language: "ayr_Latn", model: "omniASR_LLM_300M_v2", durationSeconds: 1 }));
    const response = await POST(new Request("https://education.example/api/indigenous", { method: "POST", headers: { Origin: "https://education.example", "X-Voice-Access-Code": process.env.VOICE_ACCESS_CODE ?? "" }, body: form }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ language: "ayr_Latn", durationSeconds: 1, wordTimestamps: false, requiresHumanReview: true });
    expect(((fetcher.mock.calls[0][1].body as FormData).get("file") as File).name).toBe("sample.wav");
  });
  it.each(["{broken", "x".repeat(8193)])("rejects malformed or too-large input without inference", async (body) => {
    expect([400, 413]).toContain((await POST(request(body))).status);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects unsupported content types and unsupported translation variants", async () => {
    expect((await POST(request("raw", { "Content-Type": "audio/webm" }))).status).toBe(415);
    expect((await POST(request({ action: "translate", text: "rimay", sourceLanguage: "quz_Latn", targetLanguage: "spa_Latn", ...auth }))).status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("never returns upstream tokens, tracebacks, or host details on provider errors", async () => {
    fetcher.mockResolvedValue(Response.json({ error: `${TOKEN} backend internals` }, { status: 500 }));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "indigenous-unavailable" });
  });
  it("returns actionable token-limit validation without any upstream details", async () => {
    fetcher.mockResolvedValue(Response.json({ error: "translation-input-exceeds-256-tokens", detail: TOKEN }, { status: 422 }));
    const response = await POST(request({ action: "translate", text: "a ".repeat(700), sourceLanguage: "spa_Latn", targetLanguage: "quy_Latn", ...auth }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "translation-input-exceeds-256-tokens" });
  });
});
