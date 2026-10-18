# reader-enricher

A small, self-contained HTTP service that turns extracted news text into an **enriched reading document**: a JSON payload that a frontend renders as an interactive, genre-aware reading experience for students aged 12–16.

It is **not** a quiz generator. It classifies the article's genre, picks a layout that fits it, and adds layers that help students read: glossary, entities ("¿Quién es?"), the 5W, word-level karaoke tokens and inline mini-visuals.

- Hono on Node 22, TypeScript, zod 4 for request/response validation.
- One optional LLM call (OpenRouter, `anthropic/claude-haiku-5.5`) behind a port. Without an API key, or when the call fails, times out or returns invalid JSON, a deterministic fallback produces the full document anyway.
- **Anti-hallucination by construction:** every entity, term, quote, figure and 5W answer carries `fuente: { bloqueId, inicio, fin }` and is checked against the source text. Anything the guard cannot find literally is dropped and counted in `meta.descartados`.

## Genre → layout

| Genre (`genero`) | Detected by (fallback heuristic) | Layout (`layout.id`) | What the reader sees |
|---|---|---|---|
| `cronica` | paragraphs opening with time anchors ("A las 8:30", "2 de marzo de 2026") | `timeline` | Vertical timeline; each event shows its time anchor and the paragraphs it covers |
| `opinion` | first-person / opinion markers ("creo que", "debemos", "es necesario") | `pancarta` | Thesis as a banner, arguments as cards, key quotes highlighted |
| `informativa` | default | `piramide` | 5W header, then blocks by importance (essential → details → context) |
| `datos` | high digit density | `datos` | Big stat cards plus mini bar charts for figures with the same unit |
| `entrevista` | lines starting with "—", "P:" / "R:" with questions | `dialogo` | Chat bubbles with speaker labels |
| `comparada` | fragments with both `lado: "a"` and `lado: "b"` | `comparada` | Two side-by-side columns plus matched points (coinciden / difieren) |

Priority: `options.generoForzado` → LLM genre (if `confianza ≥ 0.5`) → heuristic. `comparada` is only accepted when both sides are present.

## Layers (always computed)

| Layer | Source | Notes |
|---|---|---|
| `glosario` | LLM only (empty without it) | Term must appear literally (whole word); definitions shortened for lower grades; every occurrence is a span |
| `entidades` | LLM + regex | Persons, places, organizations, dates, figures. `etiqueta` is the card question ("¿Quién es?", "¿Dónde queda?"…) |
| `cincoW` | LLM or heuristic | `que`, `quien`, `cuando`, `donde`, `porque`; each is a literal quote or `null` (never invented) |
| `karaoke` | Deterministic | Word tokens with stable ids (`<bloqueId>-<n>`), global index `i` and char offsets; `options.timings` are merged in |
| `visuales` | Deterministic | `timeline` (dated events) and `cifras` (same-unit figures as bar data). Values are parsed from literal text only |

`spans` is a flat, non-overlapping list of `{ bloqueId, inicio, fin, tipo, refId }` ranges for underlining glossary terms and entities.

All offsets refer to `bloques[].texto`. Block ids: `h` (titular), `s` (bajada), `f{n}t` (fragment titular), `f{n}p{m}` (paragraph `m` of fragment `n`).

## API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ ok, ia, version }` |
| GET | `/v1/layouts` | Layout catalog for the UI: `{ layouts: [{ id, nombre, descripcion, generos }] }` |
| POST | `/v1/enrich` | Article → `EnrichedDocument` (header `X-Cache: hit\|miss`) |
| GET | `/demo` | Static demo page (vanilla JS) with 6 fictional sample articles |
| GET | `/demo/samples.json` | The sample articles |

### Request

The `article` shape matches the newspaper types on the `periodico` branch (`Noticia` + `Fragmento`), so a `Noticia` can be sent after picking its fragments.

```json
{
  "article": {
    "id": "comparada-parque",
    "titular": "Dos medios cuentan el cierre del parque Los Olivos",
    "bajada": "Mismo hecho, dos miradas.",
    "seccion": "Ciudad",
    "fragmentos": [
      { "lado": "a", "medio": "El Vecino", "fecha": "5 de septiembre de 2026", "titular": "…", "texto": "…", "url": "https://…" },
      { "lado": "b", "medio": "La Voz del Barrio", "texto": "…" }
    ]
  },
  "options": {
    "grado": 8,
    "idioma": "es",
    "generoForzado": "comparada",
    "timings": [{ "tokenId": "f0p0-3", "startMs": 1200, "endMs": 1480 }, { "wordIndex": 4, "startMs": 1480, "endMs": 1700 }]
  }
}
```

