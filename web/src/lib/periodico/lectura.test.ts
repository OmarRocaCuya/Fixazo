import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enrich } from "@reader-enricher/enrich";
import { EnrichRequestSchema, GENEROS } from "@reader-enricher/schemas";
import type { EnrichedDocument } from "@reader-enricher/types";
import type { Noticia } from "./tipos";
import { getLecturaEnriquecida } from "./lectura";

vi.mock("server-only", () => ({}));
vi.mock("@reader-enricher/enrich", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@reader-enricher/enrich")>();
  return { ...actual, enrich: vi.fn(actual.enrich) };
});

const noticia: Noticia = {
  id: "lectura-1", seccion: "Comunidad", titular: "El parque reúne a las familias", bajada: "Dos voces sobre un espacio público.", minutos: 3,
  miradas: [{ medio: "Medio A", texto: "No debe enviarse este campo" }],
  pasos: [
    { tipo: "fragmento", lado: "a", medio: "Medio A", fecha: "2026-10-18", titular: "El parque abre sus puertas", url: "https://example.org/a",
      texto: "A las 8:30, Ana Torres llegó a Lima. La Municipalidad inauguró el parque para 200 personas.\nDespués, 100 personas participaron porque querían cuidar el barrio." },
    { tipo: "opciones", id: "quiz-secreto", etiqueta: "Comprensión", titulo: "PREGUNTA_NO_ENVIAR", opciones: ["RESPUESTA_NO_ENVIAR"], correcta: 0,
      bien: "BIEN_NO_ENVIAR", otra: "OTRA_NO_ENVIAR", habilidad: "evidencia" },
    { tipo: "fragmento", lado: "b", medio: "Medio B", fecha: "2026-10-18", titular: "Otra mirada al parque", url: "https://example.org/b",
      texto: "Ana Torres visitó Lima. El parque recibió a 200 personas, según los vecinos." },
    { tipo: "voz", id: "voz-secreta", etiqueta: "Reflexión", titulo: "VOZ_NO_ENVIAR", habilidad: "postura", pistas: ["PISTA_NO_ENVIAR"],
      privado: { criterios: [], respuestaModelo: "MODELO_PRIVADO_NO_ENVIAR", prohibido: ["CRITERIO_NO_ENVIAR"] } },
  ],
};

const article = {
  id: noticia.id, titular: noticia.titular, bajada: noticia.bajada, seccion: noticia.seccion,
  fragmentos: noticia.pasos.filter((p) => p.tipo === "fragmento").map((f) => ({
    lado: f.lado, medio: f.medio, fecha: f.fecha, titular: f.titular, texto: f.texto, url: f.url,
  })),
};

async function document(genero?: typeof GENEROS[number]) {
  return enrich(EnrichRequestSchema.parse({ article, ...(genero ? { options: { generoForzado: genero } } : {}) }), { llm: null });
}

