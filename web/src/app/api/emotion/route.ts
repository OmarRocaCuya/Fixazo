import { authorizeVoiceRequest } from "@/lib/server/voice-policy";
import { IndigenousProxyError, readIndigenousBody } from "@/lib/server/indigenous-proxy";
import { EmotionFallback, estimateEmotionWithBackend, getEmotionCapabilities, validateEmotionWav } from "@/lib/server/emotion-proxy";

// EXPERIMENTAL. Uses the same operator voice policy as any audio sent to the
// private Meta backend (configured mode, same origin, access code, rate limit).
// Any failure answers {fallback:true} for backward compatibility. It signals
// unavailability, not permission to invent an emotion from text or heuristics.
export const maxDuration = 45;
const HEADERS = { "Cache-Control": "no-store", Pragma: "no-cache" };
const MAX_REQUEST_BYTES = 1_010_000;

const fail = (error: string, status: number) => Response.json({ error, fallback: true }, { status, headers: HEADERS });

export async function GET(request: Request) {
  return Response.json(await getEmotionCapabilities(request.signal), { headers: HEADERS });
}

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) return fail("multipart-required", 415);
  try {
    const length = request.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) return fail("invalid-content-length", 400);
    if (Number(length ?? 0) > MAX_REQUEST_BYTES) return fail("request-too-large", 413);
    const raw = await readIndigenousBody(request.body, MAX_REQUEST_BYTES);
    let form: FormData;
    try {
      form = await new Response(raw as BodyInit, { headers: { "Content-Type": type } }).formData();
    } catch {
      return fail("invalid-request", 400);
    }
    if ([...form.keys()].some((key) => key !== "file" || form.getAll(key).length !== 1)) return fail("invalid-request", 400);
    const authorization = authorizeVoiceRequest(request, "meta");
    if (!authorization.ok) return fail(authorization.error, authorization.status);
    const file = form.get("file");
    if (!(file instanceof Blob)) return fail("invalid-request", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateEmotionWav(bytes);
    return Response.json(await estimateEmotionWithBackend(bytes, request.signal), { headers: HEADERS });
  } catch (error) {
    if (error instanceof EmotionFallback) return fail(error.code, error.status);
    if (error instanceof IndigenousProxyError) return fail(error.code, error.status);
    return fail("emotion-unavailable", 503);
  }
}
