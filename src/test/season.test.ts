import { describe, expect, it } from "vitest";
import { isHalloweenSeason } from "@/lib/season";

describe("Automatic Halloween season", () => {
  it("starts on 5 October every year", () => {
    for (const year of [2026, 2027, 2028]) {
      expect(isHalloweenSeason(new Date(year, 9, 4))).toBe(false);
      expect(isHalloweenSeason(new Date(year, 9, 5))).toBe(true);
      expect(isHalloweenSeason(new Date(year, 9, 31))).toBe(true);
    }
  });
  it("includes 1 November and ends on 2 November", () => {
    expect(isHalloweenSeason(new Date(2026, 10, 1))).toBe(true);
    expect(isHalloweenSeason(new Date(2026, 10, 2))).toBe(false);
    expect(isHalloweenSeason(new Date(2026, 0, 1))).toBe(false);
    expect(isHalloweenSeason(new Date(2026, 11, 31))).toBe(false);
  });
});