beforeEach(() => {
  vi.stubEnv("READER_ENRICHER_URL", "");
  vi.stubEnv("READER_ENRICHER_TOKEN", "");
  vi.mocked(enrich).mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("enriched newspaper reading boundary", () => {
  it("works offline using deterministic enrichment without making a network request", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const doc = await getLecturaEnriquecida(noticia);
    expect(doc?.articulo.id).toBe(noticia.id);
    expect(doc?.meta.ia).toBe(false);
    expect(doc?.meta.avisos).toContain("llm_unavailable");
    expect(doc?.bloques.filter((b) => b.rol === "cuerpo").map((b) => b.texto)).toEqual(article.fragmentos.flatMap((f) => f.texto.split("\n")));
    expect(enrich).toHaveBeenLastCalledWith({ article }, { llm: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only selected article/fragment fields and keeps the service token server-side", async () => {
    const remote = await document(); vi.mocked(enrich).mockClear();
    const fetchMock = vi.fn().mockResolvedValue(Response.json(remote)); vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("READER_ENRICHER_URL", "https://reader.example.org/"); vi.stubEnv("READER_ENRICHER_TOKEN", "test-server-token");
    const result = await getLecturaEnriquecida(noticia);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://reader.example.org/v1/enrich");
    expect(JSON.parse(init.body)).toEqual({ article });
    expect(init.body).not.toMatch(/pasos|privado|NO_ENVIAR|correcta|criterios|miradas|minutos/);
    expect(init.headers.Authorization).toBe("Bearer test-server-token");
    expect(init.cache).toBe("no-store"); expect(init.redirect).toBe("error");
    expect(JSON.stringify(result)).not.toContain("test-server-token");
    expect(result?.bloques).toEqual(remote.bloques);
    expect(enrich).not.toHaveBeenCalled();
  });

  it.each(GENEROS)("accepts a valid %s document and its layout-specific schema", async (genero) => {
    const remote = await document(genero); vi.mocked(enrich).mockClear();
    vi.stubEnv("READER_ENRICHER_URL", "https://reader.example.org");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(remote)));
    expect((await getLecturaEnriquecida(noticia))?.layout).toEqual(remote.layout);
    expect(enrich).not.toHaveBeenCalled();
  });

  const corruptions: Array<[string, (doc: EnrichedDocument) => void]> = [
    ["article identity", (d) => { d.articulo.id = "another-news-story"; }],
    ["article title", (d) => { d.articulo.titular = "Inventado"; }],
    ["body text", (d) => { d.bloques.find((b) => b.rol === "cuerpo")!.texto = "Texto alterado"; }],
    ["missing blocks", (d) => { d.bloques.pop(); }],
    ["source URL", (d) => { d.bloques.find((b) => b.rol === "cuerpo")!.url = "https://example.org/invented"; }],
    ["layout payload", (d) => { d.layout.data = { unknown: true }; }],
    ["layout/genre mismatch", (d) => { d.layout.id = "pancarta"; }],
    ["unsupported version", (d) => { d.version = "999"; }],
    ["5W quote", (d) => { d.capas.cincoW.que!.texto = "Dato inventado"; }],
    ["out-of-range source", (d) => { d.capas.cincoW.que!.fuente.fin = 999999; }],
    ["unknown block reference", (d) => { d.spans.push({ tipo: "entidad", refId: "e0", bloqueId: "missing", inicio: 0, fin: 1 }); }],
    ["unknown annotation reference", (d) => { d.spans.push({ tipo: "entidad", refId: "missing", bloqueId: "h", inicio: 0, fin: 1 }); }],
    ["karaoke token", (d) => { d.capas.karaoke.bloques[0].tokens[0].texto = "Inventado"; }],
    ["fabricated timings", (d) => { d.capas.karaoke.bloques[0].tokens[0].startMs = 0; }],
  ];
  it.each(corruptions)("falls back locally rather than rendering an invalid remote %s", async (_, mutate) => {
    const remote = await document("informativa"); mutate(remote); vi.mocked(enrich).mockClear();
    vi.stubEnv("READER_ENRICHER_URL", "https://reader.example.org");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(remote)));
    const fallback = await getLecturaEnriquecida(noticia);
    expect(fallback?.articulo.id).toBe(noticia.id); expect(fallback?.meta.ia).toBe(false);
    expect(enrich).toHaveBeenCalledOnce();
    expect(fallback?.bloques).toEqual((await document()).bloques);
  });

  it.each(["http", "json", "network", "shape", "large"])("uses offline enrichment on %s failure", async (failure) => {
    vi.stubEnv("READER_ENRICHER_URL", "https://reader.example.org");
    const fetchMock = failure === "network" ? vi.fn().mockRejectedValue(new Error("unavailable"))
      : vi.fn().mockResolvedValue(failure === "http" ? new Response("Down", { status: 503 })
        : failure === "json" ? new Response("not json")
          : failure === "large" ? new Response("{}", { headers: { "content-length": "2000001" } }) : Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await getLecturaEnriquecida(noticia))?.meta.ia).toBe(false);
    expect(enrich).toHaveBeenCalledOnce();
  });

  it("bounds the whole remote request and aborts it before the local fallback", async () => {
    vi.useFakeTimers(); vi.stubEnv("READER_ENRICHER_URL", "https://reader.example.org");
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_, init) => { signal = init.signal; return new Promise(() => {}); }));
    const pending = getLecturaEnriquecida(noticia);
    await vi.advanceTimersByTimeAsync(4_000);
    expect((await pending)?.meta.ia).toBe(false); expect(signal?.aborted).toBe(true);
  });

  it("returns null for unusable input, so the existing plain reading stays available", async () => {
    expect(await getLecturaEnriquecida({ ...noticia, pasos: [] })).toBeNull();
    const oversized = { ...noticia, pasos: [{ ...article.fragmentos[0], tipo: "fragmento" as const, texto: "x".repeat(20_001) }] };
    expect(await getLecturaEnriquecida(oversized)).toBeNull(); expect(enrich).not.toHaveBeenCalled();
  });

  it("returns null if local enrichment also fails without leaking its error", async () => {
    vi.mocked(enrich).mockRejectedValueOnce(new Error("private internal error"));
    expect(await getLecturaEnriquecida(noticia)).toBeNull();
  });
});
