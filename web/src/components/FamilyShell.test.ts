import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FamilyShell } from "./FamilyShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/lenguas" }));
vi.mock("@/lib/useStore", () => ({ useStore: () => null }));

describe("family navigation icons", () => {
  it("gives Lenguas its own image while preserving accessible navigation labels", () => {
    const markup = renderToStaticMarkup(createElement(FamilyShell, null, "Contenido"));
    const languagesLink = markup.match(/<a[^>]*href="\/lenguas"[^>]*>.*?<\/a>/)?.[0];

    expect(languagesLink).toBeDefined();
    expect(languagesLink).toContain('aria-current="page"');
    expect(languagesLink).toContain("Lenguas (lab)");
    expect(languagesLink).toContain(encodeURIComponent("/icons/languages.png"));
    expect(languagesLink).not.toContain(encodeURIComponent("/icons/chat.png"));
    expect(markup).toContain('aria-label="Abrir menú"');
    expect(markup).toContain('aria-label="Navegación de la familia"');
    expect(markup).toContain('class="brand-mark"');
  });
});
