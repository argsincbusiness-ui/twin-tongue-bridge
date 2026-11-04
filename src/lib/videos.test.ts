import { describe, expect, it } from "vitest";
import {
  MAX_VIDEO_BYTES,
  formatDuration,
  libraryTitle,
  toolLabel,
  validateVideoFile,
} from "./videos";

describe("video file validation", () => {
  it("accepts a normal video file", () => {
    expect(validateVideoFile({ type: "video/mp4", size: 1024 })).toBeNull();
    expect(validateVideoFile({ type: "video/webm", size: MAX_VIDEO_BYTES })).toBeNull();
  });

  it("rejects non-video files with a friendly message", () => {
    expect(validateVideoFile({ type: "audio/mpeg", size: 1024 })).toMatch(/video file/i);
    expect(validateVideoFile({ type: "image/png", size: 1024 })).toMatch(/video file/i);
  });

  it("rejects files over the 200 MB cap", () => {
    const err = validateVideoFile({ type: "video/mp4", size: MAX_VIDEO_BYTES + 1 });
    expect(err).toMatch(/200 MB/);
  });

  it("rejects empty files", () => {
    expect(validateVideoFile({ type: "video/mp4", size: 0 })).toMatch(/empty/i);
  });
});

describe("video library helpers", () => {
  it("labels every known tool", () => {
    expect(toolLabel("upload")).toBe("Upload");
    expect(toolLabel("voice-over")).toBe("Voice-over");
    expect(toolLabel("dubbing")).toBe("Dubbing");
    expect(toolLabel("podcast")).toBe("Podcast");
    expect(toolLabel("coach")).toBe("Coach");
  });

  it("builds a default title with tool, language and date", () => {
    expect(libraryTitle("voice-over", "isiZulu", new Date("2026-01-02T09:00:00Z"))).toBe(
      "Voice-over · isiZulu · 2 Jan 2026",
    );
  });

  it("formats durations", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(9)).toBe("0:09");
  });
});
