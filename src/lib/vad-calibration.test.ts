import { describe, expect, it } from "vitest";
import {
  buildNoiseProfile,
  classifyNoise,
  meterPercent,
  percentile,
  suggestPause,
  suggestThreshold,
} from "./vad-calibration";

describe("percentile", () => {
  it("returns 0 for an empty set", () => {
    expect(percentile([], 0.5)).toBe(0);
  });
  it("finds the median and upper tail", () => {
    const v = [0.01, 0.02, 0.03, 0.04, 0.05];
    expect(percentile(v, 0.5)).toBe(0.03);
    expect(percentile(v, 0.95)).toBe(0.05);
  });
});

describe("classifyNoise", () => {
  it("buckets by floor", () => {
    expect(classifyNoise(0.005)).toBe("quiet");
    expect(classifyNoise(0.02)).toBe("moderate");
    expect(classifyNoise(0.04)).toBe("noisy");
    expect(classifyNoise(0.1)).toBe("very-noisy");
  });
});

describe("suggestPause", () => {
  it("gives longer pauses in louder rooms", () => {
    expect(suggestPause("quiet")).toBe(2);
    expect(suggestPause("moderate")).toBe(3);
    expect(suggestPause("noisy")).toBe(4);
    expect(suggestPause("very-noisy")).toBe(5);
  });
});

describe("suggestThreshold", () => {
  it("stays within safe bounds", () => {
    expect(suggestThreshold(0, 0)).toBe(0.01);
    expect(suggestThreshold(1, 1)).toBe(0.2);
    expect(suggestThreshold(0.02, 0.03)).toBeCloseTo(0.044, 4);
  });
});

describe("buildNoiseProfile", () => {
  it("ignores invalid samples and produces a recommendation", () => {
    const p = buildNoiseProfile([0.005, 0.006, NaN, -1, 0.007, 0.05]);
    expect(p.samples).toBe(4);
    expect(p.noise).toBe("quiet");
    expect(p.suggestedPause).toBe(2);
    expect(p.suggestedThreshold).toBeGreaterThan(0.01);
  });

  it("handles no samples at all", () => {
    const p = buildNoiseProfile([]);
    expect(p.samples).toBe(0);
    expect(p.suggestedPause).toBe(2);
  });
});

describe("meterPercent", () => {
  it("clamps to 0-100", () => {
    expect(meterPercent(0)).toBe(0);
    expect(meterPercent(5)).toBe(100);
    expect(meterPercent(0.25)).toBe(100);
  });
});
