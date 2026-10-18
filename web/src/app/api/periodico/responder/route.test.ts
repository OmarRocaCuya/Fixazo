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
const hit = {
  noticia: { id: "noticia", seccion: "Demo", titular: "Un titular", bajada: "", minutos: 1, creada: "2026-10-18", fuentes: [], pasos: [] },
  pregunta: { tipo: "voz" as const, id: "pregunta", etiqueta: "Piensa", titulo: "¿Por qué?", habilidad: "lectura", pistas: ["Mira quién habla."], privado: { criterios: [criterion], respuestaModelo: "privada", prohibido: ["privada"] } },
};
const run = { criterios: [{ id: "evidencia", cumple: true, cita: "vende anuncios" }], retro: "¿Qué otra pista ves en el texto?" };
const input = { noticiaId: "noticia", preguntaId: "pregunta", texto: "El primero vende anuncios y el otro cuida los datos.", intento: 1, audience: "adult", consent: true, adultConfirmed: true };
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

describe("private adult periodico admission and no-evaluation", () => {
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
    expect(await response.json()).toEqual({ enabled: false, adultOnly: true, reason: "periodico-judge-disabled" });
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    vi.stubEnv("PERIODICO_JUDGE_ENABLED", "true"); response = await GET();
    expect(await response.json()).toEqual({ enabled: true, adultOnly: true, reason: null });
  });
  it.each<Record<string, string>>([{ Origin: "https://evil.example" }, { "X-Voice-Access-Code": "wrong" }, { "sec-fetch-site": "cross-site" }])("rejects forbidden caller before reading body: %j", async (headers) => {
    const req = request(input, headers); const read = vi.fn(() => { throw new Error("should not read"); });
    const response = await POST({ url: req.url, headers: req.headers, get body() { return read(); } } as unknown as Request);
    expect([401, 403]).toContain(response.status); expect(read).not.toHaveBeenCalled(); expect(judge).not.toHaveBeenCalled();
  });
  it.each([{ consent: false }, { adultConfirmed: false }, { audience: "child" }, { alumno: "never-store-student" }, { texto: "x".repeat(801) }, { intento: 3 }, { intento: "1" }, { noticiaId: 5 }, { preguntaId: "" }])("rejects invalid or identifying fields before lookup/inference: %j", async (extra) => {
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
