import { isTranslationInput, readTranslationJson, translatePublicTexts, TranslationError } from "@/lib/server/periodico-translation";

export const maxDuration = 25;
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const failure = (error: string, status: number) => Response.json({ error }, { status, headers: HEADERS });

/** Public UI/published text only. No access code, user answers or private rubric. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return failure("same-origin-required", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return failure("json-required", 415);
  let value: unknown;
  try { value = await readTranslationJson(request, 64 * 1024); }
  catch (error) { return failure("invalid-request", error instanceof TranslationError ? error.status : 400); }
  if (!isTranslationInput(value)) return failure("invalid-request", 422);
  try {
    const texts = await translatePublicTexts(request, value.language, value.texts);
    return Response.json({ language: value.language, texts }, { headers: HEADERS });
  } catch (error) {
    // Only allowlist/rate denials are public. No provider body, credentials or
    // private/participant text can leak through an exception string.
    if (error instanceof TranslationError && [422, 429].includes(error.status)) return failure(error.code, error.status);
    return failure("translation-unavailable", 503);
  }
}
