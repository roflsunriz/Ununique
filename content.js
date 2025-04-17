// マジョリティ値の定義
const MAJORITY_VALUES = {
  navigator: {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    platform: "Win32",
    cookieEnabled: true,
    language: "en-US",
    languages: ["en-US", "en"],
    doNotTrack: 1,
    product: "Gecko",
    productSub: "20030107",
    vendor: "Google Inc.",
    hardwareConcurrency: 4,
    javaEnabled: false,
    deviceMemory: 8
  },
  screen: {
    width: 1920,
    height: 1080,
    pixelDepth: 24,
    availWidth: 1920,
    availHeight: 1080,
    availLeft: 0,
    availTop: 0,
    colorDepth: 24,
    left: 0,
    top: 0
  },
  // タイムゾーン情報
  timezone: {
    offset: 0, // UTC-00:00
    timezone: "UTC"
  },
  // プラグイン情報 (Firefoxでは限定的)
  plugins: {
    // Chrome標準のPDFビューア
    pdfViewerName: "Chrome PDF Plugin",
    pdfViewerDescription: "Portable Document Format",
    pdfViewerFilename: "internal-pdf-viewer",
    // 基本的なMIMEタイプ
    mimeTypes: [
      {
        type: "application/pdf",
        description: "Portable Document Format",
        suffixes: "pdf"
      }
    ]
  },
  // 一般的なフォントリスト
  fonts: [
    "Arial",
    "Times New Roman",
    "Courier New",
    "Verdana",
    "Georgia",
    "Tahoma",
    "Trebuchet MS",
    "Impact",
    "Comic Sans MS",
    "Arial Black",
    "Lucida Sans Unicode",
    "Lucida Console",
    "Palatino Linotype",
    "Book Antiqua",
    "Arial Narrow",
    "Cambria",
    "Calibri",
    "Garamond",
    "MS Sans Serif",
    "MS Serif"
  ],
  // ネットワーク接続情報
  connection: {
    effectiveType: "4g",
    rtt: 50,
    downlink: 10,
    saveData: false
  },
  // バッテリー情報
  battery: {
    charging: true,
    chargingTime: 0,
    dischargingTime: Infinity,
    level: 1.0
  },
  // メディアデバイス情報
  mediaDevices: {
    // 一般的なカメラとマイクの設定
    videoInputs: 1,
    audioInputs: 1,
    audioOutputs: 1
  },
  // ブラウザバー情報
  bars: {
    visible: false
  },
  // オーディオフィンガープリント対策の設定
  audio: {
    sampleRate: 44100,
    channelCount: 2,
    frequencyValues: new Float32Array(128).fill(0.5) // 一律の値
  },
  // モーションセンサー情報
  sensors: {
    // 加速度センサーのデフォルト値（静止状態）
    acceleration: {
      x: 0,
      y: 0,
      z: 0
    },
    // ジャイロスコープのデフォルト値（回転なし）
    rotationRate: {
      alpha: 0,
      beta: 0,
      gamma: 0
    },
    // 照度センサーのデフォルト値
    ambientLight: 500  // 標準的な室内照明の照度 (ルクス)
  }
};

// デバッグ用のロギング関数
function logDebug(message) {
  console.log(`[Ununique Debug] ${message}`);
}

// 現在の設定を保持する変数
let currentSettings = {
  enableHeaderSpoofing: true,
  enableJsSpoofing: true
};

