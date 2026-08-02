import { afterEach, describe, expect, test } from "bun:test";
import { installMainWorldProtection } from "../src/content-main-world";
import { createFingerprintProfile, getProtectionConfig } from "../src/shared/fingerprint";

type GlobalDescriptor = PropertyDescriptor | undefined;

const globalNames = [
  "window",
  "navigator",
  "screen",
  "document",
  "HTMLCanvasElement",
  "CanvasRenderingContext2D",
  "WebGLRenderingContext",
  "WebGL2RenderingContext",
  "AnalyserNode",
  "FontFaceSet",
  "AudioBuffer",
  "BaseAudioContext"
] as const;
const savedGlobals = new Map<string, GlobalDescriptor>();

function setGlobal(name: string, value: unknown): void {
  if (!savedGlobals.has(name)) {
    savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  });
}

function restoreGlobals(): void {
  for (const name of globalNames) {
    const descriptor = savedGlobals.get(name);
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete (globalThis as unknown as Record<string, unknown>)[name];
    }
  }
  savedGlobals.clear();
}

afterEach(() => {
  restoreGlobals();
});

describe("main-world protection lifecycle", () => {
  test("applies coherent values and restores browser descriptors when disabled", () => {
    const navigatorPrototype = {};
    const originalNavigatorValues = {
      userAgent: "original-user-agent",
      platform: "Linux x86_64",
      language: "ja-JP",
      languages: ["ja-JP", "ja"],
      hardwareConcurrency: 12,
      doNotTrack: "0",
      vendor: "Original Vendor",
      product: "Gecko",
      productSub: "20030107",
      cookieEnabled: true,
      javaEnabled: false
    };
    for (const [key, value] of Object.entries(originalNavigatorValues)) {
      Object.defineProperty(navigatorPrototype, key, {
        configurable: true,
        enumerable: true,
        get: () => value
      });
    }
    const fakeNavigator = Object.create(navigatorPrototype) as Navigator;

    const screenPrototype = {};
    for (const [key, value] of Object.entries({ width: 2560, height: 1440 })) {
      Object.defineProperty(screenPrototype, key, {
        configurable: true,
        enumerable: true,
        get: () => value
      });
    }
    const fakeScreen = Object.create(screenPrototype) as Screen;
    const fakeWindow = {};
    setGlobal("window", fakeWindow);
    setGlobal("navigator", fakeNavigator);
    setGlobal("screen", fakeScreen);

    const profile = createFingerprintProfile({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      screenWidth: 2560,
      screenHeight: 1440,
      hardwareConcurrency: 12
    });
    const config = getProtectionConfig("balanced");
    const originalTimezoneOffset = new Date().getTimezoneOffset();
    const originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    installMainWorldProtection(profile, config, true);
    expect(fakeNavigator.userAgent).toBe(profile.userAgent);
    expect(fakeNavigator.platform).toBe("Win32");
    expect(fakeNavigator.languages).toEqual(["en-US", "en"]);
    expect(fakeScreen.width).toBe(profile.screen.width);
    expect(new Date().getTimezoneOffset()).toBe(0);
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");

    installMainWorldProtection(profile, config, false);
    expect(fakeNavigator.userAgent).toBe(originalNavigatorValues.userAgent);
    expect(fakeNavigator.platform).toBe(originalNavigatorValues.platform);
    expect(fakeScreen.width).toBe(2560);
    expect(new Date().getTimezoneOffset()).toBe(originalTimezoneOffset);
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(originalTimezone);
  });

  test("masks canvas, WebGL, audio, and font probes in strict mode", () => {
    class FakeCanvasRenderingContext2D {
      readonly canvas: FakeCanvas;
      private pixels = new Uint8ClampedArray(64 * 64 * 4).fill(128);

      constructor(canvas: FakeCanvas) {
        this.canvas = canvas;
      }

      getImageData(): ImageData {
        return {
          data: new Uint8ClampedArray(this.pixels),
          width: this.canvas.width,
          height: this.canvas.height
        } as unknown as ImageData;
      }

      putImageData(imageData: ImageData): void {
        this.pixels = new Uint8ClampedArray(imageData.data);
      }

      getPixelChecksum(): number {
        return this.pixels.reduce((sum, value, index) => (sum + value * (index + 1)) % 1000000007, 0);
      }
    }

    class FakeCanvas {
      width = 64;
      height = 64;
      readonly context: FakeCanvasRenderingContext2D;

      constructor() {
        this.context = new FakeCanvasRenderingContext2D(this);
      }

      getContext(): FakeCanvasRenderingContext2D {
        return this.context;
      }

      toDataURL(): string {
        return `checksum:${this.context.getPixelChecksum()}`;
      }
    }

    class FakeWebGLRenderingContext {
      readonly VENDOR = 0x1f00;
      readonly RENDERER = 0x1f01;

      getParameter(parameter: number): string {
        return parameter === this.VENDOR ? "Original GPU" : "Original Renderer";
      }

      getExtension(): object {
        return {};
      }

      getSupportedExtensions(): string[] {
        return ["WEBGL_debug_renderer_info", "OES_texture_float"];
      }

      readPixels(_x: number, _y: number, _width: number, _height: number, _format: number, _type: number, pixels: Uint8Array): void {
        pixels.fill(128);
      }
    }

    class FakeAnalyserNode {
      getFloatFrequencyData(values: Float32Array): void {
        values.fill(1);
      }

      getByteFrequencyData(values: Uint8Array): void {
        values.fill(128);
      }
    }

    class FakeFontFaceSet {
      check(): boolean {
        return false;
      }
    }

    class FakeAudioBuffer {
      private readonly values = new Float32Array(32).fill(1);

      getChannelData(): Float32Array {
        return this.values;
      }

      copyFromChannel(destination: Float32Array): void {
        destination.set(this.values.subarray(0, destination.length));
      }
    }

    class FakeBaseAudioContext {
      get sampleRate(): number {
        return 48000;
      }
    }

    const fakeDocument = {
      baseURI: "https://example.test/",
      fonts: new FakeFontFaceSet(),
      createElement(tagName: string): FakeCanvas {
        if (tagName !== "canvas") {
          throw new Error(`Unexpected element: ${tagName}`);
        }
        return new FakeCanvas();
      }
    };
    const fakeNavigator = Object.create(null) as Navigator;
    const fakeScreen = Object.create(null) as Screen;
    const fakeWindow = {};
    setGlobal("window", fakeWindow);
    setGlobal("navigator", fakeNavigator);
    setGlobal("screen", fakeScreen);
    setGlobal("document", fakeDocument);
    setGlobal("HTMLCanvasElement", FakeCanvas);
    setGlobal("CanvasRenderingContext2D", FakeCanvasRenderingContext2D);
    setGlobal("WebGLRenderingContext", FakeWebGLRenderingContext);
    setGlobal("WebGL2RenderingContext", FakeWebGLRenderingContext);
    setGlobal("AnalyserNode", FakeAnalyserNode);
    setGlobal("FontFaceSet", FakeFontFaceSet);
    setGlobal("AudioBuffer", FakeAudioBuffer);
    setGlobal("BaseAudioContext", FakeBaseAudioContext);

    const profile = createFingerprintProfile({ screenWidth: 1920, screenHeight: 1080 });
    const config = getProtectionConfig("strict");
    const canvas = new FakeCanvas();
    const originalCanvasChecksum = canvas.context.getPixelChecksum();
    const originalWebgl = new FakeWebGLRenderingContext();
    const originalAudio = new FakeAnalyserNode();
    const audioValues = new Float32Array([1, 1, 1, 1, 1, 1, 1]);
    const originalFont = new FakeFontFaceSet();
    const originalAudioBuffer = new FakeAudioBuffer();
    const copiedAudioValues = new Float32Array(32);
    const originalSampleRate = new FakeBaseAudioContext().sampleRate;

    installMainWorldProtection(profile, config, true);

    expect(canvas.toDataURL()).not.toBe(`checksum:${originalCanvasChecksum}`);
    expect(originalWebgl.getParameter(originalWebgl.VENDOR)).toBe("Mozilla");
    expect(originalWebgl.getParameter(originalWebgl.RENDERER)).toBe("Mozilla");
    expect(originalWebgl.getExtension("WEBGL_debug_renderer_info")).toBeNull();
    expect(originalWebgl.getSupportedExtensions()).not.toContain("WEBGL_debug_renderer_info");
    const pixels = new Uint8Array(128).fill(128);
    originalWebgl.readPixels(0, 0, 8, 4, 0, 0, pixels);
    expect(pixels.some((value) => value !== 128)).toBe(true);
    originalAudio.getFloatFrequencyData(audioValues);
    expect(audioValues.some((value) => value !== 1)).toBe(true);
    const channelValues = originalAudioBuffer.getChannelData();
    originalAudioBuffer.copyFromChannel(copiedAudioValues);
    expect(channelValues.some((value) => value !== 1)).toBe(true);
    expect(copiedAudioValues.some((value) => value !== 1)).toBe(true);
    expect(new FakeBaseAudioContext().sampleRate).toBe(profile.audioSampleRate);
    expect(originalFont.check("16px Arial")).toBe(true);
    expect(originalFont.check("16px Private System Font")).toBe(false);

    installMainWorldProtection(profile, config, false);

    expect(canvas.toDataURL()).toBe(`checksum:${originalCanvasChecksum}`);
    expect(originalWebgl.getParameter(originalWebgl.VENDOR)).toBe("Original GPU");
    expect(originalWebgl.getExtension("WEBGL_debug_renderer_info")).toEqual({});
    expect(originalAudioBuffer.getChannelData().every((value) => value === 1)).toBe(true);
    expect(new FakeBaseAudioContext().sampleRate).toBe(originalSampleRate);
    expect(originalFont.check("16px Arial")).toBe(false);
  });
});
