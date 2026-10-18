// Local-only persistence (no accounts). Every access is wrapped in try/catch and
// falls back to memory, so the app keeps working in private windows.
import type { Consent, Mission, Profile, Report } from "./types";
import { assertReportIsClean } from "./guardrails";
import { z } from "zod";

const PREFIX = "nw.";
const K = {
  consent: `${PREFIX}consent`,
  profile: `${PREFIX}profile`,
  missions: `${PREFIX}missions`,
  current: `${PREFIX}currentMission`,
  reports: `${PREFIX}reports`,
  chat: `${PREFIX}chat`,
  reminder: `${PREFIX}reminder`,
  paused: `${PREFIX}pausedSession`,
};

export function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  };
}

export interface ChatMessage {
  id: string;
  who: "asistente" | "familia";
  text: string;
  missionId?: string;
  reportId?: string;
  chips?: string[];
  at: string;
}

export interface PausedSession {
  missionId: string;
  pausedAt: string;
  state: string;
  /** Machine context and turn records (derived data only, no audio). */
  ctx: unknown;
  turns: unknown[];
  startedAt: number;
}

export const PAUSED_TTL_MS = 24 * 60 * 60 * 1000;
const sessionState = z.enum(["CHECK_IN", "READ", "Q_OBTIENE", "Q_INFIERE", "STANCE", "COUNTER", "REVISE", "CHECK_OUT", "REPORT", "DONE", "PAUSED"]);
const nullableNumber = z.number().finite().nullable();
const mood = z.enum(["muy_bien", "bien", "regular", "no_tan_bien", "mal"]).nullable();
const count = z.number().int().nonnegative();
// Explicit allowlists: unknown fields (including baseline, pace, embeddings and
// raw recordings) are dropped at every object boundary before local persistence.
const pausedSchema = z.object({
  missionId: z.string().min(1), pausedAt: z.string(), state: sessionState, startedAt: z.number().finite(),
  ctx: z.object({
    state: z.literal("PAUSED"), resumeState: sessionState,
    alias: z.string(), moodEnabled: z.boolean(),
    helps: z.object({ obtiene: count, infiere: count, reflexiona: count }),
    answers: z.object({ obtiene: z.string().optional(), infiere: z.string().optional(), stance: z.string().optional(), revise: z.string().optional() }),
    awaitingConfidence: z.boolean(), askedMore: z.boolean(),
    confidence: z.enum(["poco", "mas_o_menos", "muy"]).nullable(), decision: z.enum(["mantengo", "cambio"]).nullable(),
    moodStart: mood, moodEnd: mood, repeatRequests: count, answerRequests: count, ownQuestions: z.array(z.string()),
  }),
  turns: z.array(z.object({
    state: z.enum(["READ", "Q_OBTIENE", "Q_INFIERE", "STANCE", "REVISE"]), transcript: z.string(), simulated: z.boolean(),
    audio: z.object({
      latencyMs: nullableNumber, longPauses: count,
      finalIntonation: z.enum(["sube", "baja", "plana"]).nullable(),
      meanF0: z.unknown().optional().transform(() => null),
      f0RangeSemitones: nullableNumber, noiseFloorDb: nullableNumber, snrDb: nullableNumber,
      clippingRatio: z.number().min(0).max(1), speechDetected: z.boolean(), speechMs: z.number().nonnegative(),
      possibleAdultHelp: z.unknown().optional().transform(() => false),
    }).nullable(),
    simulatedLatencyMs: nullableNumber.optional(), readingSeconds: z.number().nonnegative().optional(),
    bargeIn: z.boolean().optional(), unobservable: z.boolean().optional(), at: z.number().finite(),
  })),
});

function cleanPaused(value: unknown): PausedSession | null {
  const parsed = pausedSchema.safeParse(value);
  if (!parsed.success) return null;
  const paused = parsed.data;
  const age = Date.now() - Date.parse(paused.pausedAt);
  if (!Number.isFinite(age) || age < 0 || age >= PAUSED_TTL_MS || paused.ctx.resumeState === "PAUSED" || paused.ctx.resumeState === "DONE" || paused.ctx.resumeState === "REPORT") return null;
  return paused;
}

