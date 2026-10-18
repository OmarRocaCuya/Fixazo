import { LlmAnalysisSchema } from "../schemas.ts";
import type { LlmAnalysis } from "../types.ts";
import type { LlmInput, LlmPort } from "./port.ts";
import { SYSTEM_PROMPT, buildUserMessage, responseJsonSchema } from "./prompt.ts";

export const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** Logs why the call fell back (never the key or the article), then signals fallback. */
function fail(reason: string, detail = ""): null {
  console.warn(`[reader-enricher] llm fallback: ${reason}${detail ? ` (${detail})` : ""}`);
  return null;
}

export interface OpenRouterOptions {
  apiKey: string | undefined;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** OpenRouter adapter (mirrors the repo's lib/llm.js). Returns null when there is no API key. */
export function createOpenRouterAdapter(opts: OpenRouterOptions): LlmPort | null {
  if (!opts.apiKey) return null;
  const apiKey = opts.apiKey;
  const modelo = opts.model || DEFAULT_MODEL;
  // Real articles take ~5–15 s; callers fall back on their own deadline and the result is cached for the next read.
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const doFetch = opts.fetchImpl ?? fetch;
  const schema = responseJsonSchema();

  return {
    modelo,
    async analyze(input: LlmInput): Promise<LlmAnalysis | null> {
      try {
        const r = await doFetch(ENDPOINT, {
          method: "POST",
          signal: AbortSignal.timeout(timeoutMs),
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelo,
            // Haiku does not accept temperature with require_parameters; reasoning off keeps latency low.
            reasoning: { enabled: false },
            max_tokens: 3000,
            provider: { require_parameters: true },
            response_format: { type: "json_schema", json_schema: { name: "enriquecimiento", strict: true, schema } },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: buildUserMessage(input) },
            ],
          }),
        });
        if (!r.ok) return fail(`http_${r.status}`, (await r.text().catch(() => "")).slice(0, 200));
        const body = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = body.choices?.[0]?.message?.content;
        if (!content) return fail("empty_content");
        const parsed = LlmAnalysisSchema.safeParse(JSON.parse(content));
        if (!parsed.success) return fail("schema_mismatch", parsed.error.issues.slice(0, 3).map((i) => i.path.join(".")).join(", "));
        return parsed.data;
      } catch (err) {
        return fail(err instanceof Error ? err.name : "unknown_error");
      }
    },
  };
}
