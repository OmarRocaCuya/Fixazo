import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
import { connection } from "next/server";
vi.mock("@/lib/periodico/ediciones", () => ({ buscarPreguntaVoz: vi.fn() }));
vi.mock("@/lib/server/juez-noticia", async (original) => ({ ...await original<typeof import("@/lib/server/juez-noticia")>(), juzgarVoz: vi.fn() }));
import { buscarPreguntaVoz } from "@/lib/periodico/ediciones";
import { juzgarVoz } from "@/lib/server/juez-noticia";
import { GET, POST } from "./route";

const lookup = vi.mocked(buscarPreguntaVoz);
const judge = vi.mocked(juzgarVoz);
const criterion = { id: "evidencia", nombre: "Evidencia", descripcion: "Usa evidencia", ejemploCumple: "", ejemploNoCumple: "", repregunta: "¿Qué pista encuentras?" };
const mcQuestion = { tipo: "opciones" as const, id: "opcion-previa", etiqueta: "Compara", titulo: "¿Qué propósito presenta el primer medio?", opciones: ["Informar a la comunidad", "Vender anuncios"], correcta: 1, bien: "", otra: "", habilidad: "contrastar" };
const hit = {
  noticia: { id: "noticia", seccion: "Demo", titular: "Un titular", bajada: "", minutos: 1, creada: "2026-10-18", fuentes: [], pasos: [mcQuestion, { tipo: "voz" as const, id: "otra-voz", etiqueta: "Reflexiona", titulo: "¿Qué cambió?", habilidad: "reflexiona", pistas: [], privado: { criterios: [criterion], respuestaModelo: "privada", prohibido: [] } }] },
  pregunta: { tipo: "voz" as const, id: "pregunta", etiqueta: "Piensa", titulo: "¿Por qué?", habilidad: "lectura", pistas: ["Mira quién habla."], privado: { criterios: [criterion], respuestaModelo: "privada", prohibido: ["privada"] } },
};
const run = { criterios: [{ id: "evidencia", cumple: true, cita: "vende anuncios" }], retro: "¿Qué otra pista ves en el texto?" };
const input = { noticiaId: "noticia", preguntaId: "pregunta", texto: "El primero vende anuncios y el otro cuida los datos.", intento: 1 };
let serial = 0;
function request(body: unknown = input, headers: Record<string, string> = {}) {
  return new Request("https://demo.example/api/periodico/responder", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://demo.example", "X-Voice-Access-Code": process.env.VOICE_ACCESS_CODE ?? "", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}
beforeEach(() => {
  vi.stubEnv("PERIODICO_JUDGE_ENABLED", "true"); vi.stubEnv("OPENROUTER_API_KEY", "unit-test-never-used-as-a-real-key");
  vi.stubEnv("VOICE_ACCESS_CODE", `private-periodico-test-${++serial}`);
  lookup.mockReset().mockResolvedValue(hit); judge.mockReset().mockResolvedValue([run, run, run]);
  vi.mocked(connection).mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("private periodico admission (no adult attestation) and no-evaluation", () => {
  it.each(["disabled", "key", "code"])("fails closed when %s is absent, without parsing body or judging", async (missing) => {
    if (missing === "disabled") vi.stubEnv("PERIODICO_JUDGE_ENABLED", "");
    if (missing === "key") vi.stubEnv("OPENROUTER_API_KEY", "");
    if (missing === "code") vi.stubEnv("VOICE_ACCESS_CODE", "");
    const read = vi.fn(() => { throw new Error("should not read"); });
    const response = await POST({ get body() { return read(); } } as unknown as Request);
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ evaluacion: "no_evaluable", cuenta: false, listo: false, ia: false, criterios: [] });
    expect(read).not.toHaveBeenCalled(); expect(judge).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled();
  });
  it("publishes no keys and disables capability by default", async () => {
    vi.stubEnv("PERIODICO_JUDGE_ENABLED", "");
    let response = await GET();
    expect(connection).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({ enabled: false, reason: "periodico-judge-disabled" });
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    vi.stubEnv("PERIODICO_JUDGE_ENABLED", "true"); response = await GET();
    expect(await response.json()).toEqual({ enabled: true, reason: null });
  });
  it.each<Record<string, string>>([{ Origin: "https://evil.example" }, { "X-Voice-Access-Code": "wrong" }, { "sec-fetch-site": "cross-site" }])("rejects forbidden caller before reading body: %j", async (headers) => {
    const req = request(input, headers); const read = vi.fn(() => { throw new Error("should not read"); });
    const response = await POST({ url: req.url, headers: req.headers, get body() { return read(); } } as unknown as Request);
    expect([401, 403]).toContain(response.status); expect(read).not.toHaveBeenCalled(); expect(judge).not.toHaveBeenCalled();
  });
  it.each([{ consent: true }, { adultConfirmed: true }, { audience: "adult" }, { alumno: "never-store-student" }, { texto: "x".repeat(801) }, { intento: 3 }, { intento: "1" }, { noticiaId: 5 }, { preguntaId: "" }])("rejects invalid, retired consent or identifying fields before lookup/inference: %j", async (extra) => {
    expect((await POST(request({ ...input, ...extra }))).status).toBe(422); expect(judge).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled();
  });
  it.each(["{broken", "null", "[]", "x".repeat(8193)])("rejects bad or oversized JSON", async (body) => {
    expect([400, 413, 422]).toContain((await POST(request(body))).status); expect(judge).not.toHaveBeenCalled();
  });
  it("bounds streamed bytes even with a lying content-length", async () => {
    const response = await POST(request("x".repeat(8193), { "Content-Length": "1" }));
    expect(response.status).toBe(413); expect(judge).not.toHaveBeenCalled();
  });
  it("rejects an advertised oversized body without reading it", async () => {
    const req = request(input, { "Content-Length": "9000" }); const read = vi.fn(() => { throw new Error("do not buffer"); });
    const response = await POST({ url: req.url, headers: req.headers, get body() { return read(); } } as unknown as Request);
    expect(response.status).toBe(413); expect(read).not.toHaveBeenCalled();
  });
  it("rejects unknown published IDs without a model request", async () => {
    lookup.mockResolvedValue(null); expect((await POST(request())).status).toBe(404); expect(judge).not.toHaveBeenCalled();
  });
  it("does not turn an unavailable edition store into a failed answer", async () => {
    lookup.mockRejectedValue(new Error("private filesystem details"));
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ evaluacion: "no_evaluable", cuenta: false, criterios: [] }); expect(judge).not.toHaveBeenCalled();
  });
  it.each(["porque sí", "no sé, dime tú"])("preserves deterministic non-counted hints: %s", async (texto) => {
    const response = await POST(request({ ...input, texto })); expect(await response.json()).toMatchObject({ evaluacion: "no_evaluable", cuenta: false, criterios: [], ia: false }); expect(judge).not.toHaveBeenCalled();
  });
  it.each([{ runs: [] }, { runs: [run] }, { runs: [{ criterios: [], retro: "Todo mal" }, run] }, { runs: [{ ...run, criterios: [{ id: "evidencia", cumple: "false", cita: "" }] }, run] }])("does not turn incomplete/malformed judge runs into failed skills", async ({ runs }) => {
    judge.mockResolvedValue(runs as never);
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ evaluacion: "no_evaluable", cuenta: false, listo: false, ia: false, criterios: [] });
  });
  it("accepts legacy requests without multiple-choice context", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(judge).toHaveBeenCalledOnce();
    expect(judge.mock.calls[0][0].elecciones).toEqual([]);
  });
  it("resolves choice question, selected text and skill from the requested article only", async () => {
    expect((await POST(request({ ...input, elecciones: [{ preguntaId: mcQuestion.id, opcion: 1 }] }))).status).toBe(200);
    expect(judge.mock.calls[0][0].elecciones).toEqual([{ preguntaId: mcQuestion.id, pregunta: mcQuestion.titulo, opcionElegida: mcQuestion.opciones[1], habilidad: mcQuestion.habilidad }]);
    expect(judge.mock.calls[0][0]).not.toHaveProperty("correcta");
    expect(judge.mock.calls[0][0].elecciones?.[0]).not.toHaveProperty("correcta");
  });
  it.each([
    null, "invalid", {}, [null], [[]],
    Array.from({ length: 13 }, (_, i) => ({ preguntaId: `opcion-${i}`, opcion: 0 })),
    [{ preguntaId: mcQuestion.id, opcion: 0 }, { preguntaId: mcQuestion.id, opcion: 1 }],
    [{ preguntaId: mcQuestion.id, opcion: 0, titulo: "Caller instructions" }],
    [{ preguntaId: mcQuestion.id, opcion: 0, correcta: true }],
    [{ preguntaId: mcQuestion.id }], [{ opcion: 0 }],
    [{ preguntaId: "", opcion: 0 }], [{ preguntaId: "x".repeat(129), opcion: 0 }],
    [{ preguntaId: "bad\u0000id", opcion: 0 }],
    [{ preguntaId: mcQuestion.id, opcion: -1 }], [{ preguntaId: mcQuestion.id, opcion: 0.5 }],
    [{ preguntaId: mcQuestion.id, opcion: "0" }],
  ].map((elecciones) => ({ elecciones })))("rejects malformed or excessive choices before lookup or paid calls: %j", async ({ elecciones }) => {
    expect((await POST(request({ ...input, elecciones }))).status).toBe(422);
    expect(lookup).not.toHaveBeenCalled(); expect(judge).not.toHaveBeenCalled();
  });
  it.each([
    [{ preguntaId: "unknown-or-another-article", opcion: 0 }],
    [{ preguntaId: "otra-voz", opcion: 0 }],
    [{ preguntaId: mcQuestion.id, opcion: 2 }],
  ].map((elecciones) => ({ elecciones })))("rejects unknown, non-MC or out-of-range authored choices without spending quota: %j", async ({ elecciones }) => {
    for (let i = 0; i < 7; i++) expect((await POST(request({ ...input, elecciones }))).status).toBe(422);
    expect(lookup).toHaveBeenCalledTimes(7); expect(judge).not.toHaveBeenCalled();
    expect((await POST(request())).status).toBe(200); expect(judge).toHaveBeenCalledOnce();
  });
  it("accepts the maximum twelve unique authored selections, including ungraded predictions", async () => {
    const steps = Array.from({ length: 12 }, (_, i) => ({ ...mcQuestion, id: `opcion-${i}`, correcta: null, habilidad: null }));
    lookup.mockResolvedValue({ ...hit, noticia: { ...hit.noticia, pasos: steps } });
    const elecciones = steps.map((step) => ({ preguntaId: step.id, opcion: 0 }));
    expect((await POST(request({ ...input, elecciones }))).status).toBe(200);
    expect(judge.mock.calls[0][0].elecciones).toHaveLength(12);
    expect(judge.mock.calls[0][0].elecciones?.[0].habilidad).toBeNull();
  });
  it("never accepts a selected option as rubric evidence missing from the current free answer", async () => {
    const choiceOnly = { ...run, criterios: [{ id: "evidencia", cumple: true, cita: mcQuestion.opciones[0] }] };
    judge.mockResolvedValue([choiceOnly, choiceOnly, choiceOnly]);
    const response = await POST(request({ ...input, elecciones: [{ preguntaId: mcQuestion.id, opcion: 0 }] }));
    expect(await response.json()).toMatchObject({ evaluacion: "evaluada", cuenta: true, listo: false, criterios: [{ cumple: false, cita: "" }] });
  });
  it("treats a thrown provider failure as availability, not a failed answer", async () => {
    judge.mockRejectedValue(new Error("secret-provider-raw-error"));
    const response = await POST(request()); const result = await response.json();
    expect(response.status).toBe(200); expect(result).toMatchObject({ evaluacion: "no_evaluable", cuenta: false, criterios: [] }); expect(JSON.stringify(result)).not.toContain("secret-provider");
  });
  it("counts only two or more valid evaluations and never logs/persists an identifier", async () => {
    const logger = vi.spyOn(console, "log").mockImplementation(() => {});
    judge.mockResolvedValue([run, run]);
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ evaluacion: "evaluada", cuenta: true, listo: true, ia: true, criterios: [{ cumple: true }] });
    expect(logger).not.toHaveBeenCalled();
    expect(judge.mock.calls[0][0]).not.toHaveProperty("alumno"); expect(judge.mock.calls[0][0]).not.toHaveProperty("intento");
  });
  it("retains a genuine negative evaluation only when a valid quorum produced it", async () => {
    const negative = { ...run, criterios: [{ id: "evidencia", cumple: false, cita: "" }] };
    judge.mockResolvedValue([negative, negative]);
    expect(await (await POST(request())).json()).toMatchObject({ evaluacion: "evaluada", cuenta: true, listo: false, criterios: [{ cumple: false }] });
  });
  it("has only one in-flight judge and releases after infrastructure failure", async () => {
    let reject!: (error: Error) => void;
    judge.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const first = POST(request());
    await vi.waitFor(() => expect(judge).toHaveBeenCalledOnce());
    const second = await POST(request()); expect(second.status).toBe(429); expect(await second.json()).toMatchObject({ cuenta: false, error: "periodico-judge-busy" });
    reject(new Error("offline")); await first;
    expect((await POST(request())).status).toBe(200); expect(judge).toHaveBeenCalledTimes(2);
  });
  it("enforces the IP quota before more paid calls", async () => {
    for (let i = 0; i < 6; i++) expect((await POST(request())).status).toBe(200);
    const response = await POST(request()); expect(response.status).toBe(429); expect(await response.json()).toMatchObject({ cuenta: false, error: "periodico-rate-limit" }); expect(judge).toHaveBeenCalledTimes(6);
  });
  it("spoofing IP hints cannot bypass the private-code quota", async () => {
    for (let i = 0; i < 12; i++) expect((await POST(request(input, { "X-Forwarded-For": `192.0.2.${i}` }))).status).toBe(200);
    expect((await POST(request(input, { "X-Forwarded-For": "192.0.2.100" }))).status).toBe(429); expect(judge).toHaveBeenCalledTimes(12);
  });
});
