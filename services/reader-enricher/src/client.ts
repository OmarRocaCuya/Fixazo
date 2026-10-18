/**
 * Tiny typed client for the reader-enricher service. Dependency-free (only `fetch`),
 * so it can be imported or copied into the Next.js app. Call it server-side only
 * (route handler / server component) to keep SERVICE_TOKEN secret.
 */
import type { ArticleInput, EnrichOptions, EnrichedDocument } from "./types.ts";

export type {
  ArticleInput,
  Bloque,
  Cita,
  CincoW,
  ComparadaData,
  DatosData,
  DialogoData,
  EnrichOptions,
  EnrichedDocument,
  Entidad,
  Fuente,
  Genero,
  GlosarioItem,
  Karaoke,
  LayoutId,
  PancartaData,
  PiramideData,
  Span,
  TimelineData,
  Timing,
  Token,
  Visuales,
} from "./types.ts";

export interface ClientConfig {
  /** e.g. process.env.READER_ENRICHER_URL */
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class EnricherError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "EnricherError";
  }
}

export function createEnricherClient(config: ClientConfig) {
  const base = config.baseUrl.replace(/\/+$/, "");
  const doFetch = config.fetchImpl ?? fetch;
  return {
    async enrich(article: ArticleInput, options?: EnrichOptions): Promise<EnrichedDocument> {
      const r = await doFetch(`${base}/v1/enrich`, {
        method: "POST",
        signal: AbortSignal.timeout(config.timeoutMs ?? 15_000),
        headers: {
          "Content-Type": "application/json",
          ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        },
        body: JSON.stringify({ article, options }),
      });
      const body = (await r.json().catch(() => null)) as
        | EnrichedDocument
        | { error?: { code: string; message: string; issues?: Array<{ path: string; message: string }> } }
        | null;
      if (!r.ok) {
        const e = body && "error" in body ? body.error : undefined;
        throw new EnricherError(r.status, e?.code ?? "HTTP_ERROR", e?.message ?? `HTTP ${r.status}`, e?.issues);
      }
      return body as EnrichedDocument;
    },
  };
}

/** Convenience one-shot call: `enrich(article, options, { baseUrl })`. */
export function enrich(article: ArticleInput, options: EnrichOptions | undefined, config: ClientConfig) {
  return createEnricherClient(config).enrich(article, options);
}