// 重要: コンテンツスクリプトはisolated worldで実行されるため
// メインワールドにコードを注入して、ブラウザのプロパティを直接上書きする
function injectScriptToMainWorld(settings) {
  logDebug("メインワールドへのスクリプト注入を開始します");
  
  // 設定に基づいてJavaScriptスプーフィングをスキップする
  if (!settings.enableJsSpoofing) {
    logDebug("JavaScriptスプーフィングが無効なため、スクリプト注入をスキップします");
    return;
  }
  
  // メインワールドに注入するコードを文字列として作成
  const scriptContent = `
    // メインワールドで実行されるコードここから
    (function() {
      console.log("[Ununique Main World] メインワールドでの実行を開始します");
      
      // マジョリティ値の定義（JSON化してコンテンツスクリプトから引き継ぐ）
      const MAJORITY_VALUES = ${JSON.stringify(MAJORITY_VALUES)};
      
      // JavaScriptプロパティを偽装する関数
      function spoofJavaScriptProperties() {
        console.log("[Ununique Main World] JavaScriptプロパティの偽装を開始します");
        
        // navigatorプロパティを偽装
        for (const prop in MAJORITY_VALUES.navigator) {
          try {
            if (navigator[prop] !== undefined) {
              const originalValue = navigator[prop];
              console.log("[Ununique Main World] navigator." + prop + " を偽装します: " + originalValue + " → " + MAJORITY_VALUES.navigator[prop]);
              
              // プロトタイプに対してgetterを定義
              const navigatorProto = Navigator.prototype;
              
              // プロパティディスクリプタを取得して再定義
              try {
                Object.defineProperty(navigatorProto, prop, {
                  get: function() {
                    return MAJORITY_VALUES.navigator[prop];
                  }
                });
                console.log("[Ununique Main World] navigator." + prop + " の偽装に成功しました");
              } catch(e) {
                console.log("[Ununique Main World] navigator." + prop + " の偽装に失敗しました: " + e.message);
              }
            }
          } catch (e) {
            console.log("[Ununique Main World] navigator." + prop + " の偽装処理中にエラーが発生しました: " + e.message);
          }
        }
        
        // screenプロパティを偽装
        for (const prop in MAJORITY_VALUES.screen) {
          try {
            if (screen[prop] !== undefined) {
              const originalValue = screen[prop];
              console.log("[Ununique Main World] screen." + prop + " を偽装します: " + originalValue + " → " + MAJORITY_VALUES.screen[prop]);
              
              // プロトタイプに対してgetterを定義
              const screenProto = Screen.prototype;
              
              try {
                Object.defineProperty(screenProto, prop, {
                  get: function() {
                    return MAJORITY_VALUES.screen[prop];
                  }
                });
                console.log("[Ununique Main World] screen." + prop + " の偽装に成功しました");
              } catch(e) {
                console.log("[Ununique Main World] screen." + prop + " の偽装に失敗しました: " + e.message);
              }
            }
          } catch (e) {
            console.log("[Ununique Main World] screen." + prop + " の偽装処理中にエラーが発生しました: " + e.message);
          }
        }
        
        // タイムゾーン偽装
        try {
          // Date.prototype.getTimezoneOffsetをオーバーライド
          const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
          Date.prototype.getTimezoneOffset = function() {
            return MAJORITY_VALUES.timezone.offset;
          };
          
          // Intl.DateTimeFormat偽装
          if (window.Intl && window.Intl.DateTimeFormat) {
            const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
            Intl.DateTimeFormat.prototype.resolvedOptions = function() {
              const options = origResolvedOptions.apply(this, arguments);
              options.timeZone = MAJORITY_VALUES.timezone.timezone;
              return options;
            };
          }
          console.log("[Ununique Main World] タイムゾーン情報の偽装が完了しました");
        } catch (e) {
          console.log("[Ununique Main World] タイムゾーン偽装中にエラーが発生しました: " + e.message);
        }
        
        // キャンバスフィンガープリンティング対策
        try {
          const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
          const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
          
          // toDataURLメソッドをオーバーライド
          HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
            // 小さなキャンバスは偽装しない（UIコンポーネントなどに影響を与えないため）
            if (this.width <= 16 || this.height <= 16) {
              return origToDataURL.apply(this, arguments);
            }
            
            // オリジナルのメソッドを呼び出す
            const dataURL = origToDataURL.apply(this, arguments);
            
            // データURLをわずかに変更する
            try {
              // Base64のデータ部分（カンマ以降）を取得
              const dataPart = dataURL.split(',')[1];
              
              if (dataPart) {
                // Base64デコード
                const binaryString = atob(dataPart);
                const bytes = new Uint8Array(binaryString.length);
                
                // バイナリデータを変更（わずかなノイズを追加）
                for (let i = 0; i < bytes.length; i++) {
                  const byte = binaryString.charCodeAt(i);
                  // 100バイトごとに値を少し変更
                  if (i % 100 === 0) {
                    bytes[i] = byte === 255 ? 254 : byte + 1;
                  } else {
                    bytes[i] = byte;
                  }
                }
                
                // バイナリデータをBase64に戻す
                let binary = '';
                for (let i = 0; i < bytes.length; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                const modifiedData = btoa(binary);
                
                // 新しいデータURLを構築
                const header = dataURL.split(',')[0];
                const modifiedDataURL = header + ',' + modifiedData;
                
                return modifiedDataURL;
              }
            } catch (modifyErr) {
              console.log("[Ununique Main World] キャンバスデータの変更に失敗しました: " + modifyErr.message);
            }
            
            // 変更に失敗した場合は元のデータを返す
            return dataURL;
          };
          
          // getImageDataメソッドをオーバーライド
          CanvasRenderingContext2D.prototype.getImageData = function() {
            // 小さなキャンバスは偽装しない
            if (this.canvas.width <= 16 || this.canvas.height <= 16) {
              return origGetImageData.apply(this, arguments);
            }
            
            // オリジナルのメソッドを呼び出す
            const imageData = origGetImageData.apply(this, arguments);
            
            // データにわずかな変更を加える
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 100) {
              data[i] = data[i] === 255 ? 254 : data[i] + 1;
            }
            
            return imageData;
          };
          console.log("[Ununique Main World] キャンバスフィンガープリントの偽装が完了しました");
        } catch (e) {
          console.log("[Ununique Main World] キャンバスフィンガープリント偽装中にエラーが発生しました: " + e.message);
        }
        
        // WebGLフィンガープリンティング対策
        try {
          // WebGLRenderingContextのgetParameterメソッドをオーバーライド
          if (window.WebGLRenderingContext) {
            const origGetParameter = WebGLRenderingContext.prototype.getParameter;
            
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
              // RENDERER、VENDOR、UNMASKED_RENDERER_WEBGL、UNMASKED_VENDOR_WEBGLを偽装
              if (parameter === 0x1F01) { // VENDOR
                return "Mozilla";
              } else if (parameter === 0x1F00) { // RENDERER
                return "Mozilla";
              } else if (parameter === 0x9246) { // UNMASKED_RENDERER_WEBGL
                return "Nvidia(R) GeForce GTX 1060";
              } else if (parameter === 0x9245) { // UNMASKED_VENDOR_WEBGL
                return "Nvidia Inc.";
              }
              
              // その他のパラメーターは通常通り
              return origGetParameter.apply(this, arguments);
            };
            console.log("[Ununique Main World] WebGLフィンガープリントの偽装が完了しました");
          }
        } catch (e) {
          console.log("[Ununique Main World] WebGLフィンガープリント偽装中にエラーが発生しました: " + e.message);
        }
        
        // WebWorkerのフィンガープリント対策
        try {
          // Worker コンストラクタをオーバーライド
          const origWorker = window.Worker;
          window.Worker = function(scriptURL, options) {
            // Worker内で実行するプリロードコード
            const workerPreloadCode = 
              '// オリジナルのself.navigatorとself.screenをバックアップ\\n' +
              'const origNavigator = self.navigator;\\n' +
              'const origScreen = self.screen;\\n' +
              '\\n' +
              '// Worker内でのnavigatorプロパティをオーバーライド\\n' +
              'const navProps = ' + JSON.stringify(MAJORITY_VALUES.navigator) + ';\\n' +
              'for (const prop in navProps) {\\n' +
              '  if (origNavigator[prop] !== undefined) {\\n' +
              '    Object.defineProperty(self.navigator, prop, {\\n' +
              '      get: function() { return navProps[prop]; }\\n' +
              '    });\\n' +
              '  }\\n' +
              '}\\n' +
              '\\n' +
              '// Workerの中から元のスクリプトを読み込む\\n' +
              'self.importScripts(scriptURL);\\n';
            
            const workerBlob = new Blob([workerPreloadCode], { type: 'application/javascript' });
            const workerURL = URL.createObjectURL(workerBlob);
            const worker = new origWorker(workerURL, options);
            
            // URLオブジェクトをクリーンアップ
            URL.revokeObjectURL(workerURL);
            
            return worker;
          };
          console.log("[Ununique Main World] WebWorker偽装の準備が完了しました");
        } catch (e) {
          console.log("[Ununique Main World] WebWorker偽装の準備中にエラーが発生しました: " + e.message);
        }
        
        // 他の偽装（メモリ使用量の多いため、最小限に抑える）
        // 実際のWebサイトでの動作に影響が少ない偽装に絞る
        
        // オーディオコンテキスト偽装
        try {
          if (window.AudioContext || window.webkitAudioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            
            // サンプルレートを偽装
            try {
              Object.defineProperty(AudioContextClass.prototype, 'sampleRate', {
                get: function() {
                  return MAJORITY_VALUES.audio.sampleRate;
                }
              });
              console.log("[Ununique Main World] AudioContext.sampleRate の偽装が完了しました");
            } catch (e) {
              console.log("[Ununique Main World] AudioContext.sampleRate の偽装に失敗しました: " + e.message);
            }
          }
        } catch (e) {
          console.log("[Ununique Main World] オーディオコンテキスト偽装中にエラーが発生しました: " + e.message);
        }
        
        console.log("[Ununique Main World] JavaScriptプロパティの偽装が完了しました");
      }
      
      // 偽装を実行
      spoofJavaScriptProperties();
      
      // 検出回避のための継続的な監視（MutationObserverによる監視は負荷が高いため、簡易的な監視に留める）
      setInterval(() => {
        // userAgentを検証して、変更されていたら再適用
        if (navigator.userAgent !== MAJORITY_VALUES.navigator.userAgent) {
          console.log("[Ununique Main World] 偽装が解除されたことを検出しました。再適用します。");
          spoofJavaScriptProperties();
        }
      }, 2000);
      
      // DOMが変更された場合のトラップ（iframeや動的コンテンツ対応）
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function(node) {
              // iframeが追加された場合
              if (node.tagName === 'IFRAME') {
                try {
                  node.addEventListener('load', function() {
                    try {
                      // iframeのcontentWindowにアクセス
                      const iframeWindow = node.contentWindow;
                      
                      // iframeのnavigatorを偽装
                      for (const prop in MAJORITY_VALUES.navigator) {
                        try {
                          if (iframeWindow.navigator[prop] !== undefined) {
                            Object.defineProperty(iframeWindow.navigator, prop, {
                              get: function() {
                                return MAJORITY_VALUES.navigator[prop];
                              }
                            });
                          }
                        } catch (e) {
                          // クロスオリジンの場合はアクセスできないため、エラーを無視
                        }
                      }
                    } catch (e) {
                      // 同様にクロスオリジンの場合はエラーになるため無視
                    }
                  });
                } catch (e) {
                  // エラーを無視
                }
              }
            });
          }
        });
      });
      
      // documentの変更を監視
      observer.observe(document, {
        childList: true,
        subtree: true
      });
    })();
    // メインワールドで実行されるコードここまで
  `;
  
  // インラインスクリプト要素を作成
  const scriptElement = document.createElement('script');
  scriptElement.textContent = scriptContent;
  
  // script要素をheadの先頭に挿入（最も早く実行される位置）
  const head = document.head || document.documentElement;
  head.insertBefore(scriptElement, head.firstChild);
  
  // スクリプト注入後に要素を削除（きれいにする）
  scriptElement.remove();
  
  logDebug("メインワールドへのスクリプト注入が完了しました");
}

