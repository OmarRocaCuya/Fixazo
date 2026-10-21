import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { practiceGoals, type PracticeGoal } from "../periodico/practice-goals";

const source = "fixazo-practice-goals";
export const memoryCookie = "fixazo_practice";
export const cookieAge = 60 * 60 * 24 * 30;
const timeoutMs = 2500;
const noteSchema = z.object({ content: z.string().max(800), metadata: z.object({ goal: z.enum(["evidence", "explain", "accompanied"]) }) });
const searchSchema = z.object({ memories: z.array(z.unknown()).max(100) });
const configSchema = z.object({
  url: z.url(), key: z.string().min(1), secret: z.string().min(32),
});

export function memoryConfig() {
  if (process.env.ATOMICMEMORY_ENABLED !== "true") return null;
  const parsed = configSchema.safeParse({ url: process.env.ATOMICMEMORY_API_URL || "https://api.atomicstrata.ai", key: process.env.ATOMICMEMORY_API_KEY, secret: process.env.PRACTICE_MEMORY_COOKIE_SECRET });
  if (!parsed.success) return null;
  const url = new URL(parsed.data.url);
  if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) return null;
  return { ...parsed.data, url: parsed.data.url.replace(/\/+$/, "").replace(/\/v1$/, "") };
}

export function issuePracticeIdentity(secret: string, now = Date.now()) {
  const value = `${randomBytes(24).toString("base64url")}.${Math.floor(now / 1000) + cookieAge}`;
  const signature = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${signature}`;
}

export function practiceSubject(cookie: string | undefined, secret: string, now = Date.now()): string | null {
  if (!cookie || cookie.length > 180) return null;
  const match = /^([A-Za-z0-9_-]{32})\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(cookie);
  if (!match || Number(match[2]) <= now / 1000 || Number(match[2]) > now / 1000 + cookieAge + 60) return null;
  const expected = createHmac("sha256", secret).update(`${match[1]}.${match[2]}`).digest();
  const actual = Buffer.from(match[3], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return `fixazo:${match[1]}`;
}

export function readPracticeCookie(request: Request) {
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${memoryCookie}=`))?.slice(memoryCookie.length + 1);
}

export function createPracticeMemory(config: NonNullable<ReturnType<typeof memoryConfig>>, transport: typeof fetch = fetch) {
  async function post(path: string, body: object) {
    const response = await transport(`${config.url}/v1/memories/${path}`, {
      method: "POST", redirect: "error", cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error("practice-memory-unavailable");
    return response;
  }
  return {
    async save(subject: string, goal: PracticeGoal) {
      const response = await post("ingest/quick", { user_id: subject, source_site: source, source_url: "", skip_extraction: true, content_class: "summary", conversation: `Objetivo voluntario para una próxima lectura, no una evaluación: ${practiceGoals[goal]}`, metadata: { goal } });
      const receipt = z.object({ memories_stored: z.number().int().nonnegative(), stored_memory_ids: z.array(z.string()) }).parse(await response.json());
      if (!receipt.memories_stored || !receipt.stored_memory_ids.length) throw new Error("practice-memory-not-stored");
    },
    async recall(subject: string): Promise<PracticeGoal[]> {
      const response = await post("search/fast", { user_id: subject, source_site: source, query: "Objetivos voluntarios para practicar en la próxima lectura", limit: 5 });
      const result = searchSchema.parse(await response.json());
      const goals = new Set<PracticeGoal>();
      for (const raw of result.memories) {
        const note = noteSchema.safeParse(raw);
        if (note.success) goals.add(note.data.metadata.goal);
      }
      return [...goals];
    },
    async clear(subject: string) {
      const response = await post("reset-source", { user_id: subject, source_site: source });
      z.object({ success: z.literal(true), deleted_memories: z.number().int().nonnegative(), deleted_episodes: z.number().int().nonnegative(), deleted_documents: z.number().int().nonnegative() }).parse(await response.json());
    },
  };
}