`grado` is the school grade 1–11 (Peru: 1–6 primaria, 7–11 secundaria; default 8). Total text is capped at 20 000 characters.

### Response (trimmed)

```json
{
  "version": "1.0.0",
  "articulo": { "id": null, "titular": "Abren biblioteca en Villa Alegre", "bajada": null, "seccion": null },
  "genero": "informativa",
  "layout": {
    "id": "piramide",
    "nombre": "Pirámide invertida",
    "data": {
      "encabezado": "cincoW",
      "lead": { "texto": "La asociación de vecinos inauguró …", "fuente": { "bloqueId": "f0p0", "inicio": 0, "fin": 115 } },
      "niveles": [{ "importancia": 1, "etiqueta": "Lo esencial", "bloqueIds": ["f0p0"] }]
    }
  },
  "bloques": [{ "id": "f0p0", "rol": "cuerpo", "fragmento": 0, "lado": null, "medio": "Noticias", "fecha": null, "url": null, "texto": "La asociación de vecinos inauguró el 20 de abril de 2026 una biblioteca porque muchos estudiantes no tenían libros." }],
  "capas": {
    "glosario": [],
    "entidades": [{ "id": "e0", "texto": "20 de abril de 2026", "tipo": "fecha", "etiqueta": "¿Cuándo?", "contexto": "…", "fuente": { "bloqueId": "f0p0", "inicio": 37, "fin": 56 }, "apariciones": ["…"] }],
    "cincoW": {
      "que": { "texto": "La asociación de vecinos inauguró …", "fuente": { "bloqueId": "f0p0", "inicio": 0, "fin": 115 } },
      "quien": null,
      "cuando": { "texto": "20 de abril de 2026", "fuente": { "bloqueId": "f0p0", "inicio": 37, "fin": 56 } },
      "donde": null,
      "porque": { "texto": "muchos estudiantes no tenían libros", "fuente": { "bloqueId": "f0p0", "inicio": 79, "fin": 114 } }
    },
    "karaoke": { "totalTokens": 24, "conTiempos": false, "bloques": [{ "bloqueId": "h", "tokens": [{ "id": "h-0", "i": 0, "texto": "Abren", "inicio": 0, "fin": 5 }] }] },
    "visuales": { "timeline": [{ "id": "t0", "fecha": { "texto": "20 de abril de 2026", "fuente": "…" }, "evento": { "texto": "…", "fuente": "…" } }], "cifras": [] }
  },
  "spans": [{ "bloqueId": "f0p0", "inicio": 37, "fin": 56, "tipo": "entidad", "refId": "e0" }],
  "meta": { "ia": false, "modelo": null, "generoConfianza": 0.5, "generoFuente": "heuristica", "grado": 8, "version": "1.0.0", "descartados": 0, "avisos": ["llm_unavailable"] }
}
```

`meta.avisos` codes: `llm_unavailable` (no API key), `llm_failed` (error, timeout or invalid JSON → fallback used), `timings_ignored:<n>`.

### Errors

| Status | `error.code` | When |
|---|---|---|
| 400 | `INVALID_JSON` | Body is not JSON |
| 401 | `UNAUTHORIZED` | `SERVICE_TOKEN` set and bearer missing/wrong |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 512 KB |
| 422 | `INVALID_INPUT` | Schema mismatch; `error.issues[]` has `path` + `message` |
| 422 | `TEXT_TOO_LONG` | Article text over 20 000 chars |

## Run

```bash
cd services/reader-enricher
cp .env.example .env        # optional: OPENROUTER_API_KEY, SERVICE_TOKEN, ALLOWED_ORIGINS
npm install
npm run dev                 # http://localhost:8787/demo
npm test                    # vitest
npm run build && npm start  # production
docker build -t reader-enricher . && docker run -p 8787:8787 --env-file .env reader-enricher
```

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | HTTP port |
| `OPENROUTER_API_KEY` | – | Enables the LLM; without it the deterministic path is used |
| `OPENROUTER_MODEL` | `anthropic/claude-haiku-5.5` | Model override |
| `OPENROUTER_TIMEOUT_MS` | `25000` | LLM deadline; on timeout the deterministic path is returned (and not cached) |
| `ALLOWED_ORIGINS` | – | Comma-separated CORS allow-list (`*` for any) |
| `SERVICE_TOKEN` | – | Requires `Authorization: Bearer <token>` on `/v1/enrich` |
| `CACHE_SIZE` | `200` | In-memory LRU entries (key = sha256 of article + options). Failed-LLM results are not cached |

