import type { z } from "zod";
import type {
  ArticleInputSchema,
  BloqueSchema,
  CincoWSchema,
  CitaSchema,
  CifraSchema,
  EnrichRequestSchema,
  EnrichedDocumentSchema,
  EntidadSchema,
  EntidadTipoSchema,
  FuenteSchema,
  GeneroSchema,
  GlosarioItemSchema,
  KaraokeSchema,
  LayoutIdSchema,
  LlmAnalysisSchema,
  MetaSchema,
  OptionsSchema,
  SpanSchema,
  TimingSchema,
  TokenSchema,
  VisualesSchema,
} from "./schemas.ts";

export type Genero = z.infer<typeof GeneroSchema>;
export type LayoutId = z.infer<typeof LayoutIdSchema>;
export type ArticleInput = z.input<typeof ArticleInputSchema>;
export type EnrichOptions = z.input<typeof OptionsSchema>;
export type EnrichRequest = z.input<typeof EnrichRequestSchema>;
export type Timing = z.infer<typeof TimingSchema>;
export type Fuente = z.infer<typeof FuenteSchema>;
export type Cita = z.infer<typeof CitaSchema>;
export type Bloque = z.infer<typeof BloqueSchema>;
export type GlosarioItem = z.infer<typeof GlosarioItemSchema>;
export type EntidadTipo = z.infer<typeof EntidadTipoSchema>;
export type Entidad = z.infer<typeof EntidadSchema>;
export type CincoW = z.infer<typeof CincoWSchema>;
export type Token = z.infer<typeof TokenSchema>;
export type Karaoke = z.infer<typeof KaraokeSchema>;
export type Cifra = z.infer<typeof CifraSchema>;
export type Visuales = z.infer<typeof VisualesSchema>;
export type Span = z.infer<typeof SpanSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type EnrichedDocument = z.infer<typeof EnrichedDocumentSchema>;
export type LlmAnalysis = z.infer<typeof LlmAnalysisSchema>;

export type { TimelineData } from "./layouts/timeline.ts";
export type { PancartaData } from "./layouts/pancarta.ts";
export type { PiramideData } from "./layouts/piramide.ts";
export type { DatosData } from "./layouts/datos.ts";
export type { DialogoData } from "./layouts/dialogo.ts";
export type { ComparadaData } from "./layouts/comparada.ts";
