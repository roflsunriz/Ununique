import { installMainWorldProtection } from "./content-main-world";
import {
  createFingerprintProfile,
  DEFAULT_PRIVACY_SETTINGS,
  getProtectionConfig,
  normalizeSettings,
  type FingerprintProfile,
  type PrivacySettings
} from "./shared/fingerprint";

(() => {
  const browserAPI: BrowserApi = typeof browser !== "undefined" && browser ? browser : chrome;
  const profile = createFingerprintProfile({
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  });

  function getSettings(): Promise<PrivacySettings> {
    return browserAPI.runtime
      .sendMessage<SettingsResponse>({ type: "getSettings" })
      .then((response) => normalizeSettings(response?.settings))
      .catch(() => ({ ...DEFAULT_PRIVACY_SETTINGS }));
  }

  function createMainWorldScript(
    fingerprintProfile: FingerprintProfile,
    settings: PrivacySettings
  ): string {
    const protectionConfig = getProtectionConfig(settings.protectionMode);
    return `(${installMainWorldProtection.toString()})(${JSON.stringify(fingerprintProfile)},${JSON.stringify(protectionConfig)},${settings.enableJsSpoofing});`;
  }

  function applySettings(settings: PrivacySettings): void {
    const scriptElement = document.createElement("script");
    scriptElement.textContent = createMainWorldScript(profile, settings);

    const parent = document.head ?? document.documentElement;
    if (!parent) {
      return;
    }

    parent.insertBefore(scriptElement, parent.firstChild);
    scriptElement.remove();
  }

  function setupSettingsListener(): void {
    browserAPI.runtime.onMessage.addListener((message) => {
      if (message.type === "settingsChanged" && message.settings) {
        applySettings(normalizeSettings(message.settings));
      }
      return false;
    });
  }

  async function initialize(): Promise<void> {
    setupSettingsListener();
    const settings = await getSettings();
    applySettings(settings);
  }

  void initialize();
})();
