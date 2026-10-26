import { describe, expect, it } from "vitest";
import { assertLiveAccess, interpreterLanguages, interpreterPrompt } from "./live-interpreter";

describe("live interpreter", () => {
  it("uses the selected language pair", () => {
    const pair = interpreterLanguages("en-US", "zu-ZA");
    expect(pair.a).toBe("English (US)");
    expect(pair.b).toBe("Zulu");
    expect(interpreterPrompt(pair.a, pair.b)).toContain("English (US) to Zulu");
  });
  it("rejects unspecified and identical language pairs", () => {
    expect(() => interpreterLanguages("auto", "en-US")).toThrow();
    expect(() => interpreterLanguages("en-US", "en-GB")).toThrow();
    expect(() => interpreterLanguages("invalid", "zu-ZA")).toThrow();
  });
  it("keeps free access on the existing Speak and Type allowance", () => {
    expect(() => assertLiveAccess({ pro: false, admin: false })).toThrow("Live Interpreter needs Pro");
  });
  it("accepts Pro and admins", () => {
    expect(() => assertLiveAccess({ pro: true })).not.toThrow();
    expect(() => assertLiveAccess({ admin: true })).not.toThrow();
  });
  it("rejects suspended accounts even if Pro", () => {
    expect(() => assertLiveAccess({ pro: true, suspended: true })).toThrow("suspended");
  });
  it("fails closed when plan status cannot be read", () => {
    expect(() => assertLiveAccess(null)).toThrow("Could not check your plan");
  });
});