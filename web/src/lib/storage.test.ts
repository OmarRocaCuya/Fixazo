import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore, memoryStorage, PAUSED_TTL_MS, type PausedSession } from "./storage";
import { SAMPLE_ES } from "./mission/samples";
import { initialContext } from "./session/machine";
import type { Report } from "./types";

function fakeReport(over: Record<string, unknown> = {}): Report {
  return {
    id: "r1",
    createdAt: "2026-10-17T12:00:00.000Z",
    mood: { enabled: true, start: "bien", end: null, source: "autorreporte" },
    ...over,
  } as unknown as Report;
}

describe("local persistence", () => {
  it("round-trips consent, profile and missions", () => {
    const s = createStore(memoryStorage());
    s.saveConsent({ version: "1", acceptedAt: "x", permissions: { voice: true, process: true, mood: false } });
    expect(s.loadConsent()?.permissions.mood).toBe(false);
    s.saveProfile({ alias: "Yeni", grade: 4, homeLang: "qu", readingLang: "es" });
    expect(s.loadProfile()?.alias).toBe("Yeni");
    s.saveMission(SAMPLE_ES);
    s.setCurrentMission(SAMPLE_ES.id);
    expect(s.currentMission()?.title).toBe(SAMPLE_ES.title);
  });

  it("survives corrupted JSON", () => {
    const mem = memoryStorage();
    mem.setItem("nw.profile", "{not json");
    expect(createStore(mem).loadProfile()).toBeNull();
  });

  it("falls back to memory when storage throws (private mode)", () => {
    const throwing = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
      key: () => null,
      length: 0,
      clear: () => {},
    } as unknown as Storage;
    const s = createStore(throwing);
    s.saveProfile({ alias: "Yeni", grade: 4, homeLang: "qu", readingLang: "es" });
    expect(s.loadProfile()?.alias).toBe("Yeni");
  });

  it("saves only clean reports (guardrails run before every save)", () => {
    const s = createStore(memoryStorage());
    s.saveReport(fakeReport());
    expect(s.listReports()).toHaveLength(1);
    expect(() => s.saveReport(fakeReport({ id: "r2", emotion: "ansioso" }))).toThrow(/guardrail/i);
    expect(() => s.saveReport(fakeReport({ id: "r3", voiceprint: [1, 2] }))).toThrow();
    expect(s.listReports().map((r) => r.id)).toEqual(["r1"]);
  });

  it("deletes all data with the app prefix only", () => {
    const mem = memoryStorage();
    mem.setItem("other.app", "keep");
    const s = createStore(mem);
    s.saveProfile({ alias: "Yeni", grade: 4, homeLang: "qu", readingLang: "es" });
    s.saveReport(fakeReport());
    s.deleteAllData();
    expect(s.loadProfile()).toBeNull();
    expect(s.listReports()).toEqual([]);
    expect(mem.getItem("other.app")).toBe("keep");
  });

  it("exports everything as JSON", () => {
    const s = createStore(memoryStorage());
    s.saveProfile({ alias: "Yeni", grade: 4, homeLang: "qu", readingLang: "es" });
    const data = JSON.parse(s.exportAll());
    expect(data.profile.alias).toBe("Yeni");
    expect(data.reports).toEqual([]);
  });
});

describe("paused session privacy and lifetime", () => {
  afterEach(() => vi.useRealTimers());
  const now = new Date("2026-10-17T20:00:00.000Z");
  function paused(extra: Record<string, unknown> = {}): PausedSession {
    return {
      missionId: SAMPLE_ES.id, pausedAt: now.toISOString(), startedAt: now.getTime() - 5000, state: "READ",
      ctx: { ...initialContext({ alias: "Yeni", moodEnabled: false }), state: "PAUSED", resumeState: "READ" },
      turns: [{ state: "READ", transcript: "triste", simulated: true, audio: null, readingSeconds: 5, at: now.getTime() }],
      ...extra,
    };
  }
  it("preserves valid resume state, exports it, and physically deletes it after 24 hours", () => {
    vi.useFakeTimers().setSystemTime(now);
    const mem = memoryStorage();
    const s = createStore(mem);
    s.savePaused(paused());
    expect(s.loadPaused()?.state).toBe("READ");
    expect(JSON.parse(s.exportAll()).paused.ctx.resumeState).toBe("READ");
    vi.setSystemTime(now.getTime() + PAUSED_TTL_MS);
    expect(s.loadPaused()).toBeNull();
    expect(mem.getItem("nw.pausedSession")).toBeNull();
    expect(JSON.parse(s.exportAll()).paused).toBeNull();
  });
  it("drops forbidden fields and absolute pitch while keeping a legitimate derived summary", () => {
    vi.useFakeTimers().setSystemTime(now);
    const mem = memoryStorage();
    const s = createStore(mem);
    const p = paused();
    s.savePaused({ ...p, ctx: { ...(p.ctx as object), pace: "acelerado", baseline: { meanF0: 280 }, emotion: "ansioso", voiceprint: [1, 2] }, turns: [{
      state: "READ", transcript: "palabras", simulated: false, at: now.getTime(), pace: "lento", rawAudio: [1, 2],
      audio: { latencyMs: 20, longPauses: 0, finalIntonation: null, meanF0: 280, f0RangeSemitones: 5, noiseFloorDb: -55, snrDb: 25, clippingRatio: 0, speechDetected: true, possibleAdultHelp: true, speechMs: 1000, samples: new Float32Array([1, 2]) },
    }] });
    const saved = s.loadPaused();
    expect(saved).not.toBeNull();
    const json = mem.getItem("nw.pausedSession")!;
    expect(json).not.toMatch(/"(pace|baseline|emotion|voiceprint|rawAudio|samples)"/);
    expect(json).not.toContain("280");
    expect((saved?.turns[0] as { audio: { meanF0: null; possibleAdultHelp: boolean } }).audio).toMatchObject({ meanF0: null, possibleAdultHelp: false });
  });
  it("removes corrupt, future-dated, invalid-state and raw-audio payloads", () => {
    vi.useFakeTimers().setSystemTime(now);
    const mem = memoryStorage();
    const s = createStore(mem);
    for (const value of ["{broken", JSON.stringify(paused({ pausedAt: "not-a-date" })), JSON.stringify(paused({ pausedAt: "2026-10-18T20:00:00.000Z" })), JSON.stringify(paused({ ctx: { state: "PAUSED", resumeState: "NOT_REAL" } })), JSON.stringify(paused({ turns: [{ audio: [1, 2, 3] }] }))]) {
      mem.setItem("nw.pausedSession", value);
      expect(s.loadPaused()).toBeNull();
      expect(mem.getItem("nw.pausedSession")).toBeNull();
    }
  });
  it("persists human review across report retrieval", () => {
    const s = createStore(memoryStorage());
    const review = { status: "provisional", evidence: { obtiene: { decision: "confirmado", reviewedBy: "docente", reviewedAt: now.toISOString() } }, adultHelp: null };
    s.saveReport(fakeReport({ review }));
    expect(s.getReport("r1")?.review).toEqual(review);
  });
});
