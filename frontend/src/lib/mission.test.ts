import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, buildMission, parseNumber, parseTarget, validateForm } from "./mission";

describe("parseNumber", () => {
  it("treats empty and non-numeric input as NaN rather than 0", () => {
    expect(parseNumber("")).toBeNaN();
    expect(parseNumber("  ")).toBeNaN();
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("-89.5")).toBe(-89.5);
  });
});

describe("validateForm", () => {
  it("accepts the defaults", () => {
    expect(validateForm(DEFAULT_FORM)).toEqual({});
  });

  it("flags out-of-range and missing values", () => {
    const errors = validateForm({
      ...DEFAULT_FORM,
      latitude: "-95",
      longitude: "",
      searchRadiusKm: "0",
      maxSlopeDeg: "91",
      topK: "2.5",
      targetName: "   ",
    });
    expect(errors.latitude).toBeDefined();
    expect(errors.longitude).toBeDefined();
    expect(errors.searchRadiusKm).toBeDefined();
    expect(errors.maxSlopeDeg).toBeDefined();
    expect(errors.topK).toBeDefined();
    expect(errors.targetName).toBeDefined();
  });

});

describe("buildMission", () => {
  it("maps the form to the backend schema", () => {
    const { request } = buildMission(DEFAULT_FORM);
    expect(request).toMatchObject({
      mission_name: "South Pole selected point",
      constraints: { max_slope_degrees: 8, max_roughness: 2, min_landing_diameter_m: 100, avoid_craters: true },
      preferences: { sunlight: 1, resource_proximity: 1 },
      top_k: 10,
    });
    expect(Object.keys(request).sort()).toEqual(["constraints", "mission_name", "preferences", "profile", "region", "spacecraft", "top_k"]);
    expect(request.profile).toEqual({ vehicle_type: "lander", surface_preference: "none", risk_tolerance: "conservative" });
    expect(request.spacecraft).toMatchObject({
      name: "Lunar Surveyor",
      dry_mass_kg: 1200,
      payload_mass_kg: 250,
      propellant_mass_kg: 800,
      landing_footprint_diameter_m: 80,
    });
  });

});

describe("parseTarget", () => {
  it("returns null until both coordinates are valid", () => {
    expect(parseTarget({ latitude: "-89.5", longitude: "" })).toBeNull();
    expect(parseTarget({ latitude: "120", longitude: "0" })).toBeNull();
    expect(parseTarget({ latitude: "-89.5", longitude: "0" })).toEqual({ latitude: -89.5, longitude: 0 });
  });
});