## Integrate into the Next.js app (3 steps)

1. **Configure.** Add `READER_ENRICHER_URL=http://localhost:8787` (and `READER_ENRICHER_TOKEN` if you set `SERVICE_TOKEN`) to `web/.env.local`.
2. **Call it server-side** from a route handler, so the token never reaches the browser. `src/client.ts` only needs `fetch`; its types come from `src/types.ts`, which infers them from the zod schemas (`schemas.ts`, `layouts/*.ts`). Either copy `src/` (without `app.ts`/`server.ts`) into `web/src/lib/reader-enricher/` (zod 4 is already a dependency of `web/`), or point a tsconfig path alias at `services/reader-enricher/src`:

   ```ts
   // web/src/app/api/lectura/[id]/route.ts
   import "server-only";
   import { createEnricherClient } from "@/lib/reader-enricher/client";
   import { obtenerNoticia } from "@/lib/periodico/noticias"; // your data source

   const enricher = createEnricherClient({
     baseUrl: process.env.READER_ENRICHER_URL!,
     token: process.env.READER_ENRICHER_TOKEN,
   });

   export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
     const noticia = obtenerNoticia((await params).id);
     const fragmentos = noticia.pasos.filter((p) => p.tipo === "fragmento");
     const doc = await enricher.enrich(
       { id: noticia.id, titular: noticia.titular, bajada: noticia.bajada, seccion: noticia.seccion, fragmentos },
       { grado: 8 },
     );
     return Response.json(doc);
   }
   ```
3. **Render.** Switch on `doc.layout.id` to pick a component (`TimelineData`, `PancartaData`, … are exported types), render each block from `doc.bloques[].texto` slicing by `doc.spans` (glossary/entity buttons) and `doc.capas.karaoke` tokens (`data-token-id` for highlighting). `src/demo/page.html` is a complete, dependency-free reference renderer for all six layouts, popovers and karaoke.

## Add a new layout

1. Create `src/layouts/<name>.ts` exporting a `LayoutDef`: `id`, Spanish `nombre`/`descripcion`, the `generos` it serves, a zod `schema` for its `data`, and `build(ctx)` that returns `{ data, descartados }`. Ground every quote with `locate()` from `src/guards/grounding.ts` and drop what it cannot find.
2. Add the id to `LAYOUT_IDS` (and the genre to `GENEROS`, if new) in `src/schemas.ts`, and list the def in `LAYOUTS` in `src/layouts/index.ts`.
3. If the LLM should help, add a hint field to `LlmAnalysisSchema` and one line to the system prompt in `src/llm/prompt.ts`; the JSON schema sent to the model is derived from the zod schema.
4. Add a fixture to `src/demo/samples.ts` and a renderer in `page.html`; the layout tests iterate over the registry.

## Layout of the code

```
src/
  app.ts            HTTP adapter (Hono): validation, auth, CORS, cache
  server.ts         Composition root (env → adapters → app)
  enrich.ts         Use case: article → EnrichedDocument
  blocks.ts, text.ts
  genre/            heuristics.ts (fallback classifier), classify.ts (forced > LLM > heuristic)
  layouts/          registry + one file per layout (schema + builder)
  layers/           glossary, entities, fiveW, karaoke, visuals, spans
  guards/           grounding.ts (literal-substring guard)
  llm/              port.ts, openrouter.ts (adapter), prompt.ts
  client.ts         Typed fetch client for consumers
  demo/             page.html (vanilla renderer) + samples.ts (fictional fixtures)
```

## Limitations

- Heuristic genre/entity detection is tuned for Spanish news and is intentionally conservative; the glossary is only available with the LLM.
- Entity `contexto` from the LLM is generated text (the prompt restricts it to the article); the entity itself is grounded, the explanation is not literal.
- The cache is per-process and in memory.
- Browser karaoke depends on `speechSynthesis` boundary events; engines that do not emit them fall back to a fixed pace (or to `startMs/endMs` when timings were provided).
