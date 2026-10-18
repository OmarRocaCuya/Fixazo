import { createHash, timingSafeEqual } from "node:crypto";

// Per-instance abuse guard only: this is NOT a distributed quota or a spending
// cap. Configure a provider budget before enabling even the private adult demo.
const WINDOW_MS = 10 * 60 * 1000;
const CREDENTIAL_LIMIT = 12;
const IP_LIMIT = 6;
const buckets = new Map<string, { count: number; resetAt: number }>();
let active = false;

export function getPeriodicoPolicy() {
  let reason: string | null = null;
  if (process.env.PERIODICO_JUDGE_ENABLED !== "true") reason = "periodico-judge-disabled";
  else if (!process.env.OPENROUTER_API_KEY?.trim()) reason = "periodico-provider-not-configured";
  else if (!process.env.VOICE_ACCESS_CODE || process.env.VOICE_ACCESS_CODE.trim().length < 16) reason = "periodico-access-not-configured";
  return { enabled: reason === null, reason, adultOnly: true as const };
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Run before reading a body. Never accept the private code in JSON or a URL. */
export function preflightPeriodicoRequest(request: Request): { status: number; error: string } | null {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return { status: 403, error: "same-origin-required" };
  }
  const supplied = request.headers.get("x-voice-access-code") ?? "";
  const expected = process.env.VOICE_ACCESS_CODE ?? "";
  if (supplied.length > 256 || !timingSafeEqual(digest(supplied), digest(expected))) {
    return { status: 401, error: "voice-access-required" };
  }
  return null;
}

/** Reserve one judge (at most three fixed model calls), then release in finally. */
export function reservePeriodicoJudge(request: Request): { ok: true; release: () => void } | { ok: false; error: string } {
  if (active) return { ok: false, error: "periodico-judge-busy" };
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  const code = request.headers.get("x-voice-access-code") ?? "";
  // Proxy headers are only a hint; spoofing this cannot bypass the code bucket.
  // Neither the IP nor the code is persisted or logged, even in this map.
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 128);
  const limits = [
    { key: digest(`periodico:credential:${code}`).toString("hex"), limit: CREDENTIAL_LIMIT },
    { key: digest(`periodico:ip:${code}:${ip}`).toString("hex"), limit: IP_LIMIT },
  ];
  if (limits.some(({ key, limit }) => (buckets.get(key)?.count ?? 0) >= limit)) return { ok: false, error: "periodico-rate-limit" };
  for (const { key } of limits) {
    const bucket = buckets.get(key);
    buckets.set(key, { count: (bucket?.count ?? 0) + 1, resetAt: bucket?.resetAt ?? now + WINDOW_MS });
  }
  active = true;
  let released = false;
  return { ok: true, release: () => { if (!released) { released = true; active = false; } } };
}
