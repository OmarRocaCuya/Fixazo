import { describe, expect, it, vi } from "vitest";
import type { LevelResult, Report } from "@/lib/types";
import { buildVoiceFamilySummary, completedReportHref, copyFamilySummary, familyWhatsappHref, shareFamilySummary, type FamilySummary } from "./family-share";

const summary: FamilySummary = { title: "Informe", text: "Resumen sin datos privados & razón", filename: "resumen.txt" };
const level = (overrides: Partial<LevelResult> = {}): LevelResult => ({ level: 2, status: "ok", quote: "private-quote", withHelp: false, helps: 0, source: "reglas", explanation: "private-explanation", ...overrides });

describe("family share projection", () => {
  it("shares only the allowlist and never serializes private report evidence or identifiers", () => {
    const report = {
      id: "private-id", alias: "private-alias", missionTitle: "private-title", headline: "private-headline",
      levels: { obtiene: level(), infiere: level({ level: "NO", status: "no_observable" }), reflexiona: level({ level: 3 }) },
      chain: { stance: { quote: "private-opinion" } }, process: { hedges: ["private-hedge"] },
      mood: { start: "private-mood" }, transcription: [{ rawAudio: "private-audio" }],
      homeQuestion: { es: "private-raw-question" }, review: undefined,
    } as unknown as Report;
    const result = buildVoiceFamilySummary(report);
    expect(JSON.stringify(result)).not.toContain("private-");
    expect(result.text).toContain("Informe provisional");
    expect(result.text).toContain("No observable (no es un 0)");
    expect(result.text).toContain("Opinión con evidencia: 3/3");
  });
  it("does not assume legacy or provisional reports were reviewed", () => {
    const result = buildVoiceFamilySummary({ levels: { obtiene: level(), infiere: level(), reflexiona: level() } } as Report);
    expect(result.text).toContain("pendiente de revisión humana");
  });
  it("puts only the preview into a recipient-free WhatsApp URL", () => {
    const url = new URL(familyWhatsappHref(summary));
    expect(url.origin + url.pathname).toBe("https://wa.me/");
    expect(url.searchParams.get("text")).toBe(summary.text);
    expect(url.searchParams.has("phone")).toBe(false);
  });
});

describe("explicit share actions", () => {
  it("does not invoke a share function before the action is explicitly called", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const port = { share };
    expect(share).not.toHaveBeenCalled();
    expect(await shareFamilySummary(summary, port)).toBe("opened");
    expect(share).toHaveBeenCalledExactlyOnceWith({ title: summary.title, text: summary.text });
  });
  it("keeps unsupported, cancellation, and failure distinct and does not retry automatically", async () => {
    expect(await shareFamilySummary(summary, {})).toBe("unavailable");
    const cancelled = vi.fn().mockRejectedValue(Object.assign(new Error("cancelled"), { name: "AbortError" }));
    expect(await shareFamilySummary(summary, { share: cancelled })).toBe("cancelled");
    expect(cancelled).toHaveBeenCalledTimes(1);
    const failed = vi.fn().mockRejectedValue(new Error("blocked"));
    expect(await shareFamilySummary(summary, { share: failed })).toBe("failed");
    expect(failed).toHaveBeenCalledTimes(1);
  });
  it("copies only the safe preview after an explicit action and handles rejected permissions", async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    expect(await copyFamilySummary(summary, copy)).toBe("copied");
    expect(copy).toHaveBeenCalledExactlyOnceWith(summary.text);
    expect(await copyFamilySummary(summary)).toBe("unavailable");
    expect(await copyFamilySummary(summary, vi.fn().mockRejectedValue(new Error("denied")))).toBe("failed");
  });
});

describe("completed voice report routing", () => {
  it("opens the actual saved report only after completion and encodes its identifier", () => {
    expect(completedReportHref("running", "r1")).toBeNull();
    expect(completedReportHref("saving", "r1")).toBeNull();
    expect(completedReportHref("finished", null)).toBeNull();
    expect(completedReportHref("finished", "r&1")).toBe("/informe?id=r%261");
  });
});

