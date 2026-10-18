import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Face, Icon, type IconName } from "./ui";

const ICON_NAMES = [
  "chat", "report", "progress", "privacy", "menu", "mic",
  "photo", "book", "pause", "sound", "mute", "languages",
] as const satisfies readonly IconName[];

describe("generated app icons", () => {
  it.each(ICON_NAMES)("renders the %s asset without repeating the control label", (name) => {
    const markup = renderToStaticMarkup(createElement(Icon, { name }));

    expect(markup).toContain("<img");
    expect(markup).toContain(encodeURIComponent(`/icons/${name}.png`));
    expect(markup).toContain('class="app-icon"');
    expect(markup).toContain('alt=""');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('width="32"');
    expect(markup).toContain('height="32"');
    expect(markup).not.toContain("<svg");
  });

  it("keeps mood faces as their original scalable drawings", () => {
    const markup = renderToStaticMarkup(createElement(Face, { mood: "bien" }));

    expect(markup).toContain("<svg");
    expect(markup).toContain('width="64"');
    expect(markup).not.toContain("<img");
  });
});
