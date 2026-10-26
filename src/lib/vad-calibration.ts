/**
 * Pure logic for the VAD calibration screen.
 *
 * Measures the room's ambient noise (RMS samples from Web Audio) and turns it
 * into a human-readable noise class plus a recommended end-of-utterance pause
 * threshold. Kept side-effect free so it can be unit-tested without a mic.
 */

import { clampPauseSeconds, type PauseSeconds } from "./duplex";

/** How long the calibration listens to the room, in milliseconds. */
export const CALIBRATION_MS = 5000;

/** Sampling interval for RMS readings during calibration. */
export const CALIBRATION_TICK_MS = 50;

export type NoiseClass = "quiet" | "moderate" | "noisy" | "very-noisy";

export interface NoiseProfile {
  /** Median RMS of the room (0–1). */
  floor: number;
  /** 95th-percentile RMS — captures intermittent bumps and chatter. */
  peak: number;
  noise: NoiseClass;
  /** Energy threshold the VAD should treat as speech. */
  suggestedThreshold: number;
  suggestedPause: PauseSeconds;
  samples: number;
}

/** Percentile of an unsorted numeric array (0–1 fraction). */
export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(fraction * (sorted.length - 1))),
  );
  return sorted[idx]!;
}

/** Bucket a measured noise floor into a descriptive class. */
export function classifyNoise(floor: number): NoiseClass {
  if (floor < 0.012) return "quiet";
  if (floor < 0.03) return "moderate";
  if (floor < 0.06) return "noisy";
  return "very-noisy";
}

/**
 * Louder rooms make the energy VAD trip on background sound, which cuts people
 * off early — so a noisier room gets a longer pause threshold.
 */
export function suggestPause(noise: NoiseClass): PauseSeconds {
  switch (noise) {
    case "quiet":
      return clampPauseSeconds(2);
    case "moderate":
      return clampPauseSeconds(3);
    case "noisy":
      return clampPauseSeconds(4);
    case "very-noisy":
      return clampPauseSeconds(5);
  }
}

/** Energy level above which audio is considered speech in this room. */
export function suggestThreshold(floor: number, peak: number): number {
  return Math.min(0.2, Math.max(0.01, Math.max(floor * 2.2, peak * 1.15)));
}

/** Build the full profile from raw RMS samples collected during calibration. */
export function buildNoiseProfile(samples: number[]): NoiseProfile {
  const clean = samples.filter((s) => Number.isFinite(s) && s >= 0);
  const floor = percentile(clean, 0.5);
  const peak = percentile(clean, 0.95);
  const noise = classifyNoise(floor);
  return {
    floor,
    peak,
    noise,
    suggestedThreshold: suggestThreshold(floor, peak),
    suggestedPause: suggestPause(noise),
    samples: clean.length,
  };
}

export const NOISE_LABEL: Record<NoiseClass, string> = {
  quiet: "Quiet room",
  moderate: "Normal room",
  noisy: "Noisy room",
  "very-noisy": "Very noisy",
};

/** One-line explanation shown next to the recommendation. */
export function noiseAdvice(profile: NoiseProfile): string {
  switch (profile.noise) {
    case "quiet":
      return `Background is very low, so short pauses are safe. ${profile.suggestedPause}s keeps turns snappy.`;
    case "moderate":
      return `Typical background level. ${profile.suggestedPause}s balances speed with not cutting you off.`;
    case "noisy":
      return `There's steady background sound. ${profile.suggestedPause}s avoids finalizing on room noise.`;
    case "very-noisy":
      return `Loud surroundings detected. ${profile.suggestedPause}s is safest — a headset mic will help a lot.`;
  }
}

/** Normalize an RMS reading to a 0–100 meter value for the UI. */
export function meterPercent(rms: number): number {
  const scaled = Math.sqrt(Math.min(rms, 0.25) / 0.25) * 100;
  return Math.round(Math.min(100, Math.max(0, scaled)));
}
