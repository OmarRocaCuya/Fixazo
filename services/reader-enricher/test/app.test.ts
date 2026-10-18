import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { LruCache, cacheKey } from "../src/cache.ts";
import type { LlmPort } from "../src/llm/port.ts";
import { MAX_TEXT_CHARS } from "../src/schemas.ts";
import { sample } from "./helpers.ts";

const post = (app: ReturnType<typeof createApp>, body: unknown, headers: Record<string, string> = {}) =>
  app.request("/v1/enrich", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("LRU cache", () => {
  it("evicts the least recently used entry", () => {
    const c = new LruCache<number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a");
    c.set("c", 3);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
  });

  it("hashes equal inputs to the same key", () => {
    expect(cacheKey({ a: 1 })).toBe(cacheKey({ a: 1 }));
    expect(cacheKey({ a: 1 })).not.toBe(cacheKey({ a: 2 }));
  });
});

describe("HTTP API", () => {
  const app = createApp({ llm: null });

  it("GET /health", async () => {
    const r = await app.request("/health");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, ia: false });
  });

  it("GET /v1/layouts returns the catalog", async () => {
    const body = (await (await app.request("/v1/layouts")).json()) as { layouts: unknown[] };
    expect(body.layouts).toHaveLength(6);
  });

  it("POST /v1/enrich returns an enriched document and caches it", async () => {
    const payload = { article: sample("datos-agua") };
    const r1 = await post(app, payload);
    expect(r1.status).toBe(200);
    expect(r1.headers.get("x-cache")).toBe("miss");
    const doc = (await r1.json()) as { genero: string; layout: { id: string } };
    expect(doc.genero).toBe("datos");
    const r2 = await post(app, payload);
    expect(r2.headers.get("x-cache")).toBe("hit");
  });

  it("does not call the LLM twice for the same input", async () => {
    let calls = 0;
    const analysis = {
      genero: "cronica" as const,
      confianza: 0.9,
      tesis: null,
      argumentos: [],
      citasClave: [],
      eventos: [],
      turnos: [],
      puntos: [],
      glosario: [],
      entidades: [],
      cincoW: { que: null, quien: null, cuando: null, donde: null, porque: null },
    };
    const llm: LlmPort = { modelo: "m", analyze: async () => (calls++, analysis) };
    const a = createApp({ llm });
    await post(a, { article: sample("cronica-puente") });
    await post(a, { article: sample("cronica-puente") });
    expect(calls).toBe(1);
  });

  it("shares one in-flight LLM call between concurrent identical requests", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const llm: LlmPort = { modelo: "m", analyze: async () => { calls++; await gate; return null; } };
    const a = createApp({ llm });
    const pending = Promise.all([post(a, { article: sample("cronica-puente") }), post(a, { article: sample("cronica-puente") })]);
    await new Promise((r) => setTimeout(r, 10));
    release();
    const [r1, r2] = await pending;
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(calls).toBe(1);
    // A failed call is still not cached once settled.
    await post(a, { article: sample("cronica-puente") });
    expect(calls).toBe(2);
  });

  it("does not cache a failed LLM call (retries next time)", async () => {
    let calls = 0;
    const llm: LlmPort = { modelo: "m", analyze: async () => (calls++, null) };
    const a = createApp({ llm });
    const r = await post(a, { article: sample("cronica-puente") });
    expect(((await r.json()) as { meta: { ia: boolean } }).meta.ia).toBe(false);
    await post(a, { article: sample("cronica-puente") });
    expect(calls).toBe(2);
  });

  it("422 with clear codes on invalid input", async () => {
    const bad = await post(app, { article: { titular: "", fragmentos: [] } });
    expect(bad.status).toBe(422);
    const body = (await bad.json()) as { error: { code: string; issues: Array<{ path: string }> } };
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(body.error.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["article.titular", "article.fragmentos"]));

    const long = await post(app, { article: { titular: "x", fragmentos: [{ texto: "a".repeat(MAX_TEXT_CHARS + 1) }] } });
    expect(long.status).toBe(422);
    expect(((await long.json()) as { error: { code: string } }).error.code).toBe("TEXT_TOO_LONG");

    const genre = await post(app, { article: sample("datos-agua"), options: { generoForzado: "poema" } });
    expect(genre.status).toBe(422);
  });

  it("400 on malformed JSON", async () => {
    const r = await post(app, "{nope");
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("INVALID_JSON");
  });

  it("bearer auth when SERVICE_TOKEN is set", async () => {
    const secured = createApp({ llm: null, token: "s3cret" });
    expect((await post(secured, { article: sample("datos-agua") })).status).toBe(401);
    expect((await post(secured, { article: sample("datos-agua") }, { authorization: "Bearer wrong" })).status).toBe(401);
    expect((await post(secured, { article: sample("datos-agua") }, { authorization: "Bearer s3cret" })).status).toBe(200);
    expect((await secured.request("/health")).status).toBe(200);
  });

  it("CORS allows only configured origins", async () => {
    const a = createApp({ llm: null, allowedOrigins: ["https://app.example"] });
    const ok = await a.request("/v1/layouts", { headers: { origin: "https://app.example" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://app.example");
    const no = await a.request("/v1/layouts", { headers: { origin: "https://evil.example" } });
    expect(no.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("serves the demo page and samples", async () => {
    const page = await app.request("/demo");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toContain("/v1/enrich");
    const samples = (await (await app.request("/demo/samples.json")).json()) as unknown[];
    expect(samples.length).toBeGreaterThanOrEqual(6);
  });
});
