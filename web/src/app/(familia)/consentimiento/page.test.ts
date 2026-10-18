import { describe, expect, it, vi } from "vitest";
const { redirect, getStore } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  getStore: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/storage", () => ({ getStore }));
import LegacyConsentPage from "./page";

describe("legacy onboarding entry", () => {
  it("goes straight to the reading entry without a consent wall", () => {
    expect(() => LegacyConsentPage()).toThrow("redirect:/chat");
    expect(redirect).toHaveBeenCalledWith("/chat");
  });
  it("does not invent stored permission or access the microphone", () => {
    const capture = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: capture } });
    try {
      expect(() => LegacyConsentPage()).toThrow("redirect:/chat");
      expect(getStore).not.toHaveBeenCalled();
      expect(capture).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});