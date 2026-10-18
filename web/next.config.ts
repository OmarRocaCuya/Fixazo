import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Runtime filesystem reads need the curated editions in Vercel Functions.
  outputFileTracingIncludes: { '/*': ['./data/ediciones/**/*.json'] },
};

export default nextConfig;
