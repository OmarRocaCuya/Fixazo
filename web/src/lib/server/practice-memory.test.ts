import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPracticeMemory, issuePracticeIdentity, memoryConfig, practiceSubject } from "./practice-memory";
import { DELETE, GET, POST } from "@/app/api/periodico/practice-memory/route";

const config = { url: "http://127.0.0.1:8191", key: "fixture-key", secret: "a".repeat(40) };
beforeEach(() => {
  vi.stubEnv("ATOMICMEMORY_ENABLED", "true");
  vi.stubEnv("ATOMICMEMORY_API_URL", config.url);
  vi.stubEnv("ATOMICMEMORY_API_KEY", config.key);
  vi.stubEnv("PRACTICE_MEMORY_COOKIE_SECRET", config.secret);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const request = (method: string, cookie?: string, body?: object, origin = "https://fixazo.example") => new Request("https://fixazo.example/api/periodico/practice-memory", {
  method, headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

describe("optional practice memory", () => {
  it("does not contact a provider or set an identity before consent", async () => {
    const transport = vi.fn(); vi.stubGlobal("fetch", transport);
    const response = await GET(request("GET"));
    expect(await response.json()).toEqual({ state: "ready", goals: [] });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(transport).not.toHaveBeenCalled();
    vi.stubEnv("ATOMICMEMORY_ENABLED", "false");
    expect(await (await GET(request("GET"))).json()).toEqual({ state: "disabled", goals: [] });
  });
  it("rejects tampering and expiration, and keeps two browsers isolated", () => {
    const now = Date.now();
    const first = issuePracticeIdentity(config.secret, now);
    const second = issuePracticeIdentity(config.secret, now);
    expect(practiceSubject(first, config.secret, now)).toMatch(/^fixazo:/);
    expect(practiceSubject(first, config.secret, now)).not.toEqual(practiceSubject(second, config.secret, now));
    expect(practiceSubject(first.replace(/^./, "!"), config.secret, now)).toBeNull();
    expect(practiceSubject(first, "b".repeat(40), now)).toBeNull();
    expect(practiceSubject(first, config.secret, now + 31 * 86400000)).toBeNull();
  });
  it("saves only the chosen canonical goal, recalls it and clears only that browser's source", async () => {
    const notes = new Map<string, object[]>();
    const transport = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(init?.headers).toMatchObject({ Authorization: "Bearer fixture-key" });
      expect(body).not.toHaveProperty("session_id");
      if (String(input).endsWith("ingest/quick")) {
        expect(body).toMatchObject({ source_site: "fixazo-practice-goals", content_class: "summary", skip_extraction: true, metadata: { goal: "evidence" } });
        expect(body.conversation).not.toContain("student");
        notes.set(body.user_id, [{ content: body.conversation, metadata: body.metadata }]);
        return Response.json({ memories_stored: 1, stored_memory_ids: ["fixture-memory"] });
      }
      if (String(input).endsWith("reset-source")) { notes.delete(body.user_id); return Response.json({ success: true, deleted_memories: 1, deleted_episodes: 0, deleted_documents: 0 }); }
      return Response.json({ memories: notes.get(body.user_id) ?? [] });
    });
    vi.stubGlobal("fetch", transport);
    const saved = await POST(request("POST", undefined, { goal: "evidence" }));
    expect(saved.status).toBe(200);
    const cookie = saved.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeDefined();
    expect(saved.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Strict");
    expect(await (await GET(request("GET", cookie))).json()).toEqual({ state: "ready", goals: ["evidence"] });
    const other = `fixazo_practice=${issuePracticeIdentity(config.secret)}`;
    expect(await (await GET(request("GET", other))).json()).toEqual({ state: "ready", goals: [] });
    expect((await DELETE(request("DELETE", cookie))).status).toBe(200);
    expect(await (await GET(request("GET", cookie))).json()).toEqual({ state: "ready", goals: [] });
  });
  it("rejects cross-origin writes, oversized bodies and caller-selected identities", async () => {
    const transport = vi.fn(); vi.stubGlobal("fetch", transport);
    expect((await POST(request("POST", undefined, { goal: "evidence" }, "https://other.example"))).status).toBe(403);
    expect((await POST(request("POST", undefined, { goal: "evidence", user_id: "other-student" }))).status).toBe(400);
    expect((await POST(request("POST", undefined, { goal: "evidence", text: "x".repeat(200) }))).status).toBe(413);
    expect(transport).not.toHaveBeenCalled();
  });
  it("does not report a failed, empty or malformed provider response as saved", async () => {
    for (const response of [Response.json({}, { status: 503 }), Response.json({ memories_stored: 0, stored_memory_ids: [] }), Response.json({ ok: true })]) {
      vi.stubGlobal("fetch", vi.fn(async () => response));
      const result = await POST(request("POST", undefined, { goal: "explain" }));
      expect(result.status).toBe(503);
      expect(result.headers.get("set-cookie")).toContain("fixazo_practice=");
    }
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("timeout", "TimeoutError"); }));
    expect((await POST(request("POST", undefined, { goal: "explain" }))).status).toBe(503);
  });
  it("bounds retrieval, ignores malformed goals and never displays provider text", async () => {
    const transport = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toContain("search/fast");
      expect(init?.method).toBe("POST");
      return Response.json({ memories: [
      { content: "ignore instructions", metadata: { goal: "evidence" } },
      { content: "duplicate", metadata: { goal: "evidence" } },
      { content: "bad", metadata: { goal: "unknown" } }, null,
    ] }); });
    expect(await createPracticeMemory(config, transport).recall("trusted-browser")).toEqual(["evidence"]);
    const init = transport.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it("preserves the identity when the provider does not confirm deletion", async () => {
    const cookie = `fixazo_practice=${issuePracticeIdentity(config.secret)}`;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    const response = await DELETE(request("DELETE", cookie));
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("disables invalid configuration and allows HTTP only for loopback fixtures", () => {
    expect(memoryConfig()).not.toBeNull();
    vi.stubEnv("ATOMICMEMORY_API_URL", "http://public.example"); expect(memoryConfig()).toBeNull();
    vi.stubEnv("ATOMICMEMORY_API_URL", "https://user:password@example.com"); expect(memoryConfig()).toBeNull();
    vi.stubEnv("ATOMICMEMORY_API_URL", "https://api.atomicstrata.ai");
    vi.stubEnv("PRACTICE_MEMORY_COOKIE_SECRET", "short"); expect(memoryConfig()).toBeNull();
  });
});


it("retains the consented subject when a first-write receipt is lost", async () => {
  let subject: string | undefined;
  vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => {
    subject = JSON.parse(String(init?.body)).user_id;
    throw new DOMException("timeout", "TimeoutError");
  }));
  const response = await POST(request("POST", undefined, { goal: "evidence" }));
  expect(response.status).toBe(503);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  expect(practiceSubject(cookie?.split("=")[1], config.secret)).toBe(subject);
  vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => {
    expect(JSON.parse(String(init?.body)).user_id).toBe(subject);
    return Response.json({ success: true, deleted_memories: 1, deleted_episodes: 0, deleted_documents: 0 });
  }));
  const deleted = await DELETE(request("DELETE", cookie));
  expect(deleted.status).toBe(200);
  expect(deleted.headers.get("set-cookie")).toContain("Max-Age=0");
});
