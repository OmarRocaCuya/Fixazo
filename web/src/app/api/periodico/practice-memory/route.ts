import { z } from "zod";
import { cookieAge, createPracticeMemory, issuePracticeIdentity, memoryConfig, memoryCookie, practiceSubject, readPracticeCookie } from "@/lib/server/practice-memory";
import { preflightPeriodicoRequest, reservePeriodicoJudge } from "@/lib/server/periodico-policy";

const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const inputSchema = z.object({ goal: z.enum(["evidence", "explain", "accompanied"]) }).strict();
const reply = (body: object, status = 200) => Response.json(body, { status, headers });

export async function GET(request: Request) {
  const config = memoryConfig();
  if (!config) return reply({ state: "disabled", goals: [] });
  const subject = practiceSubject(readPracticeCookie(request), config.secret);
  if (!subject) return reply({ state: "ready", goals: [] });
  const reservation = reservePeriodicoJudge(request);
  if (!reservation.ok) return reply({ state: "unavailable" }, 429);
  try { return reply({ state: "ready", goals: await createPracticeMemory(config).recall(subject) }); }
  catch { return reply({ state: "unavailable" }, 503); }
  finally { reservation.release(); }
}

async function mutate(request: Request, clear: boolean) {
  const config = memoryConfig();
  if (!config) return reply({ state: "disabled" }, 503);
  const denial = preflightPeriodicoRequest(request);
  if (denial) return reply({ state: "unavailable" }, denial.status);
  const existing = readPracticeCookie(request);
  const existingSubject = practiceSubject(existing, config.secret);
  if (clear && !existingSubject) return reply({ state: "ready", goals: [] });
  let goal: z.infer<typeof inputSchema>["goal"] = "evidence";
  if (!clear) {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ state: "invalid" }, 415);
    // The only accepted payload is a fixed goal identifier, never text, audio or a student ID.
    const reader = request.body?.getReader();
    if (!reader) return reply({ state: "invalid" }, 400);
    let text = "";
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 128) { await reader.cancel(); return reply({ state: "invalid" }, 413); }
        text += new TextDecoder().decode(value);
      }
      const parsed = inputSchema.safeParse(JSON.parse(text));
      if (!parsed.success) return reply({ state: "invalid" }, 400);
      goal = parsed.data.goal;
    } catch { return reply({ state: "invalid" }, 400); }
    finally { reader.releaseLock(); }
  }
  const reservation = reservePeriodicoJudge(request);
  if (!reservation.ok) return reply({ state: "unavailable" }, 429);
  const cookie = existingSubject && existing ? existing : issuePracticeIdentity(config.secret);
  const subject = practiceSubject(cookie, config.secret);
  if (!subject) { reservation.release(); return reply({ state: "unavailable" }, 503); }
  try {
    const memory = createPracticeMemory(config);
    if (clear) await memory.clear(subject);
    else await memory.save(subject, goal);
    const response = reply({ state: "ready" });
    const age = clear ? 0 : cookieAge;
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.headers.set("Set-Cookie", `${memoryCookie}=${clear ? "" : cookie}; Max-Age=${age}; Path=/; HttpOnly; SameSite=Strict${secure}`);
    return response;
  } catch { return reply({ state: "unavailable" }, 503); }
  finally { reservation.release(); }
}
export const POST = (request: Request) => mutate(request, false);
export const DELETE = (request: Request) => mutate(request, true);
