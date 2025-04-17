// マジョリティ値の定義
const MAJORITY_VALUES = {
  headers: {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    "dnt": "1",
    "upgrade-insecure-requests": "1",
    "referer": "https://www.google.com/",
    "if-none-match": ""
  },
  // マジョリティのスプーフィング値（content.jsと同じ値を保持）
  spoofed: {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
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
  }
};

// Chrome と Firefox の両方に対応するためのブラウザAPI
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// オリジナルのブラウザ値を保存
const ORIGINAL_VALUES = {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  language: navigator.language,
  screenWidth: screen.width,
  screenHeight: screen.height,
  hardwareConcurrency: navigator.hardwareConcurrency || 'N/A',
  doNotTrack: navigator.doNotTrack || 'N/A',
  webglVendor: 'データ取得中...',
  webglRenderer: 'データ取得中...'
};

// WebGL情報の取得を試みる
try {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  
  if (gl) {
    ORIGINAL_VALUES.webglVendor = gl.getParameter(gl.VENDOR);
    ORIGINAL_VALUES.webglRenderer = gl.getParameter(gl.RENDERER);
  } else {
    ORIGINAL_VALUES.webglVendor = 'WebGL未対応';
    ORIGINAL_VALUES.webglRenderer = 'WebGL未対応';
  }
} catch (e) {
  console.error('WebGL情報取得エラー:', e);
  ORIGINAL_VALUES.webglVendor = 'エラー';
  ORIGINAL_VALUES.webglRenderer = 'エラー';
}

// オリジナルのフォント情報を設定
ORIGINAL_VALUES.fonts = [
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
];

// オリジナルのデバイス情報を設定
ORIGINAL_VALUES.devices = [
  { kind: "audioinput", label: "内蔵マイク" },
  { kind: "videoinput", label: "内蔵Webカメラ" },
  { kind: "audiooutput", label: "内蔵スピーカー" }
];

// バッテリー情報を設定
ORIGINAL_VALUES.batteryCharging = true;
ORIGINAL_VALUES.batteryLevel = 1.0;

// 接続情報を設定
ORIGINAL_VALUES.connectionType = "4g";
ORIGINAL_VALUES.downlink = 10;

// ブラウザバー情報を設定
ORIGINAL_VALUES.menubarVisible = false;
ORIGINAL_VALUES.toolbarVisible = false;

// メディアフォーマット情報を設定
ORIGINAL_VALUES.mp4Support = "probably";
ORIGINAL_VALUES.webmSupport = "probably";

// 設定を取得する
function getSettings() {
  return new Promise((resolve) => {
    browserAPI.storage.local.get("settings", (result) => {
      // デフォルト設定
      const defaultSettings = {
        enableHeaderSpoofing: true,
        enableJsSpoofing: true
      };

      // 保存されている設定があればそれを使用し、なければデフォルト設定を使用
      const settings = result.settings || defaultSettings;
      resolve(settings);
    });
  });
}

// HTTPリクエストヘッダーを変更する
browserAPI.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    const settings = await getSettings();
    
    // ヘッダースプーフィングが無効な場合は何もしない
    if (!settings.enableHeaderSpoofing) {
      return { requestHeaders: details.requestHeaders };
    }

    let headers = details.requestHeaders;
    
    // ヘッダーを変更
    headers = headers.map(header => {
      const headerName = header.name.toLowerCase();
      
      if (MAJORITY_VALUES.headers[headerName]) {
        // Refererヘッダーの場合、一部のリクエストでは保持する（セキュリティ上の理由から）
        if (headerName === "referer") {
          // 同一オリジンのリクエストの場合はRefererを保持
          const url = details.url;
          const currentOrigin = new URL(url).origin;
          const refererValue = header.value;
          
          // Refererが存在し、かつ同一オリジンの場合は保持
          if (refererValue && refererValue.startsWith(currentOrigin)) {
            return header;
          }
          
          // サードパーティドメインへのリクエストの場合は偽装
          header.value = MAJORITY_VALUES.headers[headerName];
        } else {
          header.value = MAJORITY_VALUES.headers[headerName];
        }
      }
      
      return header;
    });
    
    // If-None-Matchヘッダーが存在する場合は偽装または削除
    const hasIfNoneMatchHeader = headers.some(header => 
      header.name.toLowerCase() === "if-none-match"
    );
    
    if (hasIfNoneMatchHeader) {
      headers = headers.map(header => {
        if (header.name.toLowerCase() === "if-none-match") {
          header.value = MAJORITY_VALUES.headers["if-none-match"];
        }
        return header;
      });
    }
    
    // Upgrade-Insecure-Requestsヘッダーが存在しない場合は追加
    const hasUpgradeHeader = headers.some(header => 
      header.name.toLowerCase() === "upgrade-insecure-requests"
    );
    
    if (!hasUpgradeHeader) {
      headers.push({
        name: "Upgrade-Insecure-Requests",
        value: "1"
      });
    }
    
    // ログ出力（デバッグ用）
    console.log(`[Ununique Debug] HTTPヘッダーを偽装しました: ${details.url}`);
    
    return { requestHeaders: headers };
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);

// 設定が変更されたときにログを表示するリスナー
browserAPI.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.settings) {
    console.log("[Ununique Debug] 設定が変更されました。");
    
    // 新しい設定を取得
    const newSettings = changes.settings.newValue;
    
    // アクティブなタブにメッセージを送信
    notifyAllTabs(newSettings);
  }
});

// すべてのタブに設定変更を通知する関数
function notifyAllTabs(settings) {
  // 現在開いているすべてのタブを取得
  browserAPI.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      try {
        // 各タブに設定変更メッセージを送信
        browserAPI.tabs.sendMessage(tab.id, {
          type: "settingsChanged",
          settings: settings
        }, (response) => {
          // レスポンスを処理（エラーは無視）
          const lastError = browserAPI.runtime.lastError;
          if (!lastError) {
            console.log(`[Ununique Debug] タブID: ${tab.id} への設定変更通知が成功しました。`);
          }
        });
      } catch (e) {
        console.error(`[Ununique Debug] タブID: ${tab.id} への設定変更通知中にエラーが発生しました: ${e.message}`);
      }
    }
  });
}

// コンテンツスクリプトからのメッセージを受け取る
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getSettings") {
    getSettings().then(settings => {
      sendResponse({ settings });
    });
    return true; // 非同期レスポンスを示す
  } else if (message.type === "saveSettings") {
    browserAPI.storage.local.set({ settings: message.settings });
    
    // 設定の保存と同時に、他のタブにも通知する
    notifyAllTabs(message.settings);
    
    sendResponse({ success: true });
  } else if (message.type === "getOriginalValues") {
    // オリジナルのブラウザ値を返す
    sendResponse({ originalValues: ORIGINAL_VALUES });
  } else if (message.type === "getSpoofingValues") {
    // オリジナルの値とスプーフィングされた値の両方を返す
    sendResponse({
      originalValues: ORIGINAL_VALUES,
      spoofedValues: MAJORITY_VALUES.spoofed
    });
  }
  return true;
}); 