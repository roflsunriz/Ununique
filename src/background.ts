import {
  createFingerprintProfile,
  normalizeRequestHeaders,
  normalizeSettings,
  profileToBrowserValues,
  type PrivacySettings
} from "./shared/fingerprint";

(() => {
  const browserAPI: BrowserApi = typeof browser !== "undefined" && browser ? browser : chrome;
  const originalValues = collectOriginalValues();
  const profile = createFingerprintProfile({
    userAgent: originalValues.userAgent,
    language: originalValues.language,
    screenWidth: originalValues.screenWidth,
    screenHeight: originalValues.screenHeight,
    hardwareConcurrency:
      typeof originalValues.hardwareConcurrency === "number"
        ? originalValues.hardwareConcurrency
        : undefined,
    deviceMemory: getDeviceMemory()
  });

  function getSettings(): Promise<PrivacySettings> {
    return new Promise((resolve) => {
      browserAPI.storage.local.get("settings", (result) => {
        resolve(normalizeSettings(result?.settings));
      });
    });
  }

  browserAPI.webRequest.onBeforeSendHeaders.addListener(
    async (details) => {
      const settings = await getSettings();
      if (!settings.enableHeaderSpoofing) {
        return { requestHeaders: details.requestHeaders };
      }

      return {
        requestHeaders: normalizeRequestHeaders(details.requestHeaders, profile)
      };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
  );

  browserAPI.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.settings?.newValue) {
      return;
    }

    notifyAllTabs(normalizeSettings(changes.settings.newValue));
  });

  browserAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "getSettings") {
      getSettings().then((settings) => {
        sendResponse({ settings });
      });
      return true;
    }

    if (message.type === "saveSettings") {
      const settings = normalizeSettings(message.settings);
      browserAPI.storage.local.set({ settings }, () => {
        if (browserAPI.runtime.lastError) {
          sendResponse({ success: false });
          return;
        }
        sendResponse({ success: true, settings });
      });
      notifyAllTabs(settings);
      return true;
    }

    if (message.type === "getOriginalValues") {
      sendResponse({ originalValues });
      return false;
    }

    if (message.type === "getSpoofingValues") {
      sendResponse({
        originalValues,
        spoofedValues: profileToBrowserValues(profile)
      });
      return false;
    }

    return false;
  });

  function notifyAllTabs(settings: PrivacySettings): void {
    browserAPI.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id === undefined) {
          continue;
        }

        try {
          browserAPI.tabs.sendMessage(tab.id, { type: "settingsChanged", settings }, () => {
            void browserAPI.runtime.lastError;
          });
        } catch (error) {
          console.warn("[Ununique] Could not notify a tab about the settings change", error);
        }
      }
    });
  }

  function collectOriginalValues(): BrowserValues {
    const values: BrowserValues = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: typeof screen !== "undefined" ? screen.width : undefined,
      screenHeight: typeof screen !== "undefined" ? screen.height : undefined,
      hardwareConcurrency: navigator.hardwareConcurrency || undefined,
      doNotTrack: navigator.doNotTrack || undefined,
      deviceMemory: getDeviceMemory()
    };

    const webglValues = readWebglValues();
    values.webglVendor = webglValues.vendor;
    values.webglRenderer = webglValues.renderer;
    return values;
  }

  function readWebglValues(): { vendor?: string; renderer?: string } {
    if (typeof document === "undefined") {
      return {};
    }

    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl");
      if (!context) {
        return {};
      }
      return {
        vendor: String(context.getParameter(context.VENDOR)),
        renderer: String(context.getParameter(context.RENDERER))
      };
    } catch (error) {
      console.warn("[Ununique] Could not read the original WebGL values", error);
      return {};
    }
  }

  function getDeviceMemory(): number | undefined {
    const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
    return navigatorWithMemory.deviceMemory;
  }
})();
