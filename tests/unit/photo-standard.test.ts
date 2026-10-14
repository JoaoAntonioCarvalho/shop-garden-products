import { describe, expect, it } from "vitest";
import { alphaBounds, standardPlacement, STANDARD_PHOTO } from "@/lib/photo-standard";

function image(width: number, height: number, opaque: Array<[number, number]>) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of opaque) data[(y * width + x) * 4 + 3] = 255;
  return data;
}

describe("foto padronizada", () => {
  it("acha o retângulo do produto pelo que não é transparente", () => {
    const data = image(10, 8, [
      [2, 1],
      [7, 5],
      [4, 3],
    ]);
    expect(alphaBounds(data, 10, 8)).toEqual({ x: 2, y: 1, width: 6, height: 5 });
    expect(alphaBounds(image(4, 4, []), 4, 4)).toBeNull();
  });

  it("ignora o resto quase transparente do recorte", () => {
    const data = image(6, 6, [[3, 3]]);
    data[3] = 10;
    expect(alphaBounds(data, 6, 6)).toEqual({ x: 3, y: 3, width: 1, height: 1 });
  });

  it("produto alto ocupa 76% da altura e fica centralizado", () => {
    const place = standardPlacement({ x: 0, y: 0, width: 400, height: 1000 });
    expect(place.height).toBeCloseTo(STANDARD_PHOTO.height * 0.76);
    expect(place.x + place.width / 2).toBeCloseTo(800);
    expect(place.y + place.height / 2).toBeCloseTo(1020);
  });

  it("produto largo ocupa 76% da largura", () => {
    const place = standardPlacement({ x: 50, y: 20, width: 1000, height: 300 });
    expect(place.width).toBeCloseTo(STANDARD_PHOTO.width * 0.76);
    expect(place.height).toBeLessThan(STANDARD_PHOTO.height * 0.76);
  });
});
