import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createOpenRouterAdapter } from "./llm/openrouter.ts";

const env = process.env;
const port = Number(env.PORT ?? 8787);
const llm = createOpenRouterAdapter({
  apiKey: env.OPENROUTER_API_KEY,
  model: env.OPENROUTER_MODEL,
  timeoutMs: Number(env.OPENROUTER_TIMEOUT_MS) || undefined,
});

const app = createApp({
  llm,
  token: env.SERVICE_TOKEN || undefined,
  allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  cacheSize: Number(env.CACHE_SIZE ?? 200),
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`reader-enricher listening on http://localhost:${info.port} (ia: ${llm ? llm.modelo : "off"})`);
});
