export type ProtectionMode = "balanced" | "strict";

export const SETTINGS_VERSION = 2;

export interface PrivacySettings {
  settingsVersion: number;
  enableHeaderSpoofing: boolean;
  enableJsSpoofing: boolean;
  protectionMode: ProtectionMode;
}

export interface FingerprintSource {
  userAgent?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

export interface FingerprintProfile {
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  acceptLanguage: string;
  doNotTrack: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    availLeft: number;
    availTop: number;
    pixelDepth: number;
    colorDepth: number;
  };
  timezone: {
    timeZone: string;
    offset: number;
  };
  webgl: {
    vendor: string;
    renderer: string;
  };
  connection: {
    effectiveType: string;
    rtt: number;
    downlink: number;
    saveData: boolean;
  };
  battery: {
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    level: number;
  };
  mediaDevices: {
    videoInputs: number;
    audioInputs: number;
    audioOutputs: number;
  };
  fonts: Array<{ name: string; available: boolean }>;
  devices: Array<{ kind: string; label: string }>;
  audioSampleRate: number;
}

export interface ProtectionConfig {
  mode: ProtectionMode;
  maskCanvas: boolean;
  maskWebGL: boolean;
  maskAudio: boolean;
  maskFonts: boolean;
  maskMediaDevices: boolean;
  maskTimezone: boolean;
  maskWorkers: boolean;
}

export interface HeaderValue {
  name: string;
  value?: string;
}

export interface ScreenSize {
  width: number;
  height: number;
}

const COMMON_FONTS = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Georgia",
  "Tahoma",
  "Trebuchet MS",
  "Impact",
  "Comic Sans MS",
  "Arial Black"
];

const COMMON_SCREEN_SIZES: ScreenSize[] = [
  { width: 800, height: 600 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 }
];

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  settingsVersion: SETTINGS_VERSION,
  enableHeaderSpoofing: true,
  enableJsSpoofing: true,
  protectionMode: "balanced"
};

export function normalizeSettings(value: unknown): PrivacySettings {
  if (!isRecord(value)) {
    return { ...DEFAULT_PRIVACY_SETTINGS };
  }

  return {
    settingsVersion: SETTINGS_VERSION,
    enableHeaderSpoofing: value.enableHeaderSpoofing !== false,
    enableJsSpoofing: value.enableJsSpoofing !== false,
    protectionMode: value.protectionMode === "strict" ? "strict" : "balanced"
  };
}

export function getProtectionConfig(mode: ProtectionMode): ProtectionConfig {
  const strict = mode === "strict";
  return {
    mode,
    maskCanvas: true,
    maskWebGL: true,
    maskAudio: strict,
    maskFonts: strict,
    maskMediaDevices: strict,
    maskTimezone: true,
    maskWorkers: strict
  };
}

export function normalizeUserAgent(userAgent: string | undefined): string {
  const original = userAgent?.trim() || DEFAULT_USER_AGENT;
  const firefoxMatch = /rv:([\d.]+).*Firefox\/([\d.]+)/i.exec(original);

  if (firefoxMatch) {
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${firefoxMatch[1]}) Gecko/20100101 Firefox/${firefoxMatch[2]}`;
  }

  const chromiumMatch = /Chrome\/([\d.]+)/i.exec(original);
  if (chromiumMatch) {
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromiumMatch[1]} Safari/537.36`;
  }

  return original.replace(/\([^)]*\)/, "(Windows NT 10.0; Win64; x64)");
}

export function normalizeScreenDimension(value: number | undefined, minimum = 800): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  const bounded = Math.min(Math.max(Math.floor(value as number), minimum), 3840);
  return Math.max(minimum, Math.floor(bounded / 100) * 100);
}

export function normalizeScreenSize(
  width: number | undefined,
  height: number | undefined
): ScreenSize {
  const sourceWidth = Number.isFinite(width) ? Math.floor(width as number) : 1920;
  const sourceHeight = Number.isFinite(height) ? Math.floor(height as number) : 1080;
  const boundedWidth = Math.min(Math.max(sourceWidth, 800), 3840);
  const boundedHeight = Math.min(Math.max(sourceHeight, 600), 2160);

  return COMMON_SCREEN_SIZES.reduce((closest, candidate) => {
    const currentDistance =
      Math.abs(closest.width - boundedWidth) + Math.abs(closest.height - boundedHeight);
    const candidateDistance =
      Math.abs(candidate.width - boundedWidth) + Math.abs(candidate.height - boundedHeight);
    return candidateDistance < currentDistance ? candidate : closest;
  });
}

