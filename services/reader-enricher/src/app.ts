import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { LruCache, cacheKey } from "./cache.ts";
import { SAMPLES } from "./demo/samples.ts";
import { enrich } from "./enrich.ts";
import { catalog } from "./layouts/index.ts";
import type { LlmPort } from "./llm/port.ts";
import { EnrichRequestSchema, MAX_TEXT_CHARS, SCHEMA_VERSION } from "./schemas.ts";
import type { EnrichedDocument } from "./types.ts";

export interface AppConfig {
  llm: LlmPort | null;
  /** When set, POST /v1/enrich requires `Authorization: Bearer <token>`. */
  token?: string;
  /** Allowed CORS origins; ["*"] allows any. Empty = no CORS headers. */
  allowedOrigins?: string[];
  cacheSize?: number;
}

const MAX_BODY_BYTES = 512 * 1024;

function loadDemoPage(): string {
  try {
    return readFileSync(new URL("./demo/page.html", import.meta.url), "utf8");
  } catch {
    return "<!doctype html><title>Demo</title><p>Demo page not found (build did not copy src/demo/page.html). Use POST /v1/enrich.</p>";
  }
}

function errorBody(code: string, message: string, issues?: Array<{ path: string; message: string }>) {
  return { error: { code, message, ...(issues ? { issues } : {}) } };
}

function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp(config: AppConfig) {
  const app = new Hono();
  const cache = new LruCache<EnrichedDocument>(config.cacheSize ?? 200);
  // Concurrent identical requests share one enrichment (one paid LLM call).
  const inFlight = new Map<string, Promise<EnrichedDocument>>();
  const demoHtml = loadDemoPage();
  const origins = config.allowedOrigins ?? [];

  if (origins.length) {
    app.use(
      "*",
      cors({
        origin: origins.includes("*") ? "*" : (origin) => (origins.includes(origin) ? origin : null),
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
        exposeHeaders: ["X-Cache"],
        maxAge: 600,
      }),
    );
  }

  app.get("/health", (c) => c.json({ ok: true, ia: config.llm !== null, version: SCHEMA_VERSION }));

  app.get("/v1/layouts", (c) => c.json({ layouts: catalog() }));

  app.post("/v1/enrich", async (c: Context) => {
    if (config.token) {
      const auth = c.req.header("authorization") ?? "";
      const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!sameToken(given, config.token)) return c.json(errorBody("UNAUTHORIZED", "Missing or invalid bearer token."), 401);
    }
    const length = Number(c.req.header("content-length") ?? 0);
    if (length > MAX_BODY_BYTES) return c.json(errorBody("PAYLOAD_TOO_LARGE", `Body exceeds ${MAX_BODY_BYTES} bytes.`), 413);

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json(errorBody("INVALID_JSON", "Request body must be valid JSON."), 400);
    }
    const parsed = EnrichRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
      return c.json(errorBody("INVALID_INPUT", "The request does not match the expected shape.", issues), 422);
    }
    const a = parsed.data.article;
    const total =
      a.titular.length + (a.bajada?.length ?? 0) + a.fragmentos.reduce((n, f) => n + f.texto.length + (f.titular?.length ?? 0), 0);
    if (total > MAX_TEXT_CHARS) {
      return c.json(errorBody("TEXT_TOO_LONG", `Article text exceeds ${MAX_TEXT_CHARS} characters (got ${total}).`), 422);
    }

    const key = cacheKey(parsed.data);
    const hit = cache.get(key);
    if (hit) {
      c.header("X-Cache", "hit");
      return c.json(hit);
    }
    let pending = inFlight.get(key);
    if (!pending) {
      pending = enrich(parsed.data, { llm: config.llm })
        .then((doc) => {
          // Only cache AI results or deterministic ones; a failed LLM call should be retried later.
          if (!config.llm || doc.meta.ia) cache.set(key, doc);
          return doc;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    const doc = await pending;
    c.header("X-Cache", "miss");
    return c.json(doc);
  });

  app.get("/demo", (c) => c.html(demoHtml));
  app.get("/demo/samples.json", (c) => c.json(SAMPLES));
  app.get("/", (c) => c.redirect("/demo"));

  app.notFound((c) => c.json(errorBody("NOT_FOUND", "Route not found."), 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json(errorBody("INTERNAL", "Unexpected error."), 500);
  });
  return app;
}
