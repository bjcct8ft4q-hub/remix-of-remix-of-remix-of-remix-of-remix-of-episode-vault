import { describe, it, expect } from "vitest";
import { isHalloweenSeason } from "./season";
describe("Halloween season", () => {
  it("starts 5 October", () => { expect(isHalloweenSeason(new Date(2026, 9, 5))).toBe(true); expect(isHalloweenSeason(new Date(2026, 9, 4))).toBe(false); });
  it("ends after 1 November", () => { expect(isHalloweenSeason(new Date(2026, 10, 1))).toBe(true); expect(isHalloweenSeason(new Date(2026, 10, 2))).toBe(false); });
});
