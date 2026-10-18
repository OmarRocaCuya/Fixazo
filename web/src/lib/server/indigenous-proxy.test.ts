import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getIndigenousCapabilities, readIndigenousBody, transcribeIndigenousAudio, translateIndigenousText, validateIndigenousWav } from "./indigenous-proxy";
import { getIndigenousBackendConfig } from "./voice-policy";

const fetcher = vi.fn();
const TOKEN = "backend-token-never-send-to-browser-12345";
function wav(seconds = 1, sampleRate = 16000, channels = 1, bits = 16) {
  const dataSize = Math.round(seconds * sampleRate * channels * bits / 8);
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const tag = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
  tag(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); tag(8, "WAVE"); tag(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bits / 8, true); view.setUint16(32, channels * bits / 8, true); view.setUint16(34, bits, true);
  tag(36, "data"); view.setUint32(40, dataSize, true);
  return bytes;
}
const health = (ready = true) => ({ configured: true, asr: { ready, loading: !ready, model: "omniASR_LLM_300M_v2" }, translation: { enabled: true, ready, model: "facebook/nllb-200-distilled-600M", researchOnly: true } });
beforeEach(() => {
  vi.stubEnv("VOICE_CLOUD_MODE", "adult-demo");
  vi.stubEnv("VOICE_ACCESS_CODE", "shared-private-pilot-code");
  vi.stubEnv("INDIGENOUS_BACKEND_URL", "https://indigenous.example/service");
  vi.stubEnv("INDIGENOUS_BACKEND_TOKEN", TOKEN);
  vi.stubEnv("INDIGENOUS_TRANSLATION_RESEARCH_ONLY", "true");
  fetcher.mockReset(); vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("fixed indigenous backend destination", () => {
  it.each(["http://indigenous.example", "https://localhost", "https://localhost.", "https://127.0.0.1", "https://10.0.0.1", "https://169.254.169.254", "https://192.168.0.1", "https://172.16.0.1", "https://[::1]", "https://foo.local", "https://user:password@indigenous.example", "https://indigenous.example/?url=evil", "not-a-url"])("fails closed for unsafe destination %s", (url) => {
    vi.stubEnv("INDIGENOUS_BACKEND_URL", url);
    expect(getIndigenousBackendConfig()).toBeNull();
  });
  it("keeps configuration distinct from provider/model readiness", async () => {
    fetcher.mockResolvedValue(Response.json(health(false)));
    const status = await getIndigenousCapabilities();
    expect(status).toMatchObject({ configured: true, enabled: true, backendReachable: true, asr: { ready: false, loading: true }, translation: { enabled: true, ready: false } });
    expect(status.asr.wordTimestamps).toBe(false);
    expect(JSON.stringify(status)).not.toContain(TOKEN);
    expect(JSON.stringify(status)).not.toContain("https://indigenous.example");
    expect(fetcher.mock.calls[0][0].toString()).toBe("https://indigenous.example/service/health");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store" });
    expect(fetcher.mock.calls[0][1].headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
  });
  it("does not ping a backend when cloud processing is disabled", async () => {
    vi.stubEnv("VOICE_CLOUD_MODE", "disabled");
    expect(await getIndigenousCapabilities()).toMatchObject({ enabled: false, configured: true, backendReachable: false, asr: { ready: false } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reports an unreachable backend without faking readiness or leaking errors", async () => {
    fetcher.mockRejectedValue(new Error(`${TOKEN} internal error`));
    expect(await getIndigenousCapabilities()).toMatchObject({ enabled: true, configured: true, backendReachable: false, asr: { ready: false } });
  });
});

describe("PCM validation and indigenous ASR", () => {
  it("accepts actual mono 16 kHz PCM16 WAV up to 30 seconds", () => {
    expect(validateIndigenousWav(wav(1))).toBe(1);
    expect(validateIndigenousWav(wav(30))).toBe(30);
  });
  it.each([[1, 8000, 1, 16], [1, 16000, 2, 16], [1, 16000, 1, 8], [30.01, 16000, 1, 16], [0, 16000, 1, 16]])("rejects real audio with unsupported format/duration %j", (seconds, sampleRate, channels, bits) => {
    expect(() => validateIndigenousWav(wav(seconds, sampleRate, channels, bits))).toThrow();
  });
  it("rejects containers merely renamed as WAV and inconsistent/truncated chunks", () => {
    expect(() => validateIndigenousWav(new TextEncoder().encode("WebM audio with fake .wav name"))).toThrow();
    const corrupt = wav(); new DataView(corrupt.buffer).setUint32(40, 1_000_000, true);
    expect(() => validateIndigenousWav(corrupt)).toThrow();
    const trailing = new Uint8Array(wav().byteLength + 2); trailing.set(wav());
    new DataView(trailing.buffer).setUint32(4, trailing.byteLength - 8, true);
    expect(() => validateIndigenousWav(trailing)).toThrow();
  });
  it("sends only validated bytes/language, strips filenames, and returns no fake timestamps", async () => {
    fetcher.mockResolvedValue(Response.json({ text: "Allin p'unchaw", language: "quy_Latn", model: "omniASR_LLM_300M_v2", durationSeconds: 1 }));
    const response = await transcribeIndigenousAudio(new Blob([wav() as BlobPart]), "quy_Latn");
    expect(response).toEqual({ text: "Allin p'unchaw", language: "quy_Latn", model: "omniASR_LLM_300M_v2", durationSeconds: 1, wordTimestamps: false, requiresHumanReview: true });
    const [url, options] = fetcher.mock.calls[0];
    expect(url.toString()).toBe("https://indigenous.example/service/transcribe");
    const form = options.body as FormData;
    expect([...form.keys()]).toEqual(["file", "language"]);
    expect((form.get("file") as File).name).toBe("sample.wav");
    expect(form.get("language")).toBe("quy_Latn");
  });
  it("rejects unsupported languages, oversized files, and incorrect provider language before they become evidence", async () => {
    await expect(transcribeIndigenousAudio(new Blob([wav() as BlobPart]), "en")).rejects.toMatchObject({ code: "unsupported-language" });
    await expect(transcribeIndigenousAudio(new Blob([new Uint8Array(1_000_001)]), "quy_Latn")).rejects.toMatchObject({ status: 413 });
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(Response.json({ text: "hello", language: "spa_Latn", model: "omniASR_LLM_300M_v2", durationSeconds: 1 }));
    await expect(transcribeIndigenousAudio(new Blob([wav() as BlobPart]), "quy_Latn")).rejects.toMatchObject({ code: "invalid-backend-response" });
  });
});

describe("NLLB research-only translation", () => {
  it("requires explicit research mode and does not silently map Cusco Quechua to Ayacucho Quechua", async () => {
    vi.stubEnv("INDIGENOUS_TRANSLATION_RESEARCH_ONLY", "false");
    await expect(translateIndigenousText("hola", "spa_Latn", "quy_Latn")).rejects.toMatchObject({ code: "translation-research-mode-required" });
    vi.stubEnv("INDIGENOUS_TRANSLATION_RESEARCH_ONLY", "true");
    await expect(translateIndigenousText("hola", "quz_Latn", "spa_Latn")).rejects.toMatchObject({ code: "unsupported-translation-language" });
    await expect(translateIndigenousText("x".repeat(1501), "spa_Latn", "quy_Latn")).rejects.toMatchObject({ code: "invalid-text-length" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("returns labeled, human-review-required translation without credentials", async () => {
    fetcher.mockResolvedValue(Response.json({ text: "Allin p'unchaw", sourceLanguage: "spa_Latn", targetLanguage: "quy_Latn", model: "facebook/nllb-200-distilled-600M", researchOnly: true }));
    const response = await translateIndigenousText("buenos días", "spa_Latn", "quy_Latn");
    expect(response).toMatchObject({ text: "Allin p'unchaw", researchOnly: true, requiresHumanReview: true });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ text: "buenos días", sourceLanguage: "spa_Latn", targetLanguage: "quy_Latn" });
    expect(JSON.stringify(response)).not.toContain(TOKEN);
  });
  it("rejects a mismatched model instead of disguising it as NLLB", async () => {
    fetcher.mockResolvedValue(Response.json({ text: "hola", sourceLanguage: "quy_Latn", targetLanguage: "spa_Latn", model: "another-model", researchOnly: true }));
    await expect(translateIndigenousText("rimay", "quy_Latn", "spa_Latn")).rejects.toMatchObject({ code: "invalid-backend-response" });
  });
  it("redacts backend errors and rejects redirects", async () => {
    fetcher.mockResolvedValue(Response.json({ error: `${TOKEN} traceback` }, { status: 500 }));
    await expect(translateIndigenousText("hola", "spa_Latn", "quy_Latn")).rejects.toMatchObject({ code: "indigenous-unavailable", status: 502 });
    expect(fetcher.mock.calls[0][1].redirect).toBe("error");
  });
  it("preserves the token-limit validation failure so a permitted 1500-character input can be shortened", async () => {
    fetcher.mockResolvedValue(Response.json({ error: "translation-input-exceeds-256-tokens", traceback: TOKEN }, { status: 422 }));
    await expect(translateIndigenousText("a ".repeat(700), "spa_Latn", "quy_Latn")).rejects.toMatchObject({ code: "translation-input-exceeds-256-tokens", status: 422 });
  });
  it.each([["no-audio-signal", "audio-not-observable"], ["no-observable-transcript", "asr-not-observable"]])("keeps %s non-observable, never a score or a network outage", async (upstream, code) => {
    fetcher.mockResolvedValue(Response.json({ error: upstream, audio: "never returned", detail: TOKEN }, { status: 422 }));
    await expect(transcribeIndigenousAudio(new Blob([wav() as BlobPart]), "quy_Latn")).rejects.toMatchObject({ code, status: 422 });
  });
  it.each([["model-busy", "indigenous-busy"], ["asr-model-unavailable", "backend-not-ready"]])("preserves safe recoverable status for %s", async (upstream, code) => {
    fetcher.mockResolvedValue(Response.json({ error: upstream }, { status: 503 }));
    await expect(transcribeIndigenousAudio(new Blob([wav() as BlobPart]), "quy_Latn")).rejects.toMatchObject({ code, status: 503 });
  });
  it.each(["private traceback with token", "toString", "__proto__"])("redacts non-allowlisted error %s", async (error) => {
    fetcher.mockResolvedValue(Response.json({ error, token: TOKEN }, { status: 422 }));
    await expect(translateIndigenousText("hola", "spa_Latn", "quy_Latn")).rejects.toMatchObject({ code: "indigenous-unavailable", status: 502 });
  });
  it("does not trust a known code delivered with an unexpected status", async () => {
    fetcher.mockResolvedValue(Response.json({ error: "no-audio-signal" }, { status: 500 }));
    await expect(transcribeIndigenousAudio(new Blob([wav() as BlobPart]), "quy_Latn")).rejects.toMatchObject({ code: "indigenous-unavailable", status: 502 });
  });
  it("bounds request time and aborts it when the client leaves", async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation((_url: URL, options: RequestInit) => new Promise((_resolve, reject) => options.signal!.addEventListener("abort", () => reject(new Error(TOKEN)))));
    const controller = new AbortController();
    const pending = translateIndigenousText("hola", "spa_Latn", "quy_Latn", controller.signal).catch((error: unknown) => error);
    controller.abort();
    expect(await pending).toMatchObject({ code: "indigenous-unavailable" });
    expect(vi.getTimerCount()).toBe(0);
    const timed = translateIndigenousText("hola", "spa_Latn", "quy_Latn").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(await timed).toMatchObject({ code: "indigenous-unavailable" });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("caps streamed bytes without trusting Content-Length", async () => {
    const input = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(20)); controller.close(); } });
    await expect(readIndigenousBody(input, 10)).rejects.toMatchObject({ status: 413 });
  });
});
