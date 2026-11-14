import { describe, expect, it } from "vitest";
import { KM_PER_DEGREE } from "./geo";
import { buildSearchWindow } from "./region";

describe("buildSearchWindow", () => {
  it("spans every longitude when the window reaches the south pole", () => {
    const { region, coversPole } = buildSearchWindow(-89.5, 0, 25);
    expect(coversPole).toBe(true);
    expect(region.latitude_min).toBe(-90);
    expect(region.longitude_min).toBe(-180);
    expect(region.longitude_max).toBe(180);
    expect(region.latitude_max).toBeCloseTo(-89.5 + 25 / KM_PER_DEGREE, 3);
  });

  it("widens longitude by 1/cos(latitude) away from the poles", () => {
    const { region, coversPole } = buildSearchWindow(60, 10, 100);
    const dLat = 100 / KM_PER_DEGREE;
    expect(coversPole).toBe(false);
    expect(region.latitude_min).toBeCloseTo(60 - dLat, 3);
    const widest = 60 + dLat;
    const dLon = dLat / Math.cos((widest * Math.PI) / 180);
    expect(region.longitude_min).toBeCloseTo(10 - dLon, 3);
    expect(region.longitude_max).toBeCloseTo(10 + dLon, 3);
  });

  it("clamps to the antimeridian instead of producing out-of-range longitudes", () => {
    const { region } = buildSearchWindow(0, 175, 500);
    expect(region.longitude_max).toBe(180);
    expect(region.longitude_min).toBeGreaterThanOrEqual(-180);
  });

  it("always yields min <= max (the backend rejects anything else)", () => {
    for (const [lat, lon, r] of [[-89.9, 0, 0.5], [0, -180, 10], [85, 90, 300], [-45, 179.9, 2000]] as const) {
      const { region } = buildSearchWindow(lat, lon, r);
      expect(region.latitude_min).toBeLessThanOrEqual(region.latitude_max);
      expect(region.longitude_min).toBeLessThanOrEqual(region.longitude_max);
    }
  });
});
