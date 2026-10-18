import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  // Shared reading engine lives beside web; never expand this to the home directory.
  turbopack: { root: resolve(__dirname, "..") },
  outputFileTracingRoot: resolve(__dirname, ".."),
  cacheComponents: true,
  partialPrefetching: true,
  // Runtime filesystem reads need the curated editions in Vercel Functions.
  outputFileTracingIncludes: { '/*': ['./data/ediciones/**/*.json'] },
  // A fixed, opt-in development output keeps the emotion demo independent
  // from an existing user-owned .next/dev session. Never accepts a path.
  ...(process.env.NODE_ENV === "development" && process.env.NAWINCHAY_EMOTION_LOCAL === "true"
    ? { distDir: ".next-emotion" } : {}),
};

export default nextConfig;
