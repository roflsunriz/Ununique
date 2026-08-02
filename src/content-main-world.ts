import type { FingerprintProfile, ProtectionConfig } from "./shared/fingerprint";

type Restore = () => void;
type UnknownFunction = (...args: unknown[]) => unknown;
type ProtectionState = { restore: Restore };

export function installMainWorldProtection(
  profile: FingerprintProfile,
  config: ProtectionConfig,
  enabled: boolean
): void {
  function createCanvasSeed(): number {
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0];
    } catch {
      return Math.floor(Math.random() * 0xffffffff) >>> 0;
    }
  }

  function noiseHash(seed: number, value: number): number {
    let hash = (seed ^ Math.imul(value | 0, 0x45d9f3b)) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
    return (hash ^ (hash >>> 16)) >>> 0;
  }

  function clampByte(value: number): number {
    return Math.min(255, Math.max(0, value));
  }

  function installWorkerProfile(workerProfile: FingerprintProfile): void {
    const workerNavigatorPrototype = Object.getPrototypeOf(self.navigator) as object;
    const values: Record<string, unknown> = {
      userAgent: workerProfile.userAgent,
      platform: workerProfile.platform,
      language: workerProfile.language,
      languages: Object.freeze(workerProfile.languages.slice()),
      hardwareConcurrency: workerProfile.hardwareConcurrency,
      deviceMemory: workerProfile.deviceMemory,
      doNotTrack: workerProfile.doNotTrack,
      vendor: "Mozilla",
      product: "Gecko",
      productSub: "20100101"
    };

    for (const [key, value] of Object.entries(values)) {
      const descriptor = Object.getOwnPropertyDescriptor(workerNavigatorPrototype, key);
      if (!descriptor || descriptor.configurable === false) {
        continue;
      }
      try {
        Object.defineProperty(workerNavigatorPrototype, key, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get: () => value
        });
      } catch {
        // A browser may expose a non-configurable worker property.
      }
    }
  }

  const stateKey = "__UNUNIQUE_PROTECTION_V2__";
  const windowRecord = window as unknown as Record<string, unknown>;
  const existingState = windowRecord[stateKey] as ProtectionState | undefined;

  if (!enabled) {
    existingState?.restore();
    if (existingState) {
      delete windowRecord[stateKey];
    }
    return;
  }

  existingState?.restore();
  delete windowRecord[stateKey];

  const restores: Restore[] = [];
  const seed = createCanvasSeed();

  function rememberDescriptor(
    target: object,
    key: PropertyKey,
    replacement: PropertyDescriptor
  ): boolean {
    const original = Object.getOwnPropertyDescriptor(target, key);
    if (!original || original.configurable === false) {
      return false;
    }

    try {
      Object.defineProperty(target, key, replacement);
      restores.push(() => {
        try {
          Object.defineProperty(target, key, original);
        } catch (error) {
          console.warn("[Ununique] Failed to restore a browser property", error);
        }
      });
      return true;
    } catch (error) {
      console.warn("[Ununique] Browser property could not be masked", error);
      return false;
    }
  }

  function patchGetter(target: object, key: PropertyKey, getValue: () => unknown): void {
    const original = Object.getOwnPropertyDescriptor(target, key);
    if (!original) {
      return;
    }

    rememberDescriptor(target, key, {
      configurable: true,
      enumerable: original.enumerable,
      get: getValue
    });
  }

  function patchFunction(
    target: object,
    key: PropertyKey,
    createReplacement: (original: UnknownFunction) => UnknownFunction
  ): void {
    const original = Object.getOwnPropertyDescriptor(target, key);
    if (!original || typeof original.value !== "function") {
      return;
    }

    const replacement = createReplacement(original.value as UnknownFunction);
    rememberDescriptor(target, key, {
      ...original,
      value: replacement
    });
  }

  const navigatorPrototype = Object.getPrototypeOf(navigator) as object;
  const navigatorValues: Record<string, unknown> = {
    userAgent: profile.userAgent,
    platform: profile.platform,
    language: profile.language,
    languages: Object.freeze(profile.languages.slice()),
    hardwareConcurrency: profile.hardwareConcurrency,
    deviceMemory: profile.deviceMemory,
    doNotTrack: profile.doNotTrack,
    vendor: "Mozilla",
    product: "Gecko",
    productSub: "20100101",
    cookieEnabled: true,
    javaEnabled: false
  };

  for (const [key, value] of Object.entries(navigatorValues)) {
    if (key in navigator) {
      patchGetter(navigatorPrototype, key, () => value);
    }
  }

  if ("userAgentData" in navigator) {
    const versionMatch = /Firefox\/(\d+)/.exec(profile.userAgent);
    const version = versionMatch?.[1] ?? "140";
    patchGetter(navigatorPrototype, "userAgentData", () => ({
      brands: [{ brand: "Firefox", version }],
      mobile: false,
      platform: "Windows",
      getHighEntropyValues: async (hints: string[]) => {
        const values: Record<string, unknown> = {
          architecture: "x86",
          bitness: "64",
          model: "",
          platform: "Windows",
          platformVersion: "10.0.0",
          uaFullVersion: version,
          fullVersionList: [{ brand: "Firefox", version }]
        };
        return Object.fromEntries(hints.map((hint) => [hint, values[hint]]));
      }
    }));
  }

  const screenPrototype = Object.getPrototypeOf(screen) as object;
  const screenValues: Record<string, number> = {
    width: profile.screen.width,
    height: profile.screen.height,
    availWidth: profile.screen.availWidth,
    availHeight: profile.screen.availHeight,
    availLeft: profile.screen.availLeft,
    availTop: profile.screen.availTop,
    pixelDepth: profile.screen.pixelDepth,
    colorDepth: profile.screen.colorDepth
  };
  for (const [key, value] of Object.entries(screenValues)) {
    if (key in screen) {
      patchGetter(screenPrototype, key, () => value);
    }
  }

  if (config.maskTimezone) {
    patchFunction(
      Date.prototype,
      "getTimezoneOffset",
      () =>
        function () {
          return profile.timezone.offset;
        }
    );

    const dateTimeFormatPrototype = Intl.DateTimeFormat.prototype;
    patchFunction(
      dateTimeFormatPrototype,
      "resolvedOptions",
      (original) =>
        function (this: Intl.DateTimeFormat, ...args: unknown[]) {
          const options = original.apply(this, args) as Record<string, unknown>;
          return {
            ...options,
            timeZone: profile.timezone.timeZone
          };
        }
    );
  }

  if (config.maskCanvas && typeof HTMLCanvasElement !== "undefined") {
    const canvasContextPrototype =
      typeof CanvasRenderingContext2D !== "undefined"
        ? CanvasRenderingContext2D.prototype
        : undefined;
    const originalGetImageData = canvasContextPrototype?.getImageData as
      ((this: CanvasRenderingContext2D, ...args: unknown[]) => ImageData) | undefined;
    const originalPutImageData = canvasContextPrototype?.putImageData as
      ((this: CanvasRenderingContext2D, ...args: unknown[]) => void) | undefined;
    function applyNoise(
      data: Uint8ClampedArray,
      width: number,
      height: number,
      originX = 0,
      originY = 0
    ): void {
      if (width <= 16 || height <= 16) {
        return;
      }

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const pixel = y * width + x;
          const hash = noiseHash(seed, pixel + (originX + x) * 31 + (originY + y) * 131);
          if (hash % 47 !== 0) {
            continue;
          }

          const index = pixel * 4;
          if (index + 2 >= data.length) {
            return;
          }

          const delta = hash & 1 ? 1 : -1;
          data[index] = clampByte(data[index] + delta);
          data[index + 1] = clampByte(data[index + 1] - delta);
          data[index + 2] = clampByte(data[index + 2] + delta);
        }
      }
    }

    if (canvasContextPrototype && originalGetImageData) {
      patchFunction(
        canvasContextPrototype,
        "getImageData",
        (original) =>
          function (this: CanvasRenderingContext2D, ...args: unknown[]) {
            const imageData = original.apply(this, args) as ImageData;
            applyNoise(
              imageData.data,
              imageData.width,
              imageData.height,
              Number(args[0]) || 0,
              Number(args[1]) || 0
            );
            return imageData;
          }
      );
    }

    patchFunction(
      HTMLCanvasElement.prototype,
      "toDataURL",
      (original) =>
        function (this: HTMLCanvasElement, ...args: unknown[]) {
          if (
            !originalGetImageData ||
            !originalPutImageData ||
            this.width <= 16 ||
            this.height <= 16
          ) {
            return original.apply(this, args);
          }

          const sourceContext = this.getContext("2d");
          if (!sourceContext) {
            return original.apply(this, args);
          }

          const scratchCanvas = document.createElement("canvas");
          scratchCanvas.width = this.width;
          scratchCanvas.height = this.height;
          const scratchContext = scratchCanvas.getContext("2d");
          if (!scratchContext) {
            return original.apply(this, args);
          }

          const imageData = originalGetImageData.call(sourceContext, 0, 0, this.width, this.height);
          applyNoise(imageData.data, imageData.width, imageData.height);
          originalPutImageData.call(scratchContext, imageData, 0, 0);
          return original.apply(scratchCanvas, args);
        }
    );

    patchFunction(
      HTMLCanvasElement.prototype,
      "toBlob",
      (original) =>
        function (this: HTMLCanvasElement, ...args: unknown[]) {
          if (
            !originalGetImageData ||
            !originalPutImageData ||
            this.width <= 16 ||
            this.height <= 16
          ) {
            return original.apply(this, args);
          }

          const sourceContext = this.getContext("2d");
          const callback = args[0];
          if (!sourceContext || typeof callback !== "function") {
            return original.apply(this, args);
          }

          const scratchCanvas = document.createElement("canvas");
          scratchCanvas.width = this.width;
          scratchCanvas.height = this.height;
          const scratchContext = scratchCanvas.getContext("2d");
          if (!scratchContext) {
            return original.apply(this, args);
          }

          const imageData = originalGetImageData.call(sourceContext, 0, 0, this.width, this.height);
          applyNoise(imageData.data, imageData.width, imageData.height);
          originalPutImageData.call(scratchContext, imageData, 0, 0);
          return original.apply(scratchCanvas, args);
        }
    );
  }

  if (config.maskWebGL) {
    const webglParameter = (prototype: object): void => {
      patchFunction(
        prototype,
        "getParameter",
        (original) =>
          function (this: object, ...args: unknown[]) {
            const parameter = Number(args[0]);
            if (parameter === 0x1f00 || parameter === 0x9245) {
              return profile.webgl.vendor;
            }
            if (parameter === 0x1f01 || parameter === 0x9246) {
              return profile.webgl.renderer;
            }
            return original.apply(this, args);
          }
      );

      patchFunction(
        prototype,
        "getExtension",
        (original) =>
          function (this: object, ...args: unknown[]) {
            if (String(args[0]).toLowerCase() === "webgl_debug_renderer_info") {
              return null;
            }
            return original.apply(this, args);
          }
      );

      patchFunction(
        prototype,
        "getSupportedExtensions",
        (original) =>
          function (this: object, ...args: unknown[]) {
            const extensions = original.apply(this, args);
            return Array.isArray(extensions)
              ? extensions.filter((extension) => extension !== "WEBGL_debug_renderer_info")
              : extensions;
          }
      );

      if (config.mode === "strict") {
        patchFunction(
          prototype,
          "readPixels",
          (original) =>
            function (this: object, ...args: unknown[]) {
              const result = original.apply(this, args);
              const pixels = args[6];
              if (pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) {
                for (let index = 0; index < pixels.length; index += 97) {
                  pixels[index] = clampByte(pixels[index] + (noiseHash(seed, index) & 1 ? 1 : -1));
                }
              }
              return result;
            }
        );
      }
    };

    if (typeof WebGLRenderingContext !== "undefined") {
      webglParameter(WebGLRenderingContext.prototype);
    }
    if (typeof WebGL2RenderingContext !== "undefined") {
      webglParameter(WebGL2RenderingContext.prototype);
    }
  }

  if (config.maskAudio && typeof AnalyserNode !== "undefined") {
    patchFunction(
      AnalyserNode.prototype,
      "getFloatFrequencyData",
      (original) =>
        function (this: AnalyserNode, ...args: unknown[]) {
          const result = original.apply(this, args);
          const values = args[0];
          if (values instanceof Float32Array) {
            for (let index = 0; index < values.length; index += 7) {
              values[index] += noiseHash(seed, index) & 1 ? 0.01 : -0.01;
            }
          }
          return result;
        }
    );

    patchFunction(
      AnalyserNode.prototype,
      "getByteFrequencyData",
      (original) =>
        function (this: AnalyserNode, ...args: unknown[]) {
          const result = original.apply(this, args);
          const values = args[0];
          if (values instanceof Uint8Array) {
            for (let index = 0; index < values.length; index += 7) {
              values[index] = clampByte(values[index] + (noiseHash(seed, index) & 1 ? 1 : -1));
            }
          }
          return result;
        }
    );
  }

  if (config.maskAudio && typeof AudioBuffer !== "undefined") {
    const maskedAudioBuffers = new WeakMap<Float32Array, Float32Array>();
    const audioBufferPrototype = AudioBuffer.prototype;

    patchFunction(
      audioBufferPrototype,
      "getChannelData",
      (original) =>
        function (this: AudioBuffer, ...args: unknown[]) {
          const values = original.apply(this, args);
          if (!(values instanceof Float32Array)) {
            return values;
          }

          const existing = maskedAudioBuffers.get(values);
          if (existing) {
            return existing;
          }

          const masked = new Float32Array(values);
          for (let index = 0; index < masked.length; index += 7) {
            masked[index] += noiseHash(seed, index) & 1 ? 0.01 : -0.01;
          }
          maskedAudioBuffers.set(values, masked);
          return masked;
        }
    );

    patchFunction(
      audioBufferPrototype,
      "copyFromChannel",
      (original) =>
        function (this: AudioBuffer, ...args: unknown[]) {
          const result = original.apply(this, args);
          const values = args[0];
          if (values instanceof Float32Array) {
            for (let index = 0; index < values.length; index += 7) {
              values[index] += noiseHash(seed, index + (Number(args[2]) || 0)) & 1 ? 0.01 : -0.01;
            }
          }
          return result;
        }
    );
  }

  if (config.maskAudio && typeof BaseAudioContext !== "undefined") {
    patchGetter(BaseAudioContext.prototype, "sampleRate", () => profile.audioSampleRate);
  }

  if (config.maskFonts && typeof FontFaceSet !== "undefined" && document.fonts) {
    const fontSetPrototype = FontFaceSet.prototype;
    const allowedFonts = new Set(profile.fonts.map((font) => font.name.toLowerCase()));
    patchFunction(
      fontSetPrototype,
      "check",
      (original) =>
        function (this: FontFaceSet, ...args: unknown[]) {
          const descriptor = String(args[0] ?? "").toLowerCase();
          const normalizedDescriptor = descriptor.replace(/["']/g, " ");
          const hasAllowedFont = [...allowedFonts].some((fontName) => {
            const escapedName = fontName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new RegExp(`(?:^|[\\s,])${escapedName}(?:$|[\\s,])`, "i").test(
              normalizedDescriptor
            );
          });
          const hasGenericFont =
            /(?:^|[\s,])(serif|sans-serif|monospace|cursive|fantasy|system-ui|emoji|math|fangsong|ui-sans-serif|ui-serif|ui-monospace)(?:$|[\s,])/i.test(
              normalizedDescriptor
            );

          if (hasAllowedFont || hasGenericFont) {
            return true;
          }
          if (descriptor.trim()) {
            return false;
          }
          return original.apply(this, args);
        }
    );
  }

  if (config.maskMediaDevices && navigator.mediaDevices) {
    const mediaDevicesPrototype = Object.getPrototypeOf(navigator.mediaDevices) as object;
    patchFunction(mediaDevicesPrototype, "enumerateDevices", () => async () => [
      { deviceId: "", kind: "audioinput", label: "", groupId: "" },
      { deviceId: "", kind: "videoinput", label: "", groupId: "" },
      { deviceId: "", kind: "audiooutput", label: "", groupId: "" }
    ]);
  }

  if (config.maskMediaDevices && "getBattery" in navigator) {
    patchFunction(navigatorPrototype, "getBattery", () => async () => ({
      charging: profile.battery.charging,
      chargingTime: profile.battery.chargingTime,
      dischargingTime: profile.battery.dischargingTime,
      level: profile.battery.level,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined
    }));
  }

  if (config.maskMediaDevices && "connection" in navigator) {
    patchGetter(navigatorPrototype, "connection", () => ({
      effectiveType: profile.connection.effectiveType,
      rtt: profile.connection.rtt,
      downlink: profile.connection.downlink,
      saveData: profile.connection.saveData,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined
    }));
  }

  if (config.maskWorkers && typeof Worker !== "undefined") {
    const originalWorker = Worker;
    const originalWorkerConstructor = originalWorker as unknown as {
      new (scriptURL: string | URL, options?: WorkerOptions): Worker;
      prototype: object;
    };
    const maskedWorker = function (
      this: unknown,
      scriptURL: string | URL,
      options?: WorkerOptions
    ): Worker {
      if (options?.type === "module") {
        return new originalWorkerConstructor(scriptURL, options);
      }

      const absoluteURL = new URL(String(scriptURL), document.baseURI).href;
      const workerProfile = JSON.stringify(profile);
      const workerMask = `(${installWorkerProfile.toString()})(${workerProfile});importScripts(${JSON.stringify(absoluteURL)});`;
      const workerURL = URL.createObjectURL(
        new Blob([workerMask], { type: "application/javascript" })
      );
      const worker = new originalWorkerConstructor(workerURL, options);
      setTimeout(() => URL.revokeObjectURL(workerURL), 0);
      return worker;
    } as unknown as typeof Worker;

    (maskedWorker as unknown as { prototype: object }).prototype =
      originalWorkerConstructor.prototype;
    rememberDescriptor(windowRecord, "Worker", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: maskedWorker
    });
  }

  const state: ProtectionState = {
    restore: () => {
      for (const restore of restores.reverse()) {
        restore();
      }
    }
  };
  Object.defineProperty(windowRecord, stateKey, {
    configurable: true,
    enumerable: false,
    value: state,
    writable: false
  });
}
