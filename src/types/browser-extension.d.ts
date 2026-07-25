type BrowserMessageType =
  "getSettings" | "saveSettings" | "getOriginalValues" | "getSpoofingValues" | "settingsChanged";

interface Settings {
  enableHeaderSpoofing: boolean;
  enableJsSpoofing: boolean;
}

interface FontAvailability {
  name: string;
  available: boolean;
}

interface DeviceSummary {
  kind: string;
  label: string;
}

interface BrowserValues {
  userAgent?: string;
  platform?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  hardwareConcurrency?: number | string;
  doNotTrack?: string | number;
  webglVendor?: string;
  webglRenderer?: string;
  fonts?: FontAvailability[];
  devices?: DeviceSummary[];
  batteryCharging?: boolean;
  batteryLevel?: number;
  connectionType?: string;
  downlink?: number;
  menubarVisible?: boolean;
  toolbarVisible?: boolean;
  mp4Support?: CanPlayTypeResult;
  webmSupport?: CanPlayTypeResult;
}

interface ExtensionMessage {
  type: BrowserMessageType;
  settings?: Settings;
}

interface SettingsResponse {
  settings?: Settings;
}

interface SpoofingValuesResponse {
  originalValues?: BrowserValues;
  spoofedValues?: BrowserValues;
}

interface RuntimeLastError {
  message?: string;
}

interface StorageChange<T = unknown> {
  oldValue?: T;
  newValue?: T;
}

interface RequestHeader {
  name: string;
  value?: string;
}

interface BeforeSendHeadersDetails {
  url: string;
  requestHeaders?: RequestHeader[];
}

interface TabInfo {
  id?: number;
}

interface BrowserApi {
  runtime: {
    lastError?: RuntimeLastError;
    getManifest(): { version: string };
    sendMessage<TResponse = unknown>(
      message: ExtensionMessage,
      responseCallback?: (response: TResponse) => void
    ): Promise<TResponse>;
    onMessage: {
      addListener(
        callback: (
          message: ExtensionMessage,
          sender: unknown,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      ): void;
    };
    openOptionsPage(): void;
  };
  i18n: {
    getMessage(messageName: string, substitutions?: string | string[]): string;
    getUILanguage(): string;
  };
  storage: {
    local: {
      get(
        keys: string | string[] | Record<string, unknown> | null,
        callback: (items: { settings?: Settings }) => void
      ): void;
      set(items: { settings: Settings }, callback?: () => void): void;
    };
    onChanged: {
      addListener(
        callback: (changes: { settings?: StorageChange<Settings> }, areaName: string) => void
      ): void;
    };
  };
  webRequest: {
    onBeforeSendHeaders: {
      addListener(
        callback: (
          details: BeforeSendHeadersDetails
        ) => Promise<{ requestHeaders?: RequestHeader[] }> | { requestHeaders?: RequestHeader[] },
        filter: { urls: string[] },
        extraInfoSpec: string[]
      ): void;
    };
  };
  tabs: {
    query(queryInfo: Record<string, unknown>, callback: (tabs: TabInfo[]) => void): void;
    sendMessage(
      tabId: number,
      message: ExtensionMessage,
      responseCallback?: (response: unknown) => void
    ): void;
  };
}

declare const browser: BrowserApi | undefined;
declare const chrome: BrowserApi;