// 設定に基づいてスクリプト注入を実行する関数
function applySettings(settings) {
  currentSettings = settings;
  
  if (settings.enableJsSpoofing) {
    injectScriptToMainWorld(settings);
    logDebug("JavaScriptスプーフィングが有効です。メインワールドでの偽装を実行しました。");
  } else {
    logDebug("JavaScriptスプーフィングが無効です。");
  }
}

// バックグラウンドスクリプトと通信するためのコードは残しておく
// 設定を取得する
async function getSettings() {
  return new Promise((resolve) => {
    try {
      // ブラウザAPIへの対応（Firefox または Chrome）
      const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
      
      browserAPI.runtime.sendMessage({ type: "getSettings" }, (response) => {
        if (response && response.settings) {
          logDebug("設定を取得しました: " + JSON.stringify(response.settings));
          resolve(response.settings);
        } else {
          logDebug("設定の取得に失敗しました。デフォルト設定を使用します。");
          // デフォルト設定
          resolve({
            enableHeaderSpoofing: true,
            enableJsSpoofing: true
          });
        }
      });
    } catch (e) {
      logDebug("設定取得中にエラーが発生しました: " + e.message);
      // エラーが発生した場合もデフォルト設定を使用
      resolve({
        enableHeaderSpoofing: true,
        enableJsSpoofing: true
      });
    }
  });
}

// 設定変更を監視するリスナーを設定
function setupSettingsListener() {
  try {
    // ブラウザAPIへの対応（Firefox または Chrome）
    const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
    
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "settingsChanged" && message.settings) {
        logDebug("設定変更通知を受信しました: " + JSON.stringify(message.settings));
        applySettings(message.settings);
        if (sendResponse) {
          sendResponse({ success: true });
        }
      }
      return true;
    });
    
    logDebug("設定変更リスナーを設定しました");
  } catch (e) {
    logDebug("設定変更リスナーの設定中にエラーが発生しました: " + e.message);
  }
}

// 初期化処理
async function initialize() {
  // 設定を取得して適用
  const settings = await getSettings();
  applySettings(settings);
  
  // 設定変更リスナーを設定
  setupSettingsListener();
}

// DOMContentLoadedイベントを待たず、即時実行
initialize(); 