import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import VoiceMascot from "./VoiceMascot";

vi.mock("@/components/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ t: (text: string) => text }), usePublicTranslations: () => undefined,
}));

describe("floating condor companion", () => {
  it("renders a neutral accessible condor without requesting audio, ASR, or emotion on mount", () => {
    const getUserMedia = vi.fn(), fetch = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } }); vi.stubGlobal("fetch", fetch);
    try {
      const html = renderToStaticMarkup(createElement(VoiceMascot));
      expect(html).toContain("Cóndor compañero");
      expect(html).toContain('data-expression="idle"');
      expect(html).toContain('data-speaking="false"');
      expect(html).toContain("Minimizar compañero de voz");
      expect(html).toContain('aria-expanded="true"');
      expect(fetch).not.toHaveBeenCalled(); expect(getUserMedia).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it("uses the generated nine-frame condor sheet and preserves nonblocking reduced-motion support", () => {
    const css = readFileSync(new URL("./voice-mascot.module.css", import.meta.url), "utf8");
    expect(css).toContain('/mascot/fixazo-condor-v1.png');
    expect(css).toContain('background-size: 300% 300%');
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('var(--audio-level');
    expect(css).not.toContain('animation:'); // No simulated/timer-driven listening movement.
  });
});
