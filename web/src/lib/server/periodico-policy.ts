import { createHash } from "node:crypto";

// Per-instance abuse guard only: this is NOT a distributed quota or a spending
// cap. Configure a provider budget before enabling the judge. Access is open
// (no private code): same-origin plus a per-IP quota and a global ceiling.
const WINDOW_MS = 10 * 60 * 1000;
const IP_LIMIT = 40;
const GLOBAL_LIMIT = 600;
const MAX_ACTIVE = 3;
const buckets = new Map<string, { count: number; resetAt: number }>();
let active = 0;

export function getPeriodicoPolicy() {
  let reason: string | null = null;
  if (process.env.PERIODICO_JUDGE_ENABLED !== "true") reason = "periodico-judge-disabled";
  else if (!process.env.OPENROUTER_API_KEY?.trim()) reason = "periodico-provider-not-configured";
  return { enabled: reason === null, reason };
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Run before reading a body: only same-origin browser requests are admitted. */
export function preflightPeriodicoRequest(request: Request): { status: number; error: string } | null {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return { status: 403, error: "same-origin-required" };
  }
  return null;
}

/** Reserve one judge (at most three fixed model calls), then release in finally. */
export function reservePeriodicoJudge(request: Request): { ok: true; release: () => void } | { ok: false; error: string } {
  if (active >= MAX_ACTIVE) return { ok: false, error: "periodico-judge-busy" };
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  // Only a SHA-256 digest of the proxy IP hint is kept in memory; the raw IP is
  // never stored or logged. The global bucket bounds spend if the hint is spoofed.
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 128);
  const limits = [
    { key: digest("periodico:global").toString("hex"), limit: GLOBAL_LIMIT },
    { key: digest(`periodico:ip:${ip}`).toString("hex"), limit: IP_LIMIT },
  ];
  if (limits.some(({ key, limit }) => (buckets.get(key)?.count ?? 0) >= limit)) return { ok: false, error: "periodico-rate-limit" };
  for (const { key } of limits) {
    const bucket = buckets.get(key);
    buckets.set(key, { count: (bucket?.count ?? 0) + 1, resetAt: bucket?.resetAt ?? now + WINDOW_MS });
  }
  active++;
  let released = false;
  return { ok: true, release: () => { if (!released) { released = true; active--; } } };
}
