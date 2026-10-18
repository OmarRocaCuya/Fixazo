// Optional Claude integration (server only). Used ONLY when ANTHROPIC_API_KEY is
// set; every caller falls back to the rule-based path on any error.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Grade, Level, Mission } from "../types";
import { aggregateRuns, buildJudgePrompt, sanitizeQuote, type JudgeRequest, type JudgeResponse } from "../judge/rubric";
import { GRADE_WORD_RANGE, validateMission } from "../mission/builder";

export const CLAUDE_MODEL = "claude-haiku-5-5";

export function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client(): Anthropic {
  return new Anthropic({ timeout: 25_000, maxRetries: 1 });
}

class ClaudeRefusal extends Error {}

function assertNotRefused(stop: string | null | undefined) {
  if (stop === "refusal") throw new ClaudeRefusal("Claude declined the request");
  if (stop === "max_tokens") throw new Error("Claude response was truncated");
}

// ---------------------------------------------------------------------------
// Judge: rubric-anchored, structured JSON, 3 runs
// ---------------------------------------------------------------------------

const JudgeSchema = z.object({
  level: z.enum(["0", "1", "2", "3", "NO"]),
  quote: z.string(),
  rationale: z.string(),
});

const toLevel = (s: z.infer<typeof JudgeSchema>["level"]): Level => (s === "NO" ? "NO" : (Number(s) as 0 | 1 | 2 | 3));

async function judgeOnce(req: JudgeRequest): Promise<{ level: Level; quote: string }> {
  const { system, user } = buildJudgePrompt(req);
  const response = await client().messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low", format: zodOutputFormat(JudgeSchema) },
  });
  assertNotRefused(response.stop_reason);
  const out = response.parsed_output;
  if (!out) throw new Error("Judge output did not match the schema");
  return { level: toLevel(out.level), quote: sanitizeQuote(out.quote, req.answer) };
}

export async function judgeWithClaude(req: JudgeRequest): Promise<JudgeResponse> {
  const runs = await Promise.all([judgeOnce(req), judgeOnce(req), judgeOnce(req)]);
  return { source: "ia", ...aggregateRuns(runs) };
}

// ---------------------------------------------------------------------------
// Mission generation from pasted text or a photo
// ---------------------------------------------------------------------------

const MissionSchema = z.object({
  readable: z.boolean(),
  unreadable_reason: z.string(),
  title: z.string(),
  text: z.string(),
  obtiene: z.object({ text: z.string(), simpler: z.string(), answer_primary: z.array(z.string()), answer_partial: z.array(z.string()) }),
  infiere: z.object({ text: z.string(), simpler: z.string(), evidence_keys: z.array(z.string()) }),
  reflexiona: z.object({ text: z.string(), simpler: z.string() }),
  counter: z.string(),
});

const MISSION_SYSTEM = `Preparas misiones de lectura en castellano (Perú, tuteo) para niños de primaria.
Con el material que te dan:
1. Escribe un texto de lectura fiel al material, adaptado al grado (sin inventar hechos).
2. Escribe 3 preguntas orales cortas: Obtiene (dato literal del texto), Infiere (por qué pasó algo; causa o intención), Reflexiona (opinión del niño: ¿estuvo bien?, ¿por qué?).
3. Para Obtiene, da las palabras de la respuesta (answer_primary) y respuestas parciales aceptables (answer_partial).
4. Para Infiere, da palabras del texto que sirven como evidencia de la causa (evidence_keys).
5. Escribe una contraprueba: un dato que rete la respuesta más probable a la pregunta Reflexiona, sin contradecir el texto.
6. Ninguna pregunta puede contener su propia respuesta. Da también una versión más simple de cada pregunta.
Si el material es una foto ilegible, pon readable=false y explica en unreadable_reason qué foto pedir (por ejemplo: "más luz", "sin sombra", "toda la página").`;

export type ImageInput = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

export type MissionLLMResult = { ok: true; mission: Mission } | { ok: false; unreadable: boolean; error: string };

export async function generateMissionWithClaude({
  text,
  image,
  grade,
}: {
  text?: string;
  image?: ImageInput;
  grade: Grade;
}): Promise<MissionLLMResult> {
  const [min, max] = GRADE_WORD_RANGE[grade];
  const content: Anthropic.ContentBlockParam[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
  content.push({
    type: "text",
    text: `${text ? `<material>\n${text}\n</material>\n\n` : ""}Grado: ${grade}.º de primaria. El texto de lectura debe tener entre ${min} y ${max} palabras.`,
  });
  const response = await client().messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system: MISSION_SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: zodOutputFormat(MissionSchema) },
  });
  assertNotRefused(response.stop_reason);
  const out = response.parsed_output;
  if (!out) throw new Error("Mission output did not match the schema");
  if (!out.readable) return { ok: false, unreadable: true, error: out.unreadable_reason || "No pude leer bien la foto." };

  const mission: Mission = {
    id: `m-llm-${Date.now().toString(36)}`,
    title: out.title.trim() || "Lectura",
    lang: "es",
    grade,
    text: out.text.trim(),
    questions: [
      { id: "o", kind: "obtiene", text: out.obtiene.text, simpler: out.obtiene.simpler, answerKey: { primary: out.obtiene.answer_primary, partial: out.obtiene.answer_partial } },
      { id: "i", kind: "infiere", text: out.infiere.text, simpler: out.infiere.simpler, evidenceKeys: out.infiere.evidence_keys },
      { id: "r", kind: "reflexiona", text: out.reflexiona.text, simpler: out.reflexiona.simpler },
    ],
    counter: { text: out.counter.trim() },
    source: "llm",
    createdAt: new Date().toISOString(),
  };
  const v = validateMission(mission);
  if (!v.valid) return { ok: false, unreadable: false, error: v.errors.join(" ") };
  return { ok: true, mission };
}

export function describeError(e: unknown): string {
  if (e instanceof ClaudeRefusal) return "refusal";
  if (e instanceof Anthropic.AuthenticationError) return "auth";
  if (e instanceof Anthropic.RateLimitError) return "rate_limit";
  if (e instanceof Anthropic.APIConnectionError) return "connection";
  if (e instanceof Anthropic.APIError) return `api_${e.status ?? "error"}`;
  return "error";
}