export function normalizeHardwareConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value) || (value as number) <= 2) {
    return 2;
  }
  if ((value as number) <= 4) {
    return 4;
  }
  return 8;
}

export function normalizeDeviceMemory(value: number | undefined): number {
  if (!Number.isFinite(value) || (value as number) <= 4) {
    return 4;
  }
  return 8;
}

export function createFingerprintProfile(source: FingerprintSource = {}): FingerprintProfile {
  const screenSize = normalizeScreenSize(source.screenWidth, source.screenHeight);
  const width = screenSize.width;
  const height = screenSize.height;
  const userAgent = normalizeUserAgent(source.userAgent);

  return {
    userAgent,
    platform: "Win32",
    language: "en-US",
    languages: ["en-US", "en"],
    acceptLanguage: "en-US,en;q=0.9",
    doNotTrack: "1",
    hardwareConcurrency: normalizeHardwareConcurrency(source.hardwareConcurrency),
    deviceMemory: normalizeDeviceMemory(source.deviceMemory),
    screen: {
      width,
      height,
      availWidth: width,
      availHeight: height,
      availLeft: 0,
      availTop: 0,
      pixelDepth: 24,
      colorDepth: 24
    },
    timezone: {
      timeZone: "UTC",
      offset: 0
    },
    webgl: {
      vendor: "Mozilla",
      renderer: "Mozilla"
    },
    connection: {
      effectiveType: "4g",
      rtt: 50,
      downlink: 10,
      saveData: false
    },
    battery: {
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1
    },
    mediaDevices: {
      videoInputs: 1,
      audioInputs: 1,
      audioOutputs: 1
    },
    fonts: COMMON_FONTS.map((name) => ({ name, available: true })),
    devices: [
      { kind: "audioinput", label: "" },
      { kind: "videoinput", label: "" },
      { kind: "audiooutput", label: "" }
    ],
    audioSampleRate: 44100
  };
}

export function profileToBrowserValues(profile: FingerprintProfile): BrowserValues {
  return {
    userAgent: profile.userAgent,
    platform: profile.platform,
    language: profile.language,
    screenWidth: profile.screen.width,
    screenHeight: profile.screen.height,
    hardwareConcurrency: profile.hardwareConcurrency,
    doNotTrack: profile.doNotTrack,
    webglVendor: profile.webgl.vendor,
    webglRenderer: profile.webgl.renderer,
    fonts: profile.fonts,
    devices: profile.devices,
    batteryCharging: profile.battery.charging,
    batteryLevel: profile.battery.level,
    connectionType: profile.connection.effectiveType,
    downlink: profile.connection.downlink,
    menubarVisible: false,
    toolbarVisible: false,
    mp4Support: "probably",
    webmSupport: "probably"
  };
}

export function normalizeRequestHeaders(
  headers: readonly HeaderValue[] | undefined,
  profile: FingerprintProfile
): HeaderValue[] | undefined {
  if (!headers) {
    return undefined;
  }

  return headers.map((header) => {
    const name = header.name.toLowerCase();
    const replacement =
      name === "user-agent"
        ? profile.userAgent
        : name === "accept-language"
          ? profile.acceptLanguage
          : name === "dnt"
            ? profile.doNotTrack
            : name === "sec-ch-ua-platform"
              ? '"Windows"'
              : name === "sec-ch-ua-mobile"
                ? "?0"
                : undefined;

    return replacement === undefined
      ? { ...header }
      : {
          ...header,
          value: replacement
        };
  });
}

export function createCanvasNoiseSeed(randomSource?: {
  getRandomValues(values: Uint32Array): Uint32Array;
}): number {
  try {
    const source =
      randomSource ?? (typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined);
    if (source) {
      const values = new Uint32Array(1);
      source.getRandomValues(values);
      return values[0];
    }
  } catch {
    // A fallback seed still gives per-document variation when Web Crypto is unavailable.
  }

  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function applyCanvasNoise(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  seed: number,
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

export function noiseHash(seed: number, value: number): number {
  let hash = (seed ^ Math.imul(value | 0, 0x45d9f3b)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
