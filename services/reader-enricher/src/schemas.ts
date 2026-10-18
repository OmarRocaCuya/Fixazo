import { z } from "zod";

/** Hard cap on the total characters accepted per article (all fragments + titular + bajada). */
export const MAX_TEXT_CHARS = 20_000;
export const SCHEMA_VERSION = "1.0.0";

export const GENEROS = ["cronica", "opinion", "informativa", "datos", "entrevista", "comparada"] as const;
export const GeneroSchema = z.enum(GENEROS);

export const LAYOUT_IDS = ["timeline", "pancarta", "piramide", "datos", "dialogo", "comparada"] as const;
export const LayoutIdSchema = z.enum(LAYOUT_IDS);

// ---------- Request ----------

export const FragmentoInputSchema = z.object({
  lado: z.enum(["a", "b"]).optional(),
  medio: z.string().max(200).optional(),
  fecha: z.string().max(100).optional(),
  titular: z.string().max(500).optional(),
  texto: z.string().trim().min(1, "texto must not be empty"),
  url: z.string().max(2000).optional(),
});

export const ArticleInputSchema = z.object({
  id: z.string().max(200).optional(),
  titular: z.string().trim().min(1, "titular must not be empty").max(500),
  bajada: z.string().max(2000).optional(),
  seccion: z.string().max(200).optional(),
  fragmentos: z.array(FragmentoInputSchema).min(1, "at least one fragmento is required").max(50),
});

export const TimingSchema = z
  .object({
    tokenId: z.string().optional(),
    wordIndex: z.number().int().min(0).optional(),
    startMs: z.number().min(0),
    endMs: z.number().min(0),
  })
  .refine((t) => t.tokenId !== undefined || t.wordIndex !== undefined, {
    message: "timing needs tokenId or wordIndex",
  });

export const OptionsSchema = z.object({
  grado: z.number().int().min(1).max(11).optional(),
  idioma: z.literal("es").optional(),
  generoForzado: GeneroSchema.optional(),
  timings: z.array(TimingSchema).max(20_000).optional(),
});

export const EnrichRequestSchema = z.object({
  article: ArticleInputSchema,
  options: OptionsSchema.optional(),
});

// ---------- Shared response pieces ----------

/** Char offsets into `bloques[bloqueId].texto`. `fin` is exclusive. */
export const FuenteSchema = z.object({
  bloqueId: z.string(),
  inicio: z.number().int().min(0),
  fin: z.number().int().min(0),
});

/** A literal piece of the source text plus where it lives. */
export const CitaSchema = z.object({ texto: z.string(), fuente: FuenteSchema });

export const BloqueSchema = z.object({
  id: z.string(),
  rol: z.enum(["titular", "bajada", "cuerpo"]),
  fragmento: z.number().int().nullable(),
  lado: z.enum(["a", "b"]).nullable(),
  medio: z.string().nullable(),
  fecha: z.string().nullable(),
  url: z.string().nullable(),
  texto: z.string(),
});

export const GlosarioItemSchema = z.object({
  id: z.string(),
  termino: z.string(),
  definicion: z.string(),
  ejemplo: z.string(),
  fuente: FuenteSchema,
  apariciones: z.array(FuenteSchema),
});

export const ENTIDAD_TIPOS = ["persona", "lugar", "organizacion", "fecha", "numero", "otro"] as const;
export const EntidadTipoSchema = z.enum(ENTIDAD_TIPOS);

export const EntidadSchema = z.object({
  id: z.string(),
  texto: z.string(),
  tipo: EntidadTipoSchema,
  etiqueta: z.string(),
  contexto: z.string().nullable(),
  fuente: FuenteSchema,
  apariciones: z.array(FuenteSchema),
});

export const CincoWSchema = z.object({
  que: CitaSchema.nullable(),
  quien: CitaSchema.nullable(),
  cuando: CitaSchema.nullable(),
  donde: CitaSchema.nullable(),
  porque: CitaSchema.nullable(),
});

export const TokenSchema = z.object({
  id: z.string(),
  i: z.number().int(),
  texto: z.string(),
  inicio: z.number().int(),
  fin: z.number().int(),
  startMs: z.number().optional(),
  endMs: z.number().optional(),
});

export const KaraokeSchema = z.object({
  totalTokens: z.number().int(),
  conTiempos: z.boolean(),
  bloques: z.array(z.object({ bloqueId: z.string(), tokens: z.array(TokenSchema) })),
});

export const CifraSchema = z.object({
  id: z.string(),
  valor: z.number(),
  texto: z.string(),
  unidad: z.string(),
  etiqueta: z.string(),
  fuente: FuenteSchema,
});

export const VisualesSchema = z.object({
  timeline: z.array(z.object({ id: z.string(), fecha: CitaSchema, evento: CitaSchema })),
  cifras: z.array(
    z.object({
      id: z.string(),
      unidad: z.string(),
      max: z.number(),
      barras: z.array(CifraSchema.extend({ proporcion: z.number().min(0).max(1) })),
    }),
  ),
});

export const SpanSchema = z.object({
  bloqueId: z.string(),
  inicio: z.number().int(),
  fin: z.number().int(),
  tipo: z.enum(["glosario", "entidad"]),
  refId: z.string(),
});

export const MetaSchema = z.object({
  ia: z.boolean(),
  modelo: z.string().nullable(),
  generoConfianza: z.number().min(0).max(1),
  generoFuente: z.enum(["forzado", "ia", "heuristica"]),
  grado: z.number().int().nullable(),
  version: z.string(),
  descartados: z.number().int().min(0),
  avisos: z.array(z.string()),
});

export const EnrichedDocumentSchema = z.object({
  version: z.string(),
  articulo: z.object({
    id: z.string().nullable(),
    titular: z.string(),
    bajada: z.string().nullable(),
    seccion: z.string().nullable(),
  }),
  genero: GeneroSchema,
  layout: z.object({ id: LayoutIdSchema, nombre: z.string(), data: z.unknown() }),
  bloques: z.array(BloqueSchema),
  capas: z.object({
    glosario: z.array(GlosarioItemSchema),
    entidades: z.array(EntidadSchema),
    cincoW: CincoWSchema,
    karaoke: KaraokeSchema,
    visuales: VisualesSchema,
  }),
  spans: z.array(SpanSchema),
  meta: MetaSchema,
});

// ---------- LLM port output (validated before use) ----------

export const LlmAnalysisSchema = z.object({
  genero: GeneroSchema,
  confianza: z.number().min(0).max(1),
  tesis: z.string().nullable(),
  argumentos: z.array(z.string()).max(12),
  citasClave: z.array(z.string()).max(12),
  eventos: z.array(z.object({ ancla: z.string().nullable(), cita: z.string() })).max(30),
  turnos: z.array(z.object({ hablante: z.string(), rol: z.enum(["entrevistador", "entrevistado"]), cita: z.string() })).max(60),
  puntos: z
    .array(
      z.object({
        tema: z.string(),
        citaA: z.string().nullable(),
        citaB: z.string().nullable(),
        relacion: z.enum(["coincide", "difiere"]),
      }),
    )
    .max(20),
  glosario: z.array(z.object({ termino: z.string(), definicion: z.string(), ejemplo: z.string() })).max(20),
  entidades: z.array(z.object({ texto: z.string(), tipo: EntidadTipoSchema, contexto: z.string() })).max(40),
  cincoW: z.object({
    que: z.string().nullable(),
    quien: z.string().nullable(),
    cuando: z.string().nullable(),
    donde: z.string().nullable(),
    porque: z.string().nullable(),
  }),
});