export function createStore(primary?: Storage | null) {
  const fallback = memoryStorage();
  let useFallback = !primary;

  const backend = (): Storage => (useFallback || !primary ? fallback : primary);

  function getRaw(key: string): string | null {
    try {
      return backend().getItem(key);
    } catch {
      useFallback = true;
      return fallback.getItem(key);
    }
  }
  function setRaw(key: string, value: string) {
    try {
      backend().setItem(key, value);
    } catch {
      useFallback = true;
      fallback.setItem(key, value);
    }
  }
  function remove(key: string) {
    try {
      backend().removeItem(key);
    } catch {
      /* ignore */
    }
    fallback.removeItem(key);
  }
  function get<T>(key: string, def: T): T {
    const raw = getRaw(key);
    if (raw === null) return def;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return def;
    }
  }
  const set = (key: string, value: unknown) => setRaw(key, JSON.stringify(value));
  function loadPaused(): PausedSession | null {
    const raw = getRaw(K.paused);
    if (raw === null) return null;
    let paused: PausedSession | null = null;
    try { paused = cleanPaused(JSON.parse(raw)); } catch { /* corrupted data is removed below */ }
    if (!paused) remove(K.paused);
    else set(K.paused, paused); // Also scrub older payloads on first access.
    return paused;
  }

  return {
    loadConsent: () => get<Consent | null>(K.consent, null),
    saveConsent: (c: Consent) => set(K.consent, c),
    loadProfile: () => get<Profile | null>(K.profile, null),
    saveProfile: (p: Profile) => set(K.profile, p),

    listMissions: () => get<Mission[]>(K.missions, []),
    saveMission(m: Mission) {
      const all = get<Mission[]>(K.missions, []).filter((x) => x.id !== m.id);
      set(K.missions, [m, ...all].slice(0, 20));
    },
    getMission(id: string) {
      return get<Mission[]>(K.missions, []).find((m) => m.id === id) ?? null;
    },
    setCurrentMission: (id: string) => set(K.current, id),
    currentMission() {
      const id = get<string | null>(K.current, null);
      return id ? get<Mission[]>(K.missions, []).find((m) => m.id === id) ?? null : null;
    },

    listReports: () => get<Report[]>(K.reports, []),
    getReport(id: string) {
      return get<Report[]>(K.reports, []).find((r) => r.id === id) ?? null;
    },
    /** Guardrails run before every save; a dirty report is never persisted. */
    saveReport(r: Report) {
      assertReportIsClean(r);
      const all = get<Report[]>(K.reports, []).filter((x) => x.id !== r.id);
      set(K.reports, [...all, r]);
    },

    loadChat: () => get<ChatMessage[]>(K.chat, []),
    saveChat: (msgs: ChatMessage[]) => set(K.chat, msgs.slice(-60)),

    loadReminder: () => get<string | null>(K.reminder, null),
    saveReminder: (at: string) => set(K.reminder, at),

    loadPaused,
    savePaused(p: PausedSession | null) {
      const clean = p ? cleanPaused(p) : null;
      if (clean) set(K.paused, clean);
      else remove(K.paused);
    },

    exportAll(): string {
      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          consent: get(K.consent, null),
          profile: get(K.profile, null),
          missions: get(K.missions, []),
          reports: get(K.reports, []),
          chat: get(K.chat, []),
          reminder: get(K.reminder, null),
          paused: loadPaused(),
        },
        null,
        2,
      );
    },

    deleteAllData() {
      const keys: string[] = [];
      try {
        const s = backend();
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (k && k.startsWith(PREFIX)) keys.push(k);
        }
      } catch {
        /* ignore */
      }
      for (const k of [...keys, ...Object.values(K)]) remove(k);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

let browserStore: Store | null = null;

/** Store bound to window.localStorage (or memory when unavailable). */
export function getStore(): Store {
  if (browserStore) return browserStore;
  let ls: Storage | null = null;
  try {
    ls = typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    ls = null;
  }
  browserStore = createStore(ls);
  return browserStore;
}
