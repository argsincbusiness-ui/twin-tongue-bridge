import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, detectedCodeToName, toGoogleCode } from "./google-translate";

describe("toGoogleCode", () => {
  it("maps UI language names to Google codes", () => {
    expect(toGoogleCode("English (US)")).toBe("en");
    expect(toGoogleCode("Spanish (Mexico)")).toBe("es");
    expect(toGoogleCode("Chinese (Traditional)")).toBe("zh-TW");
    expect(toGoogleCode("Chinese (Simplified)")).toBe("zh-CN");
    expect(toGoogleCode("Portuguese (Portugal)")).toBe("pt-PT");
    expect(toGoogleCode("Portuguese (Brazil)")).toBe("pt");
  });

  it("accepts raw BCP-47 tags", () => {
    expect(toGoogleCode("fr-CA")).toBe("fr");
    expect(toGoogleCode("de")).toBe("de");
  });

  it("returns null for auto", () => {
    expect(toGoogleCode("auto")).toBeNull();
    expect(toGoogleCode("  AUTO ")).toBeNull();
  });
});

describe("detectedCodeToName", () => {
  it("expands codes to English names", () => {
    expect(detectedCodeToName("es")).toBe("Spanish");
    expect(detectedCodeToName("zh-TW")).toContain("Chinese");
  });
  it("handles missing values", () => {
    expect(detectedCodeToName(undefined)).toBeUndefined();
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeHtmlEntities("It&#39;s fine")).toBe("It's fine");
    expect(decodeHtmlEntities("caf&#xe9;")).toBe("café");
  });
});
