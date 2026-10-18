import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "@/lib/storage";
import { deletePeriodicoData, exportPeriodicoData } from "./privacidad";

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const storage = memoryStorage();
  storage.setItem("fixazo:resultados", JSON.stringify({ noticia: { habilidades: { evidencia: true } } }));
  storage.setItem("fixazo:alumno", "legacy-anonymous-id");
  storage.setItem("fixazo:avance:first", JSON.stringify({ hasta: 1 }));
  storage.setItem("fixazo:avance:second", JSON.stringify({ hasta: 3 }));
  storage.setItem("fixazo:avance:third", JSON.stringify({ hasta: 4 }));
  storage.setItem("fixazo:other-app", "keep-other-fixazo-feature");
  storage.setItem("fixazo:resultados:another-app", "keep-near-match");
  storage.setItem("nw.profile", "keep-family-owned-data");
  storage.setItem("other.app", "keep-unrelated-app");
  return storage;
}

describe("newspaper privacy export", () => {
  it("exports results, every saved advance and the legacy ID, without unrelated keys", () => {
    const storage = fixture();
    const exported = exportPeriodicoData(storage);
    expect(exported.complete).toBe(true);
    expect(exported.records).toEqual({
      "fixazo:resultados": { noticia: { habilidades: { evidencia: true } } },
      "fixazo:alumno": "legacy-anonymous-id",
      "fixazo:avance:first": { hasta: 1 }, "fixazo:avance:second": { hasta: 3 }, "fixazo:avance:third": { hasta: 4 },
    });
    expect(exported.unreadableKeys).toEqual([]);
    expect(storage.getItem("fixazo:avance:third")).not.toBeNull();
  });
  it("preserves corrupt JSON for the owner rather than failing the whole download", () => {
    const storage = memoryStorage(); storage.setItem("fixazo:resultados", "{corrupt");
    storage.setItem("fixazo:avance:broken", "not-json");
    expect(exportPeriodicoData(storage).records).toEqual({ "fixazo:resultados": "{corrupt", "fixazo:avance:broken": "not-json" });
  });
  it("marks reads that fail as incomplete while retaining other available data", () => {
    const storage = fixture(); const original = storage.getItem.bind(storage);
    storage.getItem = (key) => { if (key === "fixazo:resultados") throw new Error("blocked"); return original(key); };
    const exported = exportPeriodicoData(storage);
    expect(exported.complete).toBe(false); expect(exported.unreadableKeys).toEqual(["fixazo:resultados"]);
    expect(exported.records["fixazo:alumno"]).toBe("legacy-anonymous-id");
  });
});

describe("newspaper privacy deletion", () => {
  it("snapshots all advance keys before deleting and preserves other applications", () => {
    const storage = fixture(); storage.clear = vi.fn(() => { throw new Error("must not clear all storage"); });
    expect(deletePeriodicoData(storage)).toEqual({ complete: true, failedKeys: [] });
    for (const key of ["fixazo:resultados", "fixazo:alumno", "fixazo:avance:first", "fixazo:avance:second", "fixazo:avance:third"]) expect(storage.getItem(key)).toBeNull();
    for (const key of ["fixazo:other-app", "fixazo:resultados:another-app", "nw.profile", "other.app"]) expect(storage.getItem(key)).not.toBeNull();
    expect(storage.clear).not.toHaveBeenCalled();
  });
  it("still attempts known keys if enumeration is blocked, but never claims complete deletion", () => {
    const storage = fixture(); storage.key = () => { throw new Error("blocked-enumeration"); };
    expect(deletePeriodicoData(storage).complete).toBe(false);
    expect(storage.getItem("fixazo:resultados")).toBeNull(); expect(storage.getItem("fixazo:alumno")).toBeNull();
    expect(storage.getItem("fixazo:avance:first")).not.toBeNull();
  });
  it("continues after one removal fails and reports which owned key remains", () => {
    const storage = fixture(); const original = storage.removeItem.bind(storage);
    storage.removeItem = (key) => { if (key === "fixazo:avance:first") throw new Error("blocked"); original(key); };
    expect(deletePeriodicoData(storage)).toEqual({ complete: false, failedKeys: ["fixazo:avance:first"] });
    expect(storage.getItem("fixazo:avance:second")).toBeNull(); expect(storage.getItem("fixazo:avance:third")).toBeNull();
    expect(storage.getItem("other.app")).not.toBeNull();
  });
  it("handles length/getItem/removeItem failures without touching unrelated storage", () => {
    const storage = { get length() { throw new Error("blocked"); }, key: vi.fn(), getItem: vi.fn(() => { throw new Error("blocked"); }), removeItem: vi.fn(() => { throw new Error("blocked"); }) } as unknown as Storage;
    expect(exportPeriodicoData(storage)).toEqual({ records: {}, complete: false, unreadableKeys: ["fixazo:resultados", "fixazo:alumno"] });
    expect(deletePeriodicoData(storage)).toEqual({ complete: false, failedKeys: ["fixazo:resultados", "fixazo:alumno"] });
    expect(storage.key).not.toHaveBeenCalled();
  });
  it("is safe on the server and when the browser denies access to localStorage", () => {
    vi.stubGlobal("window", undefined);
    expect(exportPeriodicoData().complete).toBe(false); expect(deletePeriodicoData().complete).toBe(false);
    vi.stubGlobal("window", { get localStorage() { throw new Error("denied"); } });
    expect(exportPeriodicoData().records).toEqual({}); expect(deletePeriodicoData().complete).toBe(false);
    expect(exportPeriodicoData(null).complete).toBe(false);
  });
});
