/** Only the newspaper's known keys belong to this integration, not every fixazo:* key. */
const FIXED_KEYS = ["fixazo:resultados", "fixazo:alumno"] as const;
const ADVANCE_PREFIX = "fixazo:avance:";

function browserStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

function snapshotKeys(storage: Storage): { keys: string[]; complete: boolean } {
  const keys = new Set<string>(FIXED_KEYS);
  let complete = true;
  try {
    const length = storage.length;
    for (let index = 0; index < length; index++) {
      try {
        const key = storage.key(index);
        if (key?.startsWith(ADVANCE_PREFIX)) keys.add(key);
      } catch { complete = false; }
    }
  } catch { complete = false; }
  return { keys: [...keys], complete };
}

export interface PeriodicoExport {
  /** Original local keys remain identifiable, including the legacy anonymous ID. */
  records: Record<string, unknown>;
  complete: boolean;
  unreadableKeys: string[];
}

/** Storage is resolved only when invoked, never at import or server render. */
export function exportPeriodicoData(storage: Storage | null = browserStorage()): PeriodicoExport {
  const records: Record<string, unknown> = {};
  if (!storage) return { records, complete: false, unreadableKeys: [] };
  const snapshot = snapshotKeys(storage);
  const unreadableKeys: string[] = [];
  for (const key of snapshot.keys) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      if (key === "fixazo:alumno") records[key] = raw;
      else {
        try { records[key] = JSON.parse(raw); }
        catch { records[key] = raw; } // A corrupt record still belongs in the owner's export.
      }
    } catch { unreadableKeys.push(key); }
  }
  return { records, complete: snapshot.complete && unreadableKeys.length === 0, unreadableKeys };
}

/** Snapshot before deleting: removing a key shifts localStorage's numeric indexes. */
export function deletePeriodicoData(storage: Storage | null = browserStorage()): { complete: boolean; failedKeys: string[] } {
  if (!storage) return { complete: false, failedKeys: [] };
  const snapshot = snapshotKeys(storage);
  const failedKeys: string[] = [];
  for (const key of snapshot.keys) {
    try { storage.removeItem(key); }
    catch { failedKeys.push(key); }
  }
  return { complete: snapshot.complete && failedKeys.length === 0, failedKeys };
}
