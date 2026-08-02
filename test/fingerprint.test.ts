import { describe, expect, test } from "bun:test";
import {
  applyCanvasNoise,
  createFingerprintProfile,
  createCanvasNoiseSeed,
  getProtectionConfig,
  normalizeHardwareConcurrency,
  normalizeRequestHeaders,
  normalizeScreenDimension,
  normalizeScreenSize,
  normalizeSettings,
  normalizeUserAgent,
  profileToBrowserValues
} from "../src/shared/fingerprint";

describe("fingerprint normalization", () => {
  test("keeps the browser family and version while normalizing the platform", () => {
    const userAgent =
      "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";

    expect(normalizeUserAgent(userAgent)).toBe(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0"
    );
    expect(normalizeUserAgent("Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36")).toContain(
      "Chrome/125.0.0.0"
    );
  });

  test("rounds high-entropy dimensions and hardware values into bounded buckets", () => {
    expect(normalizeScreenDimension(1920)).toBe(1900);
    expect(normalizeScreenDimension(1366)).toBe(1300);
    expect(normalizeScreenDimension(0)).toBe(800);
    expect(normalizeScreenDimension(99999)).toBe(3800);
    expect(normalizeHardwareConcurrency(1)).toBe(2);
    expect(normalizeHardwareConcurrency(6)).toBe(8);
    expect(normalizeScreenSize(1910, 1070)).toEqual({ width: 1920, height: 1080 });
    expect(normalizeScreenSize(1366, 768)).toEqual({ width: 1366, height: 768 });
  });

  test("creates one coherent profile for HTTP and JavaScript surfaces", () => {
    const profile = createFingerprintProfile({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      screenWidth: 1920,
      screenHeight: 1080,
      hardwareConcurrency: 16,
      deviceMemory: 32
    });
    const values = profileToBrowserValues(profile);

    expect(values.userAgent).toBe(profile.userAgent);
    expect(values.platform).toBe(profile.platform);
    expect(values.screenWidth).toBe(profile.screen.width);
    expect(profile.screen).toMatchObject({ width: 1920, height: 1080 });
    expect(values.hardwareConcurrency).toBe(profile.hardwareConcurrency);
    expect(values.webglVendor).toBe("Mozilla");
    expect(values.webglRenderer).toBe("Mozilla");
    expect(values.webglRenderer).not.toContain("Nvidia");
  });

  test("migrates old settings and rejects unknown protection modes", () => {
    expect(normalizeSettings({ enableHeaderSpoofing: false })).toEqual({
      settingsVersion: 2,
      enableHeaderSpoofing: false,
      enableJsSpoofing: true,
      protectionMode: "balanced"
    });
    expect(normalizeSettings({ protectionMode: "unknown" })).toMatchObject({
      settingsVersion: 2,
      protectionMode: "balanced"
    });
    expect(getProtectionConfig("strict")).toMatchObject({
      mode: "strict",
      maskAudio: true,
      maskFonts: true,
      maskMediaDevices: true,
      maskWorkers: true
    });
  });
});

describe("request header normalization", () => {
  test("only changes identifying headers and preserves navigation/cache headers", () => {
    const profile = createFingerprintProfile({ userAgent: "Firefox/140.0 rv:140.0" });
    const input = [
      { name: "User-Agent", value: "original" },
      { name: "Accept-Language", value: "ja-JP" },
      { name: "DNT", value: "0" },
      { name: "Sec-CH-UA-Platform", value: '"Linux"' },
      { name: "Referer", value: "https://example.test/page" },
      { name: "If-None-Match", value: '"etag"' },
      { name: "Upgrade-Insecure-Requests", value: "1" }
    ];

    const output = normalizeRequestHeaders(input, profile);

    expect(output).not.toBe(input);
    expect(output[0]?.value).toBe(profile.userAgent);
    expect(output[1]?.value).toBe(profile.acceptLanguage);
    expect(output[2]?.value).toBe("1");
    expect(output[3]?.value).toBe('"Windows"');
    expect(output[4]).toEqual(input[4]);
    expect(output[5]).toEqual(input[5]);
    expect(output[6]).toEqual(input[6]);
    expect(input[0]?.value).toBe("original");
    expect(normalizeRequestHeaders(undefined, profile)).toBeUndefined();
  });
});

describe("canvas masking", () => {
  test("is deterministic within a document and leaves alpha unchanged", () => {
    const seed = createCanvasNoiseSeed({
      getRandomValues(values) {
        values[0] = 12345;
        return values;
      }
    });
    const original = new Uint8ClampedArray(64 * 64 * 4).fill(128);
    for (let index = 3; index < original.length; index += 4) {
      original[index] = 255;
    }

    const first = new Uint8ClampedArray(original);
    const second = new Uint8ClampedArray(original);
    applyCanvasNoise(first, 64, 64, seed);
    applyCanvasNoise(second, 64, 64, seed);

    expect(first).toEqual(second);
    expect(first).not.toEqual(original);
    for (let index = 3; index < first.length; index += 4) {
      expect(first[index]).toBe(255);
    }
  });

  test("does not alter small canvases used by page controls", () => {
    const data = new Uint8ClampedArray(16 * 16 * 4).fill(128);
    const original = new Uint8ClampedArray(data);
    applyCanvasNoise(data, 16, 16, 1);
    expect(data).toEqual(original);
  });
});
