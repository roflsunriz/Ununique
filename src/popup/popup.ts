(() => {
  function getBrowserApi(): BrowserApi {
    return typeof browser !== "undefined" && browser ? browser : chrome;
  }

  function applyI18n(browserAPI: BrowserApi): void {
    document.documentElement.lang = browserAPI.i18n.getUILanguage();
    document.title = browserAPI.i18n.getMessage("extensionName") || document.title;
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

  // ポップアップが読み込まれたときに実行
  document.addEventListener("DOMContentLoaded", async () => {
    // Chrome と Firefox の両方に対応するためのブラウザAPI
    const browserAPI = getBrowserApi();
    applyI18n(browserAPI);

    // 要素の取得
    const headerSpoofingCheckbox = getRequiredElement("headerSpoofing", HTMLInputElement);
    const jsSpoofingCheckbox = getRequiredElement("jsSpoofing", HTMLInputElement);
    const openOptionsLink = getRequiredElement("openOptions", HTMLAnchorElement);

    // 保存された設定を取得して表示
    const response = await browserAPI.runtime.sendMessage<SettingsResponse>({
      type: "getSettings"
    });
    const settings: Settings = response?.settings ?? {
      enableHeaderSpoofing: true,
      enableJsSpoofing: true
    };

    // チェックボックスの状態を設定
    headerSpoofingCheckbox.checked = settings.enableHeaderSpoofing;
    jsSpoofingCheckbox.checked = settings.enableJsSpoofing;

    // チェックボックスの変更を検知して設定を保存
    headerSpoofingCheckbox.addEventListener("change", saveSettings);
    jsSpoofingCheckbox.addEventListener("change", saveSettings);

    // 詳細設定リンクのクリックイベント
    openOptionsLink.addEventListener("click", (e) => {
      e.preventDefault();
      browserAPI.runtime.openOptionsPage();
    });

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

      // 設定が変更されたことをユーザーに通知
      // （ここではシンプルさを優先して通知は省略）
    }
  });
})();
