import {
  applyCanvasNoise,
  createFingerprintProfile,
  DEFAULT_PRIVACY_SETTINGS,
  normalizeSettings,
  profileToBrowserValues,
  type PrivacySettings
} from "../shared/fingerprint";

(() => {
  type ComparableValue =
    string | number | boolean | undefined | null | FontAvailability[] | DeviceSummary[];

  const SPOOFING_TARGETS: BrowserValues = profileToBrowserValues(
    createFingerprintProfile({
      userAgent: navigator.userAgent,
      screenWidth: typeof screen !== "undefined" ? screen.width : undefined,
      screenHeight: typeof screen !== "undefined" ? screen.height : undefined,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    })
  );

  function getBrowserApi(): BrowserApi {
    return typeof browser !== "undefined" && browser ? browser : chrome;
  }

  function getMessage(browserAPI: BrowserApi, key: string, fallback: string): string {
    return browserAPI.i18n.getMessage(key) || fallback;
  }

  function applyI18n(browserAPI: BrowserApi): void {
    const language = browserAPI.i18n.getUILanguage();
    document.documentElement.lang = language;
    document.documentElement.dir = ["ar", "fa", "he", "ur"].some((rtlLanguage) =>
      language.toLowerCase().startsWith(rtlLanguage)
    )
      ? "rtl"
      : "ltr";
    document.title = browserAPI.i18n.getMessage("optionsTitle") || document.title;
    const manifestVersion = browserAPI.runtime.getManifest().version;
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (!key) {
        return;
      }

      const message =
        key === "footerVersion"
          ? browserAPI.i18n.getMessage(key, [manifestVersion])
          : browserAPI.i18n.getMessage(key);
      if (message) {
        element.textContent = message;
      }
    });
    document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
      const key = element.dataset.i18nAriaLabel;
      const message = key ? browserAPI.i18n.getMessage(key) : "";
      if (message) {
        element.setAttribute("aria-label", message);
      }
    });
  }

  function getRequiredElement<T extends HTMLElement>(id: string, constructor: { new (): T }): T {
    const element = document.getElementById(id);
    if (!(element instanceof constructor)) {
      throw new Error(`Element #${id} was not found or has an unexpected type.`);
    }
    return element;
  }

  // オプションページが読み込まれたときに実行
  document.addEventListener("DOMContentLoaded", async () => {
    // Chrome と Firefox の両方に対応するためのブラウザAPI
    const browserAPI = getBrowserApi();
    applyI18n(browserAPI);
    const loadingText = getMessage(browserAPI, "statusFetching", "Loading...");
    const noDataText = getMessage(browserAPI, "noData", "No data");
    const errorText = getMessage(
      browserAPI,
      "dataFetchError",
      "Failed to get data. Please try again."
    );
    const chargingText = getMessage(browserAPI, "batteryCharging", "Charging");
    const notChargingText = getMessage(browserAPI, "batteryNotCharging", "Not charging");
    const visibleText = getMessage(browserAPI, "visible", "Visible");
    const hiddenText = getMessage(browserAPI, "hidden", "Hidden");
    const unsupportedText = getMessage(browserAPI, "unsupported", "Not supported");
    const availableText = getMessage(browserAPI, "available", "Available");
    const unavailableText = getMessage(browserAPI, "unavailable", "Unavailable");
    const noFontsText = getMessage(browserAPI, "noFontsData", "No font data");
    const noDevicesText = getMessage(browserAPI, "noDevicesData", "No devices");
    const unknownNameText = getMessage(browserAPI, "unknownName", "Unnamed");
    const nullValueText = getMessage(browserAPI, "nullValue", "null");
    const judgementTargetLabel = getMessage(browserAPI, "judgementTarget", "Target value");
    const judgementStatusLabel = getMessage(browserAPI, "judgementStatus", "Status");

    // 要素の取得
    const headerSpoofingCheckbox = getRequiredElement("headerSpoofing", HTMLInputElement);
    const jsSpoofingCheckbox = getRequiredElement("jsSpoofing", HTMLInputElement);
    const protectionModeSelect = getRequiredElement("protectionMode", HTMLSelectElement);
    const saveButton = getRequiredElement("save", HTMLButtonElement);
    const checkResultsButton = getRequiredElement("checkResults", HTMLButtonElement);
    const spoofResultsDiv = getRequiredElement("spoofResults", HTMLDivElement);
    const spoofingJudgementSummary = getRequiredElement(
      "spoofingJudgementSummary",
      HTMLParagraphElement
    );

    // タブ切り替え機能の初期化
    initSettingsTabs();
    initTabs();

    // 保存された設定を取得して表示
    let settings: PrivacySettings = { ...DEFAULT_PRIVACY_SETTINGS };
    try {
      const response = await browserAPI.runtime.sendMessage<SettingsResponse>({
        type: "getSettings"
      });
      settings = normalizeSettings(response?.settings);
    } catch (error) {
      console.warn("[Ununique] Could not load options settings", error);
    }

    // チェックボックスの状態を設定
    headerSpoofingCheckbox.checked = settings.enableHeaderSpoofing;
    jsSpoofingCheckbox.checked = settings.enableJsSpoofing;
    protectionModeSelect.value = settings.protectionMode;

    // 保存ボタンのクリックイベント
    saveButton.addEventListener("click", saveSettings);

    // スプーフィング結果確認ボタンのクリックイベント
    checkResultsButton.addEventListener("click", () => {
      if (spoofResultsDiv.style.display === "none") {
        spoofResultsDiv.style.display = "block";
        checkSpoofingResults();
        checkResultsButton.textContent = getMessage(
          browserAPI,
          "hideSpoofingResults",
          "Hide spoofing results"
        );
      } else {
        spoofResultsDiv.style.display = "none";
        checkResultsButton.textContent = getMessage(
          browserAPI,
          "showSpoofingResults",
          "Check spoofing results"
        );
      }
    });

    function initSettingsTabs(): void {
      const tabs = document.querySelectorAll<HTMLElement>(".settings-tab");
      const tabContents = document.querySelectorAll<HTMLElement>(".settings-tab-content");

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          tabs.forEach((t) => t.classList.remove("active"));
          tabContents.forEach((content) => content.classList.remove("active"));

          tab.classList.add("active");
          const tabId = tab.getAttribute("data-settings-tab");
          document.getElementById(`settings-${tabId}-tab`)?.classList.add("active");
        });
      });
    }

    // タブ切り替え機能を初期化する関数
    function initTabs(): void {
      const tabs = document.querySelectorAll<HTMLElement>(".tab");
      const tabContents = document.querySelectorAll<HTMLElement>(".tab-content");

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          // すべてのタブを非アクティブにする
          tabs.forEach((t) => t.classList.remove("active"));
          tabContents.forEach((content) => content.classList.remove("active"));

          // クリックされたタブとそれに対応するコンテンツをアクティブにする
          tab.classList.add("active");
          const tabId = tab.getAttribute("data-tab");
          document.getElementById(`${tabId}-tab`)?.classList.add("active");
        });
      });
    }

    // 設定を保存する関数
    async function saveSettings(): Promise<void> {
      const newSettings = {
        ...settings,
        enableHeaderSpoofing: headerSpoofingCheckbox.checked,
        enableJsSpoofing: jsSpoofingCheckbox.checked,
        protectionMode: protectionModeSelect.value
      };

      settings = normalizeSettings(newSettings);
      await browserAPI.runtime.sendMessage({
        type: "saveSettings",
        settings
      });

      // 保存成功のメッセージを表示
      const originalText = saveButton.textContent;
      saveButton.textContent = getMessage(browserAPI, "settingsSaved", "Saved");
      saveButton.disabled = true;

      // 3秒後に元のテキストに戻す
      setTimeout(() => {
        saveButton.textContent = originalText;
        saveButton.disabled = false;
      }, 3000);
    }

    // オリジナルのブラウザ情報を保存するオブジェクト
    let originalValues: BrowserValues = {};
    // スプーフィング後の値を保存するオブジェクト
    let spoofedValues: BrowserValues = {};
    let spoofingJudgements: boolean[] = [];

    // スプーフィング結果を確認する関数
    async function checkSpoofingResults(): Promise<void> {
      // 表示内容をリセット
      resetDisplayValues();

      try {
        // オリジナルの値とスプーフィング後の値を同時に取得
        const response = await browserAPI.runtime.sendMessage<SpoofingValuesResponse>({
          type: "getSpoofingValues"
        });
        originalValues = response.originalValues || {};
        spoofedValues = response.spoofedValues || {};

        // 元の値を表示
        displayOriginalValues();

        // スプーフィング後の値を表示
        displaySpoofedValues();

        // キャンバスフィンガープリントの作成と表示
        renderCanvasFingerprint();

        displaySpoofingJudgements();
      } catch (e) {
        console.error(errorText, e);
        displayErrorMessage();
      }
    }

    // 表示内容をリセットする関数
    function resetDisplayValues(): void {
      // 基本情報
      document.getElementById("originalUserAgent").textContent = loadingText;
      document.getElementById("spoofedUserAgent").textContent = loadingText;
      document.getElementById("originalPlatform").textContent = loadingText;
      document.getElementById("spoofedPlatform").textContent = loadingText;
      document.getElementById("originalLanguage").textContent = loadingText;
      document.getElementById("spoofedLanguage").textContent = loadingText;
      document.getElementById("originalScreenWidth").textContent = loadingText;
      document.getElementById("spoofedScreenWidth").textContent = loadingText;
      document.getElementById("originalScreenHeight").textContent = loadingText;
      document.getElementById("spoofedScreenHeight").textContent = loadingText;
      document.getElementById("originalHardwareConcurrency").textContent = loadingText;
      document.getElementById("spoofedHardwareConcurrency").textContent = loadingText;
      document.getElementById("originalDoNotTrack").textContent = loadingText;
      document.getElementById("spoofedDoNotTrack").textContent = loadingText;

      // WebGL情報
      document.getElementById("originalWebGLVendor").textContent = loadingText;
      document.getElementById("spoofedWebGLVendor").textContent = loadingText;
      document.getElementById("originalWebGLRenderer").textContent = loadingText;
      document.getElementById("spoofedWebGLRenderer").textContent = loadingText;

      // フォントリスト
      document.getElementById("originalFonts").textContent = loadingText;
      document.getElementById("spoofedFonts").textContent = loadingText;

      // メディアデバイス
      document.getElementById("originalDevices").textContent = loadingText;
      document.getElementById("spoofedDevices").textContent = loadingText;

      // バッテリー情報
      document.getElementById("originalBatteryCharging").textContent = loadingText;
      document.getElementById("spoofedBatteryCharging").textContent = loadingText;
      document.getElementById("originalBatteryLevel").textContent = loadingText;
      document.getElementById("spoofedBatteryLevel").textContent = loadingText;

      // 接続情報
      document.getElementById("originalConnectionType").textContent = loadingText;
      document.getElementById("spoofedConnectionType").textContent = loadingText;
      document.getElementById("originalDownlink").textContent = loadingText;
      document.getElementById("spoofedDownlink").textContent = loadingText;

      // ブラウザバー
      document.getElementById("originalMenubar").textContent = loadingText;
      document.getElementById("spoofedMenubar").textContent = loadingText;
      document.getElementById("originalToolbar").textContent = loadingText;
      document.getElementById("spoofedToolbar").textContent = loadingText;

      // メディアフォーマット
      document.getElementById("originalMP4Support").textContent = loadingText;
      document.getElementById("spoofedMP4Support").textContent = loadingText;
      document.getElementById("originalWebMSupport").textContent = loadingText;
      document.getElementById("spoofedWebMSupport").textContent = loadingText;
      resetSpoofingJudgements();
    }

    function resetSpoofingJudgements(): void {
      spoofingJudgements = [];
      spoofingJudgementSummary.className = "judgement-summary";
      spoofingJudgementSummary.textContent = loadingText;

      document.querySelectorAll<HTMLElement>("[data-spoof-target]").forEach((element) => {
        element.textContent = loadingText;
      });
      document.querySelectorAll<HTMLElement>("[data-spoof-status]").forEach((element) => {
        element.textContent = loadingText;
        element.className = "";
      });
      document.querySelectorAll<HTMLElement>("[data-collection-judgement]").forEach((element) => {
        element.remove();
      });
      document.getElementById("spoofedCanvasNoise").textContent = loadingText;
      document.getElementById("targetCanvasNoise").textContent = loadingText;
      document.getElementById("statusCanvasNoise").textContent = loadingText;
    }

    // 元の値を表示する関数
    function displayOriginalValues(): void {
      // 基本情報
      document.getElementById("originalUserAgent").textContent =
        originalValues.userAgent || noDataText;
      document.getElementById("originalPlatform").textContent =
        originalValues.platform || noDataText;
      document.getElementById("originalLanguage").textContent =
        originalValues.language || noDataText;
      document.getElementById("originalScreenWidth").textContent =
        originalValues.screenWidth?.toString() || noDataText;
      document.getElementById("originalScreenHeight").textContent =
        originalValues.screenHeight?.toString() || noDataText;
      document.getElementById("originalHardwareConcurrency").textContent =
        originalValues.hardwareConcurrency?.toString() || noDataText;
      document.getElementById("originalDoNotTrack").textContent =
        originalValues.doNotTrack?.toString() || noDataText;

      // WebGL情報
      document.getElementById("originalWebGLVendor").textContent =
        originalValues.webglVendor || noDataText;
      document.getElementById("originalWebGLRenderer").textContent =
        originalValues.webglRenderer || noDataText;

      // フォントリスト
      displayFonts("originalFonts", originalValues.fonts || []);

      // メディアデバイス
      displayDevices("originalDevices", originalValues.devices || []);

      // バッテリー情報
      document.getElementById("originalBatteryCharging").textContent =
        originalValues.batteryCharging !== undefined
          ? originalValues.batteryCharging
            ? chargingText
            : notChargingText
          : noDataText;
      document.getElementById("originalBatteryLevel").textContent =
        originalValues.batteryLevel !== undefined
          ? Math.round(originalValues.batteryLevel * 100) + "%"
          : noDataText;

      // 接続情報
      document.getElementById("originalConnectionType").textContent =
        originalValues.connectionType || noDataText;
      document.getElementById("originalDownlink").textContent = originalValues.downlink
        ? originalValues.downlink + "Mbps"
        : noDataText;

      // ブラウザバー
      document.getElementById("originalMenubar").textContent =
        originalValues.menubarVisible !== undefined
          ? originalValues.menubarVisible
            ? visibleText
            : hiddenText
          : noDataText;
      document.getElementById("originalToolbar").textContent =
        originalValues.toolbarVisible !== undefined
          ? originalValues.toolbarVisible
            ? visibleText
            : hiddenText
          : noDataText;

      // メディアフォーマット
      document.getElementById("originalMP4Support").textContent =
        originalValues.mp4Support || unsupportedText;
      document.getElementById("originalWebMSupport").textContent =
        originalValues.webmSupport || unsupportedText;
    }

    // スプーフィング後の値を表示する関数
    function displaySpoofedValues(): void {
      // 基本情報
      document.getElementById("spoofedUserAgent").textContent =
        spoofedValues.userAgent || noDataText;
      document.getElementById("spoofedPlatform").textContent = spoofedValues.platform || noDataText;
      document.getElementById("spoofedLanguage").textContent = spoofedValues.language || noDataText;
      document.getElementById("spoofedScreenWidth").textContent =
        spoofedValues.screenWidth?.toString() || noDataText;
      document.getElementById("spoofedScreenHeight").textContent =
        spoofedValues.screenHeight?.toString() || noDataText;
      document.getElementById("spoofedHardwareConcurrency").textContent =
        spoofedValues.hardwareConcurrency?.toString() || noDataText;
      document.getElementById("spoofedDoNotTrack").textContent =
        spoofedValues.doNotTrack?.toString() || noDataText;

      // WebGL情報
      document.getElementById("spoofedWebGLVendor").textContent =
        spoofedValues.webglVendor || noDataText;
      document.getElementById("spoofedWebGLRenderer").textContent =
        spoofedValues.webglRenderer || noDataText;

      // フォントリスト
      displayFonts("spoofedFonts", spoofedValues.fonts || []);

      // メディアデバイス
      displayDevices("spoofedDevices", spoofedValues.devices || []);

      // バッテリー情報
      document.getElementById("spoofedBatteryCharging").textContent =
        spoofedValues.batteryCharging !== undefined
          ? spoofedValues.batteryCharging
            ? chargingText
            : notChargingText
          : noDataText;
      document.getElementById("spoofedBatteryLevel").textContent =
        spoofedValues.batteryLevel !== undefined
          ? Math.round(spoofedValues.batteryLevel * 100) + "%"
          : noDataText;

      // 接続情報
      document.getElementById("spoofedConnectionType").textContent =
        spoofedValues.connectionType || noDataText;
      document.getElementById("spoofedDownlink").textContent = spoofedValues.downlink
        ? spoofedValues.downlink + "Mbps"
        : noDataText;

      // ブラウザバー
      document.getElementById("spoofedMenubar").textContent =
        spoofedValues.menubarVisible !== undefined
          ? spoofedValues.menubarVisible
            ? visibleText
            : hiddenText
          : noDataText;
      document.getElementById("spoofedToolbar").textContent =
        spoofedValues.toolbarVisible !== undefined
          ? spoofedValues.toolbarVisible
            ? visibleText
            : hiddenText
          : noDataText;

      // メディアフォーマット
      document.getElementById("spoofedMP4Support").textContent =
        spoofedValues.mp4Support || unsupportedText;
      document.getElementById("spoofedWebMSupport").textContent =
        spoofedValues.webmSupport || unsupportedText;
    }

    function displaySpoofingJudgements(): void {
      ensureComparisonColumns();

      setComparison("spoofedUserAgent", spoofedValues.userAgent, SPOOFING_TARGETS.userAgent);
      setComparison("spoofedPlatform", spoofedValues.platform, SPOOFING_TARGETS.platform);
      setComparison("spoofedLanguage", spoofedValues.language, SPOOFING_TARGETS.language);
      setComparison("spoofedScreenWidth", spoofedValues.screenWidth, SPOOFING_TARGETS.screenWidth);
      setComparison(
        "spoofedScreenHeight",
        spoofedValues.screenHeight,
        SPOOFING_TARGETS.screenHeight
      );
      setComparison(
        "spoofedHardwareConcurrency",
        spoofedValues.hardwareConcurrency,
        SPOOFING_TARGETS.hardwareConcurrency
      );
      setComparison("spoofedDoNotTrack", spoofedValues.doNotTrack, SPOOFING_TARGETS.doNotTrack);
      setComparison("spoofedWebGLVendor", spoofedValues.webglVendor, SPOOFING_TARGETS.webglVendor);
      setComparison(
        "spoofedWebGLRenderer",
        spoofedValues.webglRenderer,
        SPOOFING_TARGETS.webglRenderer
      );
      setComparison(
        "spoofedBatteryCharging",
        spoofedValues.batteryCharging,
        SPOOFING_TARGETS.batteryCharging,
        formatBooleanState(chargingText, notChargingText)
      );
      setComparison(
        "spoofedBatteryLevel",
        spoofedValues.batteryLevel,
        SPOOFING_TARGETS.batteryLevel,
        (value) => (typeof value === "number" ? `${Math.round(value * 100)}%` : displayValue(value))
      );
      setComparison(
        "spoofedConnectionType",
        spoofedValues.connectionType,
        SPOOFING_TARGETS.connectionType
      );
      setComparison(
        "spoofedDownlink",
        spoofedValues.downlink,
        SPOOFING_TARGETS.downlink,
        (value) => (typeof value === "number" ? `${value}Mbps` : displayValue(value))
      );
      setComparison(
        "spoofedMenubar",
        spoofedValues.menubarVisible,
        SPOOFING_TARGETS.menubarVisible,
        formatBooleanState(visibleText, hiddenText)
      );
      setComparison(
        "spoofedToolbar",
        spoofedValues.toolbarVisible,
        SPOOFING_TARGETS.toolbarVisible,
        formatBooleanState(visibleText, hiddenText)
      );
      setComparison("spoofedMP4Support", spoofedValues.mp4Support, SPOOFING_TARGETS.mp4Support);
      setComparison("spoofedWebMSupport", spoofedValues.webmSupport, SPOOFING_TARGETS.webmSupport);
      setCollectionComparison("spoofedFonts", spoofedValues.fonts || [], SPOOFING_TARGETS.fonts);
      setCollectionComparison(
        "spoofedDevices",
        spoofedValues.devices || [],
        SPOOFING_TARGETS.devices
      );

      renderSpoofingJudgementSummary();
    }

    function ensureComparisonColumns(): void {
      spoofResultsDiv.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
        if (table.dataset.comparisonColumns === "true") {
          return;
        }

        const headerRow = table.querySelector("tr");
        if (!headerRow) {
          return;
        }

        if (headerRow.querySelectorAll("th").length >= 4) {
          table.dataset.comparisonColumns = "true";
          return;
        }

        const targetHeader = document.createElement("th");
        targetHeader.textContent = judgementTargetLabel;
        const statusHeader = document.createElement("th");
        statusHeader.textContent = judgementStatusLabel;
        headerRow.append(targetHeader, statusHeader);
        table.dataset.comparisonColumns = "true";
      });
    }

    function setComparison(
      spoofedElementId: string,
      actual: ComparableValue,
      expected: ComparableValue,
      formatter: (value: ComparableValue) => string = displayValue
    ): void {
      const spoofedElement = document.getElementById(spoofedElementId);
      const row = spoofedElement?.closest("tr");

      if (!row) {
        return;
      }

      const targetCell = getOrCreateComparisonCell(row, "target");
      const statusCell = getOrCreateComparisonCell(row, "status");
      const passed = valuesEqual(actual, expected);

      targetCell.textContent = formatter(expected);
      statusCell.replaceChildren(createStatusElement(passed));
      spoofingJudgements.push(passed);
    }

    function setCollectionComparison(
      elementId: string,
      actual: FontAvailability[] | DeviceSummary[],
      expected: FontAvailability[] | DeviceSummary[]
    ): void {
      const element = document.getElementById(elementId);
      if (!element) {
        return;
      }

      const passed = valuesEqual(actual, expected);
      const judgement = document.createElement("div");
      judgement.className = "collection-judgement";
      judgement.dataset.collectionJudgement = "true";
      judgement.append(
        `${judgementTargetLabel}: ${displayValue(expected)} `,
        createStatusElement(passed)
      );
      element.insertAdjacentElement("afterend", judgement);
      spoofingJudgements.push(passed);
    }

    function getOrCreateComparisonCell(
      row: Element,
      cellType: "target" | "status"
    ): HTMLTableCellElement {
      const dataAttribute = cellType === "target" ? "spoofTarget" : "spoofStatus";
      const existingCell = row.querySelector<HTMLTableCellElement>(
        `[data-${toKebabCase(dataAttribute)}]`
      );

      if (existingCell) {
        return existingCell;
      }

      const cell = document.createElement("td");
      cell.dataset[dataAttribute] = "true";
      row.appendChild(cell);
      return cell;
    }

    function renderSpoofingJudgementSummary(): void {
      const passedCount = spoofingJudgements.filter(Boolean).length;
      const allPassed = passedCount === spoofingJudgements.length;
      spoofingJudgementSummary.className = `judgement-summary ${allPassed ? "pass" : "fail"}`;
      const summaryText =
        browserAPI.i18n.getMessage("judgementSummary", [
          passedCount.toString(),
          spoofingJudgements.length.toString()
        ]) ||
        getMessage(browserAPI, "judgementSummary", "$1/$2 checks passed")
          .replace("$1", passedCount.toString())
          .replace("$2", spoofingJudgements.length.toString());
      spoofingJudgementSummary.textContent = `${allPassed ? "✓" : "×"} ${summaryText}`;
    }

    function valuesEqual(actual: ComparableValue, expected: ComparableValue): boolean {
      return JSON.stringify(actual) === JSON.stringify(expected);
    }

    function displayValue(value: ComparableValue): string {
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      if (value === undefined) {
        return noDataText;
      }
      if (value === null) {
        return nullValueText;
      }
      return String(value);
    }

    function createStatusElement(passed: boolean): HTMLSpanElement {
      const element = document.createElement("span");
      element.className = `spoof-status ${passed ? "pass" : "fail"}`;
      element.textContent = passed ? "✓" : "×";
      return element;
    }

    function formatBooleanState(
      trueLabel: string,
      falseLabel: string
    ): (value: ComparableValue) => string {
      return (value) =>
        value === true ? trueLabel : value === false ? falseLabel : displayValue(value);
    }

    function toKebabCase(value: string): string {
      return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    }

    // エラーメッセージを表示する関数
    function displayErrorMessage(): void {
      const errorMsg = errorText;

      // 基本情報
      document.getElementById("originalUserAgent").textContent = errorMsg;
      document.getElementById("spoofedUserAgent").textContent = errorMsg;
      // 他の要素も同様に
      document.getElementById("originalPlatform").textContent = errorMsg;
      document.getElementById("spoofedPlatform").textContent = errorMsg;
      document.getElementById("originalLanguage").textContent = errorMsg;
      document.getElementById("spoofedLanguage").textContent = errorMsg;
      document.getElementById("originalScreenWidth").textContent = errorMsg;
      document.getElementById("spoofedScreenWidth").textContent = errorMsg;
      document.getElementById("originalScreenHeight").textContent = errorMsg;
      document.getElementById("spoofedScreenHeight").textContent = errorMsg;
      document.getElementById("originalHardwareConcurrency").textContent = errorMsg;
      document.getElementById("spoofedHardwareConcurrency").textContent = errorMsg;
      document.getElementById("originalDoNotTrack").textContent = errorMsg;
      document.getElementById("spoofedDoNotTrack").textContent = errorMsg;

      // WebGL情報
      document.getElementById("originalWebGLVendor").textContent = errorMsg;
      document.getElementById("spoofedWebGLVendor").textContent = errorMsg;
      document.getElementById("originalWebGLRenderer").textContent = errorMsg;
      document.getElementById("spoofedWebGLRenderer").textContent = errorMsg;

      // フォントリスト
      document.getElementById("originalFonts").textContent = errorMsg;
      document.getElementById("spoofedFonts").textContent = errorMsg;

      // メディアデバイス
      document.getElementById("originalDevices").textContent = errorMsg;
      document.getElementById("spoofedDevices").textContent = errorMsg;

      // バッテリー情報
      document.getElementById("originalBatteryCharging").textContent = errorMsg;
      document.getElementById("spoofedBatteryCharging").textContent = errorMsg;
      document.getElementById("originalBatteryLevel").textContent = errorMsg;
      document.getElementById("spoofedBatteryLevel").textContent = errorMsg;

      // 接続情報
      document.getElementById("originalConnectionType").textContent = errorMsg;
      document.getElementById("spoofedConnectionType").textContent = errorMsg;
      document.getElementById("originalDownlink").textContent = errorMsg;
      document.getElementById("spoofedDownlink").textContent = errorMsg;

      // ブラウザバー
      document.getElementById("originalMenubar").textContent = errorMsg;
      document.getElementById("spoofedMenubar").textContent = errorMsg;
      document.getElementById("originalToolbar").textContent = errorMsg;
      document.getElementById("spoofedToolbar").textContent = errorMsg;

      // メディアフォーマット
      document.getElementById("originalMP4Support").textContent = errorMsg;
      document.getElementById("spoofedMP4Support").textContent = errorMsg;
      document.getElementById("originalWebMSupport").textContent = errorMsg;
      document.getElementById("spoofedWebMSupport").textContent = errorMsg;
    }

    // フォントリストを表示する関数
    function displayFonts(elementId: string, fonts: FontAvailability[]): void {
      const fontDiv = getRequiredElement(elementId, HTMLDivElement);
      fontDiv.replaceChildren();

      if (!fonts || fonts.length === 0) {
        fontDiv.textContent = noFontsText;
        return;
      }

      fonts.forEach((font) => {
        const fontItem = document.createElement("div");
        fontItem.className = "font-item";
        fontItem.textContent = `${font.name}: ${font.available ? availableText : unavailableText}`;
        fontItem.style.color = font.available ? "#4CAF50" : "#999";
        fontDiv.appendChild(fontItem);
      });
    }

    // メディアデバイスを表示する関数
    function displayDevices(elementId: string, devices: DeviceSummary[]): void {
      const devicesDiv = getRequiredElement(elementId, HTMLDivElement);
      devicesDiv.replaceChildren();

      if (!devices || devices.length === 0) {
        devicesDiv.textContent = noDevicesText;
        return;
      }

      // スタイリングを適用
      devicesDiv.style.maxHeight = "200px";
      devicesDiv.style.overflowY = "auto";
      devicesDiv.style.padding = "10px";
      devicesDiv.style.backgroundColor = "#f9f9f9";
      devicesDiv.style.border = "1px solid #ddd";
      devicesDiv.style.borderRadius = "4px";

      devices.forEach((device) => {
        const deviceItem = document.createElement("div");
        deviceItem.style.padding = "3px 0";
        deviceItem.style.fontSize = "13px";
        deviceItem.textContent = `${device.kind}: ${device.label || unknownNameText}`;
        devicesDiv.appendChild(deviceItem);
      });
    }

    // キャンバスフィンガープリントを描画する関数
    function renderCanvasFingerprint(): void {
      try {
        const text = "Ununique Canvas Test 123!";

        // オリジナルキャンバス
        const originalCanvas = getRequiredElement("originalCanvas", HTMLCanvasElement);
        const originalCtx = originalCanvas.getContext("2d");
        if (!originalCtx) {
          return;
        }
        drawCanvasContent(originalCtx, text, false);

        // スプーフィングされたキャンバス
        const spoofedCanvas = getRequiredElement("spoofedCanvas", HTMLCanvasElement);
        const spoofedCtx = spoofedCanvas.getContext("2d");
        if (!spoofedCtx) {
          return;
        }
        const noiseApplied = drawCanvasContent(spoofedCtx, text, true);
        displayCanvasJudgement(spoofedCtx, noiseApplied);
      } catch (e) {
        console.error("Canvas rendering error:", e);
      }
    }

    function displayCanvasJudgement(ctx: CanvasRenderingContext2D, noiseApplied: boolean): void {
      const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const redChannel = imageData.data[0];
      const passed = noiseApplied;

      document.getElementById("spoofedCanvasNoise").textContent = getMessage(
        browserAPI,
        "canvasNoiseValue",
        "First pixel red channel: $1"
      ).replace("$1", String(redChannel));
      document.getElementById("targetCanvasNoise").textContent = getMessage(
        browserAPI,
        "canvasNoiseDescription",
        "Per-document noise is applied to pixels."
      );
      document.getElementById("statusCanvasNoise").replaceChildren(createStatusElement(passed));
      spoofingJudgements.push(passed);
    }

    // キャンバスにコンテンツを描画する関数
    function drawCanvasContent(
      ctx: CanvasRenderingContext2D,
      text: string,
      isSpoof: boolean
    ): boolean {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      // 背景を描画
      ctx.fillStyle = "#f8f8f8";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      // テキストを描画
      ctx.font = "14px Arial";
      ctx.fillStyle = "#000";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 10, 15);

      // スプーフィングされている場合、ノイズを追加
      if (isSpoof) {
        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        const data = imageData.data;
        const originalData = new Uint8ClampedArray(data);
        applyCanvasNoise(data, imageData.width, imageData.height, 0x9e3779b9);

        ctx.putImageData(imageData, 0, 0);
        return data.some((value, index) => value !== originalData[index]);
      }

      return false;
    }
  });
})();
