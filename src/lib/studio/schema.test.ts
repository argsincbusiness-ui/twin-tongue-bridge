import { describe, expect, it } from "vitest";
import { fitDubTiming, podcastInputSchema, summarizeStudioUsage } from "./schema";

describe("Studio requirements", () => {
  const options = { tone: "friendly", length: "short", language: "en-US" };
  it("accepts exactly 10,000 podcast input characters and rejects 10,001", () => {
    expect(podcastInputSchema.safeParse({ ...options, input: "a".repeat(10000) }).success).toBe(true);
    expect(podcastInputSchema.safeParse({ ...options, input: "a".repeat(10001) }).success).toBe(false);
  });
  it("keeps gentle dub speed changes between 0.85x and 1.2x", () => {
    expect(fitDubTiming(8, 10).rate).toBe(0.85);
    expect(fitDubTiming(15, 10).rate).toBe(1.2);
    expect(fitDubTiming(11, 10)).toEqual({ rate: 1.1, fittedSeconds: 10, mismatch: false });
  });
  it("warns when the bounded dub speed cannot fit the original", () => {
    expect(fitDubTiming(15, 10).mismatch).toBe(true);
    expect(fitDubTiming(5, 10).mismatch).toBe(true);
  });
  it("totals generations and characters by user and South African day", () => {
    const rows = [
      { user_id: "one", created_at: "2026-10-26T21:00:00Z", tool: "podcast", language: "en-US", character_count: 10, generation_kind: "script" },
      { user_id: "one", created_at: "2026-10-26T22:00:00Z", tool: "dubbing", language: "zu-ZA", character_count: 20, generation_kind: "production" },
    ];
    expect(summarizeStudioUsage(rows, false)[0]).toMatchObject({ generations: 2, characters: 30 });
    expect(summarizeStudioUsage(rows, true)).toHaveLength(2);
  });
});