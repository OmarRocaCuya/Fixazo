import { connection } from "next/server";
import { judgeWithRules, parseJudgeRequest } from "@/lib/judge/rubric";
import { CLAUDE_MODEL, describeError, hasClaudeKey, judgeWithClaude } from "@/lib/server/claude";
import { tokenize } from "@/lib/signals/text";

/** Reports which judge is active. */
export async function GET() {
  await connection();
  const llm = hasClaudeKey();
  return Response.json({ mode: llm ? "ia" : "reglas", model: llm ? CLAUDE_MODEL : null, runs: llm ? 3 : 0 });
}

/**
 * Scores an Infiere / Reflexiona answer. Rule-based by default; with
 * ANTHROPIC_API_KEY it runs Claude 3 times and marks disagreement as "dudoso".
 * Any error falls back to the rules.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El cuerpo debe ser JSON." }, { status: 400 });
  }
  const req = parseJudgeRequest(body);
  if (!req) return Response.json({ error: "Solicitud inválida." }, { status: 400 });

  if (!hasClaudeKey() || tokenize(req.answer).length === 0) return Response.json(judgeWithRules(req));
  try {
    return Response.json(await judgeWithClaude(req));
  } catch (e) {
    return Response.json(judgeWithRules(req, describeError(e)));
  }
}
