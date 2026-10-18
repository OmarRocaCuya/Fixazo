import { createHash, timingSafeEqual } from "node:crypto";
import type { VoiceCloudMode, VoicePolicyStatus, VoiceProvider } from "@/lib/voice/types";

type Authorization = { ok: true; mode: "adult-demo" | "approved-pilot" }
  | { ok: false; status: number; error: string };

// Deliberately a second line of defense, NOT a distributed quota. Protect the
// deployment and configure provider spend limits before any public pilot.
const WINDOW_MS = 10 * 60 * 1000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function configuredMode(): VoiceCloudMode {
  const mode = process.env.VOICE_CLOUD_MODE;
  return mode === "adult-demo" || mode === "approved-pilot" ? mode : "disabled";
}

/** Operator-owned, fixed HTTPS destination, never a URL from a request body. */
export function getIndigenousBackendConfig(): { baseUrl: URL; token: string } | null {
  const raw = process.env.INDIGENOUS_BACKEND_URL;
  const token = process.env.INDIGENOUS_BACKEND_TOKEN?.trim();
  if (!raw || !token || token.length < 32) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    // Explicit local developer mode only. Never broaden this to arbitrary
    // private hosts, production builds, credentials, paths or redirects.
    if (process.env.NODE_ENV === "development" && process.env.INDIGENOUS_ALLOW_LOOPBACK === "true"
      && url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port !== ""
      && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash
      && /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}\/?$/.test(raw)) {
      return { baseUrl: url, token };
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
      || !host.includes(".") || host.startsWith("[") || /(^|\.)(localhost|local|internal)$/.test(host)
      || /^(0|10|127)\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return { baseUrl: url, token };
  } catch { return null; }
}

export function getVoicePolicyStatus(provider: VoiceProvider): VoicePolicyStatus {
  const mode = configuredMode();
  let reason: string | null = null;
  if (mode === "disabled") reason = "cloud-disabled";
  // The self-hosted Meta backend is open for the MVP; paid providers keep the code.
  else if (provider !== "meta" && (!process.env.VOICE_ACCESS_CODE || process.env.VOICE_ACCESS_CODE.trim().length < 16)) reason = "access-not-configured";
  else if (provider === "meta" ? !getIndigenousBackendConfig() : !(provider === "deepgram" ? process.env.DEEPGRAM_API_KEY : process.env.OPENAI_API_KEY)?.trim()) reason = "provider-not-configured";
  else if (mode === "approved-pilot" && process.env.CHILD_VOICE_PRIVACY_APPROVED !== "true") reason = "privacy-approval-required";
  else if (mode === "approved-pilot" && provider === "openai" && process.env.OPENAI_ZDR_CONFIRMED !== "true") reason = "provider-privacy-approval-required";
  return { enabled: reason === null, mode, reason };
}

/**
 * Operator-level access only (configured mode, same origin, private access code,
 * rate limit). The MVP no longer asks for an adult/guardian attestation.
 */
export function authorizeVoiceRequest(request: Request, provider: VoiceProvider): Authorization {
  const policy = getVoicePolicyStatus(provider);
  if (!policy.enabled || policy.mode === "disabled") return { ok: false, status: 503, error: policy.reason ?? "cloud-disabled" };
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return { ok: false, status: 403, error: "same-origin-required" };
  }
  const supplied = request.headers.get("x-voice-access-code") ?? "";
  const expected = process.env.VOICE_ACCESS_CODE ?? "";
  // Hash before the constant-time comparison to avoid comparing unequal buffers.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const open = provider === "meta";
  if (!open && (supplied.length > 256 || !timingSafeEqual(digest(supplied), digest(expected)))) {
    return { ok: false, status: 401, error: "voice-access-required" };
  }

  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  // Never store the raw IP or access code. Proxy headers are only a hint; the
  // global credential bucket below still applies if a caller spoofs the hint.
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 128);
  // Without a code there is no shared credential to bucket, so open access is limited per IP.
  const keys = open
    ? [digest(`${provider}:${ip}`).toString("hex")]
    : [digest(`${provider}:credential:${supplied}`).toString("hex"), digest(`${provider}:${ip}:${supplied}`).toString("hex")];
  // Meta's guided reading uses short ASR chunks plus separate speech turns.
  // This remains a bounded per-process guard, not a distributed spending quota.
  const limit = provider === "meta" ? 90 : provider === "openai" ? 30 : 12;
  if (keys.some((key) => (buckets.get(key)?.count ?? 0) >= limit)) return { ok: false, status: 429, error: "voice-rate-limit" };
  for (const key of keys) {
    const current = buckets.get(key);
    buckets.set(key, { count: (current?.count ?? 0) + 1, resetAt: current?.resetAt ?? now + WINDOW_MS });
  }
  return { ok: true, mode: policy.mode };
}
