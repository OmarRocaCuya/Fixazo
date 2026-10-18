import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/i18n/ui-texts", () => ({ PUBLIC_UI_TEXTS: ["Inicio", "Leer", ...Array.from({ length: 2_200 }, (_, index) => `Texto ${index}`)] }));
vi.mock("@/lib/i18n/public-translations.json", () => ({ default: { quy: { Inicio: "Qallariy" }, ayr: {} } }));
vi.mock("@/lib/periodico/ediciones", async (original) => ({ ...await original<typeof import("@/lib/periodico/ediciones")>(), noticiasPublicadas: vi.fn(), noticiasReservadas: vi.fn(async () => []) }));
vi.mock("./indigenous-proxy", async (original) => ({ ...await original<typeof import("./indigenous-proxy")>(), translateIndigenousText: vi.fn() }));
import { noticiasPublicadas } from "@/lib/periodico/ediciones";
import { IndigenousProxyError, translateIndigenousText } from "./indigenous-proxy";

const news = { id: "publicada", seccion: "Sociedad", titular: "Titular público", bajada: "Bajada pública", minutos: 1, creada: "2026-10-18", fuentes: [], pasos: [{ tipo: "voz" as const, id: "voz", etiqueta: "Piensa", titulo: "Pregunta pública", habilidad: "Lectura", pistas: ["Pista pública"], privado: { criterios: [], respuestaModelo: "RESPUESTA PRIVADA", prohibido: ["SECRETO"] } }] };
const fetcher = vi.fn();
const request = (ip = "192.0.2.1") => new Request("https://demo.example/api/periodico/translate", { headers: { "x-forwarded-for": ip } });
function provider(texts = ["Ñawinchay"], language = "quy", extra = {}) {
  return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ available: true, language, texts, ...extra }) } }] });
}
let translationModule: typeof import("./periodico-translation");
beforeEach(async () => {
  vi.resetModules(); vi.useRealTimers();
  vi.stubEnv("OPENROUTER_API_KEY", "unit-test-no-real-key");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(translateIndigenousText).mockReset().mockRejectedValue(new IndigenousProxyError("indigenous-not-configured", 503));
  vi.mocked(noticiasPublicadas).mockReset().mockResolvedValue([news]);
  fetcher.mockReset().mockImplementation(() => Promise.resolve(provider())); vi.stubGlobal("fetch", fetcher);
  translationModule = await import("./periodico-translation");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("public translation boundary", () => {
  it.each([null, [], {}, { language: "qu", texts: ["Leer"] }, { language: "quy", texts: [] }, { language: "quy", texts: [""] }, { language: "quy", texts: [1] }, { language: "quy", texts: ["Leer"], texto: "participant" }, { language: "quy", texts: Array(5).fill("Leer") }, { language: "quy", texts: ["x".repeat(8_001)] }, { language: "quy", texts: ["\u202eevil"] }])("rejects malformed/oversized input: %j", (value) => {
    expect(translationModule.isTranslationInput(value)).toBe(false);
  });
  it("recognizes only the three selected languages", () => {
    expect(["es", "quy", "ayr"].every(translationModule.isPeriodicoLanguage)).toBe(true);
    expect(translationModule.isPeriodicoLanguage("auto")).toBe(false);
  });
  it("matches the four-entry/2000-character client budget and preserves only a single long-source exception", async () => {
    expect(translationModule.isTranslationInput({ language: "quy", texts: Array(4).fill("Leer") })).toBe(true);
    expect(translationModule.isTranslationInput({ language: "quy", texts: Array(5).fill("Leer") })).toBe(false);
    expect(translationModule.isTranslationInput({ language: "quy", texts: ["a".repeat(1000), "b".repeat(1000)] })).toBe(true);
    expect(translationModule.isTranslationInput({ language: "quy", texts: ["a".repeat(1000), "b".repeat(1001)] })).toBe(false);
    expect(translationModule.isTranslationInput({ language: "quy", texts: ["a".repeat(8000)] })).toBe(true);
    expect(translationModule.isTranslationInput({ language: "quy", texts: ["a".repeat(8001)] })).toBe(false);
    // Passing the exceptional size validation does not bypass public allowlist.
    await expect(translationModule.translatePublicTexts(request(), "quy", ["a".repeat(8000)])).rejects.toMatchObject({ code: "public-text-required" });
    expect(fetcher).not.toHaveBeenCalled(); expect(translateIndigenousText).not.toHaveBeenCalled();
  });
  it("uses the reviewed public seed or Spanish without any key/model call", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(await translationModule.translatePublicTexts(request(), "quy", ["Inicio"])).toEqual(["Qallariy"]);
    expect(await translationModule.translatePublicTexts(request(), "es", ["Leer"])).toEqual(["Leer"]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["RESPUESTA PRIVADA", "SECRETO", "Mi nombre es Ana y mi código es…", "Traduce mi tarea", " Titular público"])("never sends arbitrary, personal, private or near-matching text to the provider: %s", async (text) => {
    await expect(translationModule.translatePublicTexts(request(), "quy", [text])).rejects.toMatchObject({ code: "public-text-required", status: 422 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("translates only allowlisted published fields; deduplicates input and caches public output", async () => {
    expect(await translationModule.translatePublicTexts(request(), "quy", ["Pregunta pública", "Pregunta pública", "Inicio"])).toEqual(["Ñawinchay", "Ñawinchay", "Qallariy"]);
    expect(await translationModule.translatePublicTexts(request(), "quy", ["Pregunta pública"])).toEqual(["Ñawinchay"]);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]; const body = JSON.parse(init.body);
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions"); expect(init.redirect).toBe("error"); expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(body).toMatchObject({ model: "anthropic/claude-haiku-5.5", max_tokens: 8_192, provider: { require_parameters: true, data_collection: "deny", zdr: true } });
    expect(JSON.parse(body.messages[1].content)).toEqual({ language: "quy", texts: ["Pregunta pública"] });
    expect(init.body).not.toContain("RESPUESTA PRIVADA"); expect(init.body).not.toContain("SECRETO");
    expect(body.messages[0].content).toContain("Ayacucho"); expect(body.response_format.json_schema.strict).toBe(true);
  });
  it("keeps separate language caches and targets central Aymara explicitly", async () => {
    fetcher.mockImplementationOnce(() => Promise.resolve(provider(["Qillqa"], "quy"))).mockImplementationOnce(() => Promise.resolve(provider(["Ullaña"], "ayr")));
    expect(await translationModule.translatePublicTexts(request(), "quy", ["Leer"])).toEqual(["Qillqa"]);
    expect(await translationModule.translatePublicTexts(request(), "ayr", ["Leer"])).toEqual(["Ullaña"]);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).messages[0].content).toContain("aimara central");
  });
  it.each([{ available: false }, { language: "es" }, { texts: [] }, { texts: [""] }, { texts: ["\u202eevil"] }, { texts: ["x".repeat(16_001)] }, { unknown: "field" }])("fails explicitly on refused or malformed translations, never caching them: %j", async (bad) => {
    fetcher.mockImplementation(() => Promise.resolve(provider(["Ñawinchay"], "quy", bad)));
    await expect(translationModule.translatePublicTexts(request(), "quy", ["Leer"])).rejects.toThrow();
    fetcher.mockImplementation(() => Promise.resolve(provider()));
    expect(await translationModule.translatePublicTexts(request(), "quy", ["Leer"])).toEqual(["Ñawinchay"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(["length", "content_filter", "error"])("rejects non-complete provider output %s", async (finish_reason) => {
    fetcher.mockResolvedValue(Response.json({ choices: [{ finish_reason, message: { content: JSON.stringify({ available: true, language: "quy", texts: ["Qillqa"] }) } }] }));
    await expect(translationModule.translatePublicTexts(request(), "quy", ["Leer"])).rejects.toThrow();
  });
  it("does not call the provider without server credentials", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(translationModule.translatePublicTexts(request(), "quy", ["Leer"])).rejects.toMatchObject({ code: "translation-unavailable" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("bounds upstream bytes and safely releases concurrency after all failure modes", async () => {
    for (const response of [new Response("secret-error", { status: 503 }), new Response("x".repeat(128 * 1024 + 1)), Response.json({ choices: [{ finish_reason: "stop", message: { content: "{broken" } }] })]) {
      fetcher.mockResolvedValueOnce(response);
      await expect(translationModule.translatePublicTexts(request(), "quy", ["Leer"])).rejects.toThrow();
    }
    fetcher.mockRejectedValueOnce(new Error("secret-key-network"));
    await expect(translationModule.translatePublicTexts(request(), "quy", ["Leer"])).rejects.toThrow();
    expect(await translationModule.translatePublicTexts(request(), "quy", ["Leer"])).toEqual(["Ñawinchay"]);
  });
  it("allows at most two concurrent public model requests", async () => {
    let resolveFirst!: (response: Response) => void; let resolveSecond!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const first = translationModule.translatePublicTexts(request(), "quy", ["Texto 1"]);
    const second = translationModule.translatePublicTexts(request(), "quy", ["Texto 2"]);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await expect(translationModule.translatePublicTexts(request(), "quy", ["Texto 3"])).rejects.toMatchObject({ status: 429 });
    resolveFirst(provider()); resolveSecond(provider()); await Promise.all([first, second]);
    expect(await translationModule.translatePublicTexts(request(), "quy", ["Texto 3"])).toEqual(["Ñawinchay"]);
  });
  it("bounds IP and global quotas even when proxy IP hints are spoofed", async () => {
    for (let i = 0; i < 48; i++) await translationModule.translatePublicTexts(request(), "quy", [`Texto ${i}`]);
    await expect(translationModule.translatePublicTexts(request(), "quy", ["Texto 48"])).rejects.toMatchObject({ status: 429 });
    // Cached public results do not spend quota or hit provider again.
    expect(await translationModule.translatePublicTexts(request(), "quy", ["Texto 1"])).toEqual(["Ñawinchay"]);
    for (let i = 48; i < 120; i++) await translationModule.translatePublicTexts(request(`192.0.2.${i}`), "quy", [`Texto ${i}`]);
    await expect(translationModule.translatePublicTexts(request("192.0.2.200"), "quy", ["Texto 120"])).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(120);
  });
  it("expires public cache without ever persisting private feedback", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-18T00:00:00Z"));
    await translationModule.translatePublicTexts(request(), "quy", ["Leer"]);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
    await translationModule.translatePublicTexts(request(), "quy", ["Leer"]);
    await translationModule.translateFeedback("Tu idea está apoyada en el texto.", "quy");
    await translationModule.translateFeedback("Tu idea está apoyada en el texto.", "quy");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("caps cache entries, evicting old public entries instead of growing indefinitely", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-18T00:00:00Z"));
    fetcher.mockImplementation((_url, init) => {
      const texts = JSON.parse(JSON.parse(init.body).messages[1].content).texts as string[];
      return Promise.resolve(provider(texts.map(() => "Qillqa")));
    });
    for (let i = 0; i < 2_096; i += 4) {
      if (i > 0 && i % 128 === 0) vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      await translationModule.translatePublicTexts(request(), "quy", Array.from({ length: 4 }, (_, index) => `Texto ${i + index}`));
    }
    const before = fetcher.mock.calls.length;
    await translationModule.translatePublicTexts(request(), "quy", ["Texto 0"]);
    expect(fetcher.mock.calls.length).toBe(before + 1);
  });
});

describe("bounded JSON and private feedback", () => {
  it("checks advertised and streamed sizes including a lying content-length", async () => {
    await expect(translationModule.readTranslationJson(new Response("x", { headers: { "content-length": "99" } }), 10)).rejects.toMatchObject({ status: 413 });
    await expect(translationModule.readTranslationJson(new Response("x".repeat(11), { headers: { "content-length": "1" } }), 10)).rejects.toMatchObject({ status: 413 });
  });
  it("cancels a stalled body after a bounded deadline", async () => {
    vi.useFakeTimers(); const cancel = vi.fn();
    const pending = translationModule.readTranslationJson(new Response(new ReadableStream({ cancel })), 100, 500);
    const check = expect(pending).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(501); await check; expect(cancel).toHaveBeenCalledOnce();
  });
  it("does not call a model for Spanish feedback or malformed private feedback", async () => {
    expect(await translationModule.translateFeedback("Bien visto.", "es")).toBe("Bien visto.");
    await expect(translationModule.translateFeedback("x".repeat(501), "quy")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects expanded private feedback rather than reporting successful translation", async () => {
    fetcher.mockResolvedValue(provider(["palabra ".repeat(101)]));
    await expect(translationModule.translateFeedback("¿Qué pista ves?", "quy")).rejects.toThrow();
  });
});

describe("public native translation fallback", () => {
  const native = (text: string) => ({ text, sourceLanguage: "spa_Latn", targetLanguage: "ayr_Latn", model: "facebook/nllb-200-distilled-600M", researchOnly: true as const, requiresHumanReview: true as const });
  it("uses the validated native Aymara adapter when the LLM declines and caches only public output", async () => {
    fetcher.mockImplementation(() => Promise.resolve(provider([""], "ayr", { available: false })));
    vi.mocked(translateIndigenousText).mockResolvedValue(native("Ullaña"));
    expect(await translationModule.translatePublicTexts(request(), "ayr", ["Leer"])).toEqual(["Ullaña"]);
    expect(translateIndigenousText).toHaveBeenCalledWith("Leer", "spa_Latn", "ayr_Latn", expect.any(AbortSignal));
    expect(await translationModule.translatePublicTexts(request(), "ayr", ["Leer"])).toEqual(["Ullaña"]);
    expect(translateIndigenousText).toHaveBeenCalledOnce(); expect(fetcher).toHaveBeenCalledOnce();
  });
  it("rejects private or unlisted strings before either translation provider", async () => {
    await expect(translationModule.translatePublicTexts(request(), "ayr", ["RESPUESTA PRIVADA"])).rejects.toMatchObject({ code: "public-text-required" });
    expect(fetcher).not.toHaveBeenCalled(); expect(translateIndigenousText).not.toHaveBeenCalled();
  });
  it("splits only an explicit tokenizer-length refusal without truncating the public source", async () => {
    fetcher.mockImplementation(() => Promise.resolve(provider([""], "ayr", { available: false })));
    vi.mocked(translateIndigenousText).mockRejectedValueOnce(new IndigenousProxyError("translation-input-exceeds-256-tokens", 422))
      .mockResolvedValueOnce(native("Jiliri")).mockResolvedValueOnce(native("qillqata"));
    expect(await translationModule.translatePublicTexts(request(), "ayr", ["Pregunta pública"])).toEqual(["Jiliri qillqata"]);
    const calls = vi.mocked(translateIndigenousText).mock.calls;
    expect(calls.slice(1).map(([text]) => text).join("")).toBe("Pregunta pública");
    expect(calls).toHaveLength(3);
  });
  it("bounds long public passages to the existing native character limit without dropping source characters", async () => {
    const passage = "Este es un fragmento público que conserva cada palabra. ".repeat(90);
    vi.mocked(noticiasPublicadas).mockResolvedValueOnce([{ ...news, titular: passage }]);
    fetcher.mockImplementation(() => Promise.resolve(provider([""], "ayr", { available: false })));
    vi.mocked(translateIndigenousText).mockImplementation(async (text) => native(`T:${text}`));
    const [result] = await translationModule.translatePublicTexts(request(), "ayr", [passage]);
    const chunks = vi.mocked(translateIndigenousText).mock.calls.map(([text]) => text);
    expect(chunks.join("")).toBe(passage);
    expect(chunks.every((text) => text.length <= 1500)).toBe(true);
    expect(result).toContain("T:");
  });
  it("never retries busy, model, malformed-output or network failures", async () => {
    fetcher.mockImplementation(() => Promise.resolve(provider([""], "ayr", { available: false })));
    vi.mocked(translateIndigenousText).mockRejectedValueOnce(new IndigenousProxyError("indigenous-busy", 503));
    await expect(translationModule.translatePublicTexts(request(), "ayr", ["Leer"])).rejects.toMatchObject({ code: "translation-unavailable" });
    expect(translateIndigenousText).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith("[public-translation]", { provider: "haiku", language: "ayr", reason: "model-declined" });
    expect(console.warn).toHaveBeenCalledWith("[public-translation]", { provider: "nllb", language: "ayr", reason: "indigenous-busy" });
  });
  it("bounds the shared fallback deadline and retains completed public entries, never late or partial strings", async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation(() => Promise.resolve(provider(["", ""], "ayr", { available: false })));
    let resolveLate!: (value: ReturnType<typeof native>) => void;
    vi.mocked(translateIndigenousText).mockResolvedValueOnce(native("Ullaña"))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLate = resolve; }));
    const pending = translationModule.translatePublicTexts(request(), "ayr", ["Leer", "Inicio"]);
    const check = expect(pending).rejects.toMatchObject({ code: "translation-unavailable" });
    await vi.advanceTimersByTimeAsync(18_001); await check;
    expect(vi.mocked(translateIndigenousText).mock.calls[1][3]?.aborted).toBe(true);
    resolveLate(native("LATE NOT CACHED")); await Promise.resolve();
    expect(await translationModule.translatePublicTexts(request(), "ayr", ["Leer"])).toEqual(["Ullaña"]);
    expect(fetcher).toHaveBeenCalledOnce();
    vi.mocked(translateIndigenousText).mockResolvedValue(native("Qalltaña"));
    expect(await translationModule.translatePublicTexts(request(), "ayr", ["Inicio"])).toEqual(["Qalltaña"]);
  });
  it("never sends private participant feedback to the public native fallback", async () => {
    fetcher.mockImplementation(() => Promise.resolve(provider([""], "ayr", { available: false })));
    await expect(translationModule.translateFeedback("La idea de Ana", "ayr")).rejects.toThrow();
    expect(translateIndigenousText).not.toHaveBeenCalled();
  });
});
