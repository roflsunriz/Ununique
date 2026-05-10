(() => {
  type ComparableValue =
    | string
    | number
    | boolean
    | undefined
    | null
    | FontAvailability[]
    | DeviceSummary[];

  const SPOOFING_TARGETS: Required<BrowserValues> = {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    platform: "Win32",
    language: "en-US",
    screenWidth: 1920,
    screenHeight: 1080,
    hardwareConcurrency: 4,
    doNotTrack: "1",
    webglVendor: "Nvidia Inc.",
    webglRenderer: "Nvidia(R) GeForce GTX 1060",
    fonts: [
      { name: "Arial", available: true },
      { name: "Times New Roman", available: true },
      { name: "Courier New", available: true },
      { name: "Verdana", available: true },
      { name: "Georgia", available: true },
      { name: "Tahoma", available: true },
      { name: "Trebuchet MS", available: true },
      { name: "Impact", available: true },
      { name: "Comic Sans MS", available: true },
      { name: "Arial Black", available: true }
    ],
    devices: [
      { kind: "audioinput", label: "内蔵マイク" },
      { kind: "videoinput", label: "内蔵Webカメラ" },
      { kind: "audiooutput", label: "内蔵スピーカー" }
    ],
    batteryCharging: true,
    batteryLevel: 1.0,
    connectionType: "4g",
    downlink: 10,
    menubarVisible: false,
    toolbarVisible: false,
    mp4Support: "probably",
    webmSupport: "probably"
  };

  function getBrowserApi(): BrowserApi {
    return typeof browser !== "undefined" && browser ? browser : chrome;
  }

  function getMessage(browserAPI: BrowserApi, key: string, fallback: string): string {
    return browserAPI.i18n.getMessage(key) || fallback;
  }

  function applyI18n(browserAPI: BrowserApi): void {
    document.documentElement.lang = browserAPI.i18n.getUILanguage();
    document.title = browserAPI.i18n.getMessage("optionsTitle") || document.title;
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (!key) {
        return;
      }

      const message = browserAPI.i18n.getMessage(key);
      if (message) {
        element.textContent = message;
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
    const judgementTargetLabel = getMessage(browserAPI, "judgementTarget", "Target value");
    const judgementStatusLabel = getMessage(browserAPI, "judgementStatus", "Status");

    // 要素の取得
    const headerSpoofingCheckbox = getRequiredElement("headerSpoofing", HTMLInputElement);
    const jsSpoofingCheckbox = getRequiredElement("jsSpoofing", HTMLInputElement);
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
    const response = await browserAPI.runtime.sendMessage<SettingsResponse>({
      type: "getSettings"
    });
    const settings: Settings = response.settings ?? {
      enableHeaderSpoofing: true,
      enableJsSpoofing: true
    };

    // チェックボックスの状態を設定
    headerSpoofingCheckbox.checked = settings.enableHeaderSpoofing;
    jsSpoofingCheckbox.checked = settings.enableJsSpoofing;

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
          "スプーフィング結果を隠す"
        );
      } else {
        spoofResultsDiv.style.display = "none";
        checkResultsButton.textContent = getMessage(
          browserAPI,
          "showSpoofingResults",
          "スプーフィング結果を確認"
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
        enableHeaderSpoofing: headerSpoofingCheckbox.checked,
        enableJsSpoofing: jsSpoofingCheckbox.checked
      };

      await browserAPI.runtime.sendMessage({
        type: "saveSettings",
        settings: newSettings
      });

      // 保存成功のメッセージを表示
      const originalText = saveButton.textContent;
      saveButton.textContent = getMessage(browserAPI, "settingsSaved", "保存しました！");
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
        console.error("スプーフィング値の取得に失敗しました:", e);
        displayErrorMessage();
      }
    }

    // 表示内容をリセットする関数
    function resetDisplayValues(): void {
      // 基本情報
      document.getElementById("originalUserAgent").textContent = "取得中...";
      document.getElementById("spoofedUserAgent").textContent = "取得中...";
      document.getElementById("originalPlatform").textContent = "取得中...";
      document.getElementById("spoofedPlatform").textContent = "取得中...";
      document.getElementById("originalLanguage").textContent = "取得中...";
      document.getElementById("spoofedLanguage").textContent = "取得中...";
      document.getElementById("originalScreenWidth").textContent = "取得中...";
      document.getElementById("spoofedScreenWidth").textContent = "取得中...";
      document.getElementById("originalScreenHeight").textContent = "取得中...";
      document.getElementById("spoofedScreenHeight").textContent = "取得中...";
      document.getElementById("originalHardwareConcurrency").textContent = "取得中...";
      document.getElementById("spoofedHardwareConcurrency").textContent = "取得中...";
      document.getElementById("originalDoNotTrack").textContent = "取得中...";
      document.getElementById("spoofedDoNotTrack").textContent = "取得中...";

      // WebGL情報
      document.getElementById("originalWebGLVendor").textContent = "取得中...";
      document.getElementById("spoofedWebGLVendor").textContent = "取得中...";
      document.getElementById("originalWebGLRenderer").textContent = "取得中...";
      document.getElementById("spoofedWebGLRenderer").textContent = "取得中...";

      // フォントリスト
      document.getElementById("originalFonts").textContent = "取得中...";
      document.getElementById("spoofedFonts").textContent = "取得中...";

      // メディアデバイス
      document.getElementById("originalDevices").textContent = "取得中...";
      document.getElementById("spoofedDevices").textContent = "取得中...";

      // バッテリー情報
      document.getElementById("originalBatteryCharging").textContent = "取得中...";
      document.getElementById("spoofedBatteryCharging").textContent = "取得中...";
      document.getElementById("originalBatteryLevel").textContent = "取得中...";
      document.getElementById("spoofedBatteryLevel").textContent = "取得中...";

      // 接続情報
      document.getElementById("originalConnectionType").textContent = "取得中...";
      document.getElementById("spoofedConnectionType").textContent = "取得中...";
      document.getElementById("originalDownlink").textContent = "取得中...";
      document.getElementById("spoofedDownlink").textContent = "取得中...";

      // ブラウザバー
      document.getElementById("originalMenubar").textContent = "取得中...";
      document.getElementById("spoofedMenubar").textContent = "取得中...";
      document.getElementById("originalToolbar").textContent = "取得中...";
      document.getElementById("spoofedToolbar").textContent = "取得中...";

      // メディアフォーマット
      document.getElementById("originalMP4Support").textContent = "取得中...";
      document.getElementById("spoofedMP4Support").textContent = "取得中...";
      document.getElementById("originalWebMSupport").textContent = "取得中...";
      document.getElementById("spoofedWebMSupport").textContent = "取得中...";
      resetSpoofingJudgements();
    }

    function resetSpoofingJudgements(): void {
      spoofingJudgements = [];
      spoofingJudgementSummary.className = "judgement-summary";
      spoofingJudgementSummary.textContent = getMessage(
        browserAPI,
        "statusLoading",
        "Checking..."
      );

      document.querySelectorAll<HTMLElement>("[data-spoof-target]").forEach((element) => {
        element.textContent = "取得中...";
      });
      document.querySelectorAll<HTMLElement>("[data-spoof-status]").forEach((element) => {
        element.textContent = "取得中...";
        element.className = "";
      });
      document.querySelectorAll<HTMLElement>("[data-collection-judgement]").forEach((element) => {
        element.remove();
      });
      document.getElementById("spoofedCanvasNoise").textContent = "取得中...";
      document.getElementById("targetCanvasNoise").textContent = "取得中...";
      document.getElementById("statusCanvasNoise").textContent = "取得中...";
    }

    // 元の値を表示する関数
    function displayOriginalValues(): void {
      // 基本情報
      document.getElementById("originalUserAgent").textContent =
        originalValues.userAgent || "データなし";
      document.getElementById("originalPlatform").textContent =
        originalValues.platform || "データなし";
      document.getElementById("originalLanguage").textContent =
        originalValues.language || "データなし";
      document.getElementById("originalScreenWidth").textContent =
        originalValues.screenWidth?.toString() || "データなし";
      document.getElementById("originalScreenHeight").textContent =
        originalValues.screenHeight?.toString() || "データなし";
      document.getElementById("originalHardwareConcurrency").textContent =
        originalValues.hardwareConcurrency?.toString() || "データなし";
      document.getElementById("originalDoNotTrack").textContent =
        originalValues.doNotTrack?.toString() || "データなし";

      // WebGL情報
      document.getElementById("originalWebGLVendor").textContent =
        originalValues.webglVendor || "データなし";
      document.getElementById("originalWebGLRenderer").textContent =
        originalValues.webglRenderer || "データなし";

      // フォントリスト
      displayFonts("originalFonts", originalValues.fonts || []);

      // メディアデバイス
      displayDevices("originalDevices", originalValues.devices || []);

      // バッテリー情報
      document.getElementById("originalBatteryCharging").textContent =
        originalValues.batteryCharging !== undefined
          ? originalValues.batteryCharging
            ? "充電中"
            : "充電していない"
          : "データなし";
      document.getElementById("originalBatteryLevel").textContent =
        originalValues.batteryLevel !== undefined
          ? Math.round(originalValues.batteryLevel * 100) + "%"
          : "データなし";

      // 接続情報
      document.getElementById("originalConnectionType").textContent =
        originalValues.connectionType || "データなし";
      document.getElementById("originalDownlink").textContent = originalValues.downlink
        ? originalValues.downlink + "Mbps"
        : "データなし";

      // ブラウザバー
      document.getElementById("originalMenubar").textContent =
        originalValues.menubarVisible !== undefined
          ? originalValues.menubarVisible
            ? "表示"
            : "非表示"
          : "データなし";
      document.getElementById("originalToolbar").textContent =
        originalValues.toolbarVisible !== undefined
          ? originalValues.toolbarVisible
            ? "表示"
            : "非表示"
          : "データなし";

      // メディアフォーマット
      document.getElementById("originalMP4Support").textContent =
        originalValues.mp4Support || "対応していません";
      document.getElementById("originalWebMSupport").textContent =
        originalValues.webmSupport || "対応していません";
    }

    // スプーフィング後の値を表示する関数
    function displaySpoofedValues(): void {
      // 基本情報
      document.getElementById("spoofedUserAgent").textContent =
        spoofedValues.userAgent || "データなし";
      document.getElementById("spoofedPlatform").textContent =
        spoofedValues.platform || "データなし";
      document.getElementById("spoofedLanguage").textContent =
        spoofedValues.language || "データなし";
      document.getElementById("spoofedScreenWidth").textContent =
        spoofedValues.screenWidth?.toString() || "データなし";
      document.getElementById("spoofedScreenHeight").textContent =
        spoofedValues.screenHeight?.toString() || "データなし";
      document.getElementById("spoofedHardwareConcurrency").textContent =
        spoofedValues.hardwareConcurrency?.toString() || "データなし";
      document.getElementById("spoofedDoNotTrack").textContent =
        spoofedValues.doNotTrack?.toString() || "データなし";

      // WebGL情報
      document.getElementById("spoofedWebGLVendor").textContent =
        spoofedValues.webglVendor || "データなし";
      document.getElementById("spoofedWebGLRenderer").textContent =
        spoofedValues.webglRenderer || "データなし";

      // フォントリスト
      displayFonts("spoofedFonts", spoofedValues.fonts || []);

      // メディアデバイス
      displayDevices("spoofedDevices", spoofedValues.devices || []);

      // バッテリー情報
      document.getElementById("spoofedBatteryCharging").textContent =
        spoofedValues.batteryCharging !== undefined
          ? spoofedValues.batteryCharging
            ? "充電中"
            : "充電していない"
          : "データなし";
      document.getElementById("spoofedBatteryLevel").textContent =
        spoofedValues.batteryLevel !== undefined
          ? Math.round(spoofedValues.batteryLevel * 100) + "%"
          : "データなし";

      // 接続情報
      document.getElementById("spoofedConnectionType").textContent =
        spoofedValues.connectionType || "データなし";
      document.getElementById("spoofedDownlink").textContent = spoofedValues.downlink
        ? spoofedValues.downlink + "Mbps"
        : "データなし";

      // ブラウザバー
      document.getElementById("spoofedMenubar").textContent =
        spoofedValues.menubarVisible !== undefined
          ? spoofedValues.menubarVisible
            ? "表示"
            : "非表示"
          : "データなし";
      document.getElementById("spoofedToolbar").textContent =
        spoofedValues.toolbarVisible !== undefined
          ? spoofedValues.toolbarVisible
            ? "表示"
            : "非表示"
          : "データなし";

      // メディアフォーマット
      document.getElementById("spoofedMP4Support").textContent =
        spoofedValues.mp4Support || "対応していません";
      document.getElementById("spoofedWebMSupport").textContent =
        spoofedValues.webmSupport || "対応していません";
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
        formatBooleanState("充電中", "充電していない")
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
        formatBooleanState("表示", "非表示")
      );
      setComparison(
        "spoofedToolbar",
        spoofedValues.toolbarVisible,
        SPOOFING_TARGETS.toolbarVisible,
        formatBooleanState("表示", "非表示")
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
      const summaryTemplate = getMessage(
        browserAPI,
        "judgementSummary",
        "$1 / $2 items match the target value"
      );
      spoofingJudgementSummary.textContent = `${allPassed ? "✓" : "×"} ${summaryTemplate
        .replace("$1", passedCount.toString())
        .replace("$2", spoofingJudgements.length.toString())}`;
    }

    function valuesEqual(actual: ComparableValue, expected: ComparableValue): boolean {
      return JSON.stringify(actual) === JSON.stringify(expected);
    }

    function displayValue(value: ComparableValue): string {
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      if (value === undefined) {
        return "データなし";
      }
      if (value === null) {
        return "null";
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
      const errorMsg = "データの取得に失敗しました。再試行してください。";

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
        fontDiv.textContent = "フォントデータがありません";
        return;
      }

      fonts.forEach((font) => {
        const fontItem = document.createElement("div");
        fontItem.className = "font-item";
        fontItem.textContent = `${font.name}: ${font.available ? "利用可能" : "利用不可"}`;
        fontItem.style.color = font.available ? "#4CAF50" : "#999";
        fontDiv.appendChild(fontItem);
      });
    }

    // メディアデバイスを表示する関数
    function displayDevices(elementId: string, devices: DeviceSummary[]): void {
      const devicesDiv = getRequiredElement(elementId, HTMLDivElement);
      devicesDiv.replaceChildren();

      if (!devices || devices.length === 0) {
        devicesDiv.textContent = "デバイスがありません";
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
        deviceItem.textContent = `${device.kind}: ${device.label || "名前なし"}`;
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
        drawCanvasContent(spoofedCtx, text, true);
        displayCanvasJudgement(spoofedCtx);
      } catch (e) {
        console.error("キャンバス描画エラー:", e);
      }
    }

    function displayCanvasJudgement(ctx: CanvasRenderingContext2D): void {
      const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const redChannel = imageData.data[0];
      const passed = redChannel !== 248;

      document.getElementById("spoofedCanvasNoise").textContent =
        `先頭ピクセル赤チャンネル: ${redChannel}`;
      document.getElementById("targetCanvasNoise").textContent =
        "画像データの赤チャンネルにノイズが追加される";
      document.getElementById("statusCanvasNoise").replaceChildren(createStatusElement(passed));
      spoofingJudgements.push(passed);
    }

    // キャンバスにコンテンツを描画する関数
    function drawCanvasContent(
      ctx: CanvasRenderingContext2D,
      text: string,
      isSpoof: boolean
    ): void {
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

        for (let i = 0; i < data.length; i += 100) {
          data[i] = data[i] === 255 ? 254 : data[i] + 1;
        }

        ctx.putImageData(imageData, 0, 0);
      }
    }
  });
})();
