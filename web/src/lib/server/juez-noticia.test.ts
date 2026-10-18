import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { corridaValida, juzgarVoz } from "./juez-noticia";

const criterion = { id: "pista", nombre: "Pista", descripcion: "cita", ejemploCumple: "", ejemploNoCumple: "", repregunta: "¿Qué ves?" };
const params = { fragmentos: ["Medio: texto público"], pregunta: "¿Qué ves?", criterios: [criterion], respuestaModelo: "privada", texto: "Veo que el texto contrasta las dos fuentes." };
const run = { criterios: [{ id: "pista", cumple: true, cita: "contrasta las dos fuentes" }], retro: "¿Qué otra pista encuentras?" };
const fetcher = vi.fn();
function provider(value: unknown = run, finish_reason = "stop") { return Response.json({ choices: [{ finish_reason, message: { content: typeof value === "string" ? value : JSON.stringify(value) } }] }); }
beforeEach(() => {
  vi.stubEnv("PERIODICO_JUDGE_ENABLED", "true"); vi.stubEnv("VOICE_ACCESS_CODE", "unit-test-private-code"); vi.stubEnv("OPENROUTER_API_KEY", "unit-test-no-real-key");
  fetcher.mockReset().mockImplementation(() => Promise.resolve(provider())); vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("bounded periodico judge contract", () => {
  it.each(["disabled", "key"])("never calls a provider when %s configuration is missing", async (missing) => {
    if (missing === "disabled") vi.stubEnv("PERIODICO_JUDGE_ENABLED", "false");
    if (missing === "key") vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(await juzgarVoz(params)).toEqual([]); expect(fetcher).not.toHaveBeenCalled();
  });
  it("makes exactly three fixed-destination token/timeout-bounded calls and validates each run", async () => {
    expect(await juzgarVoz(params)).toEqual([run, run, run]); expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions"); expect(init.redirect).toBe("error"); expect(init.signal).toBeInstanceOf(AbortSignal);
      const body = JSON.parse(init.body); expect(body.model).toBe("anthropic/claude-haiku-5.5"); expect(body.reasoning).toEqual({ enabled: false });
      expect(body.provider).toEqual({ require_parameters: true, data_collection: "deny", zdr: true });
      expect(body.max_tokens).toBe(500); expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
      expect(body.messages[1].content).toContain(params.texto); expect(body.messages[1].content).not.toContain("alumno");
    }
  });
  it("passes authored choices only as feedback context and forbids grading or emotional inferences from them", async () => {
    const elecciones = [{ preguntaId: "opcion-previa", pregunta: "¿Cuál es el propósito?", opcionElegida: "Informar a la comunidad", habilidad: "contrastar" }];
    expect(await juzgarVoz({ ...params, elecciones })).toEqual([run, run, run]);
    for (const [, init] of fetcher.mock.calls) {
      const body = JSON.parse(init.body);
      const system = body.messages[0].content;
      const context = JSON.parse(body.messages[1].content);
      expect(context.elecciones_previas_solo_para_personalizar_retroalimentacion).toEqual(elecciones);
      expect(context.respuesta_del_estudiante).toBe(params.texto);
      expect(context.criterios).toEqual([{ id: criterion.id, descripcion: criterion.descripcion, ejemplo_cumple: "", ejemplo_no_cumple: "" }]);
      expect(context).not.toHaveProperty("correcta");
      expect(system).toContain("Evalúas SOLO la respuesta libre actual contra sus criterios");
      expect(system).toContain("No son prueba de habilidad ni de corrección");
      expect(system).toContain('nunca justifican "cumple" ni una "cita"');
      expect(system).toContain("No infieras ni etiquetes emociones");
    }
  });
  it("keeps the legacy prompt compatible when no choices were supplied", async () => {
    await juzgarVoz(params);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(JSON.parse(body.messages[1].content).elecciones_previas_solo_para_personalizar_retroalimentacion).toEqual([]);
  });
  it.each([null, [], {}, { criterios: [], retro: "No" }, { ...run, retro: "" }, { ...run, criterios: [{ id: "otro", cumple: false, cita: "" }] }, { ...run, criterios: [{ id: "pista", cumple: "false", cita: "" }] }, { ...run, criterios: [{ id: "pista", cumple: false, cita: 7 }] }, { ...run, extra: "unknown" }])("rejects malformed criteria instead of treating them as a failed skill", async (bad) => {
    fetcher.mockImplementation(() => Promise.resolve(provider(bad)));
    expect(await juzgarVoz(params)).toEqual([]);
  });
  it("rejects missing and duplicate rubric IDs", () => {
    expect(corridaValida({ ...run, criterios: [run.criterios[0], run.criterios[0]] }, [criterion, { ...criterion, id: "otra" }])).toBe(false);
    expect(corridaValida(run, [])).toBe(false);
  });
  it.each(["length", "error", "content_filter"])("rejects truncated or refused completion %s", async (finish) => {
    fetcher.mockImplementation(() => Promise.resolve(provider(run, finish))); expect(await juzgarVoz(params)).toEqual([]);
  });
  it("discards malformed JSON, rejected HTTP and network timeouts without exposing details", async () => {
    fetcher.mockImplementationOnce(() => Promise.resolve(provider("{broken")))
      .mockImplementationOnce(() => Promise.resolve(new Response("private-provider-error", { status: 503 })))
      .mockRejectedValueOnce(new Error("private-provider-key-and-error"));
    expect(await juzgarVoz(params)).toEqual([]);
  });
  it("rejects oversized upstream bytes rather than buffering unbounded JSON", async () => {
    fetcher.mockImplementation(() => Promise.resolve(new Response("x".repeat(65537)))); expect(await juzgarVoz(params)).toEqual([]);
  });
  it("keeps only complete successful runs when other fixed calls fail", async () => {
    fetcher.mockImplementationOnce(() => Promise.resolve(provider())).mockRejectedValueOnce(new Error("timeout")).mockImplementationOnce(() => Promise.resolve(provider()));
    expect(await juzgarVoz(params)).toEqual([run, run]);
  });
});
