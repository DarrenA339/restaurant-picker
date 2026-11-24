import { describe, expect, it } from "vitest";
import { releasePoint } from "./snap-points";

const points = [120, 344, 740];

describe("releasePoint", () => {
  it("goes to the nearest point when released slowly", () => {
    expect(releasePoint(200, 0, points)).toBe(120);
    expect(releasePoint(260, 0.1, points)).toBe(344);
    expect(releasePoint(600, -0.1, points)).toBe(740);
  });

  it("goes to the next point up on an upward flick", () => {
    expect(releasePoint(130, 1, points)).toBe(344);
    expect(releasePoint(344, 1, points)).toBe(740);
    expect(releasePoint(400, 1, points)).toBe(740);
  });

  it("goes to the next point down on a downward flick", () => {
    expect(releasePoint(730, -1, points)).toBe(344);
    expect(releasePoint(344, -1, points)).toBe(120);
    expect(releasePoint(300, -1, points)).toBe(120);
  });

  it("stays at the end points when flicked past them", () => {
    expect(releasePoint(740, 1, points)).toBe(740);
    expect(releasePoint(120, -1, points)).toBe(120);
  });
});
