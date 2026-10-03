import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allowedTextPairs, colors, contrastRatio } from "@/lib/color";

describe("contraste das combinações de cor permitidas", () => {
  it.each(allowedTextPairs)(
    "$text sobre $background passa em AA (4.5:1)",
    ({ text, background }) => {
      expect(contrastRatio(colors[text], colors[background])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("vinho e musgo nunca aparecem um sobre o outro", () => {
    const forbidden = allowedTextPairs.filter(
      ({ text, background }) =>
        (text.startsWith("wine") && background.startsWith("moss-7")) ||
        (text.startsWith("wine") && background.startsWith("moss-9")) ||
        (text.startsWith("moss") && background.startsWith("wine-7")) ||
        (text.startsWith("moss") && background.startsWith("wine-8")),
    );
    expect(forbidden).toEqual([]);
    // O motivo da regra: o contraste entre as duas cores da marca é praticamente nulo.
    expect(contrastRatio(colors["wine-700"], colors["moss-700"])).toBeLessThan(1.5);
  });

  it("os tokens em TypeScript são os mesmos do CSS", () => {
    const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();
    for (const [name, hex] of Object.entries(colors)) {
      expect(css).toContain(`--color-${name}: ${hex.toLowerCase()};`);
    }
  });
});
