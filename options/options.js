// オプションページが読み込まれたときに実行
document.addEventListener('DOMContentLoaded', async () => {
  // Chrome と Firefox の両方に対応するためのブラウザAPI
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // 要素の取得
  const headerSpoofingCheckbox = document.getElementById('headerSpoofing');
  const jsSpoofingCheckbox = document.getElementById('jsSpoofing');
  const saveButton = document.getElementById('save');
  const checkResultsButton = document.getElementById('checkResults');
  const spoofResultsDiv = document.getElementById('spoofResults');
  
  // タブ切り替え機能の初期化
  initTabs();
  
  // 保存された設定を取得して表示
  const response = await browserAPI.runtime.sendMessage({ type: 'getSettings' });
  const settings = response.settings;
  
  // チェックボックスの状態を設定
  headerSpoofingCheckbox.checked = settings.enableHeaderSpoofing;
  jsSpoofingCheckbox.checked = settings.enableJsSpoofing;
  
  // 保存ボタンのクリックイベント
  saveButton.addEventListener('click', saveSettings);
  
  // スプーフィング結果確認ボタンのクリックイベント
  checkResultsButton.addEventListener('click', () => {
    if (spoofResultsDiv.style.display === 'none') {
      spoofResultsDiv.style.display = 'block';
      checkSpoofingResults();
      checkResultsButton.textContent = 'スプーフィング結果を隠す';
    } else {
      spoofResultsDiv.style.display = 'none';
      checkResultsButton.textContent = 'スプーフィング結果を確認';
    }
  });
  
  // タブ切り替え機能を初期化する関数
  function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // すべてのタブを非アクティブにする
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // クリックされたタブとそれに対応するコンテンツをアクティブにする
        tab.classList.add('active');
        const tabId = tab.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');
      });
    });
  }
  
  // 設定を保存する関数
  async function saveSettings() {
    const newSettings = {
      enableHeaderSpoofing: headerSpoofingCheckbox.checked,
      enableJsSpoofing: jsSpoofingCheckbox.checked
    };
    
    await browserAPI.runtime.sendMessage({
      type: 'saveSettings',
      settings: newSettings
    });
    
    // 保存成功のメッセージを表示
    const originalText = saveButton.textContent;
    saveButton.textContent = '保存しました！';
    saveButton.disabled = true;
    
    // 3秒後に元のテキストに戻す
    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.disabled = false;
    }, 3000);
  }
  
  // オリジナルのブラウザ情報を保存するオブジェクト
  let originalValues = {};
  // スプーフィング後の値を保存するオブジェクト
  let spoofedValues = {};
  
  // スプーフィング結果を確認する関数
  async function checkSpoofingResults() {
    // 表示内容をリセット
    resetDisplayValues();
    
    try {
      // オリジナルの値とスプーフィング後の値を同時に取得
      const response = await browserAPI.runtime.sendMessage({ type: 'getSpoofingValues' });
      originalValues = response.originalValues || {};
      spoofedValues = response.spoofedValues || {};
      
      // 元の値を表示
      displayOriginalValues();
      
      // スプーフィング後の値を表示
      displaySpoofedValues();
      
      // キャンバスフィンガープリントの作成と表示
      renderCanvasFingerprint();
      
    } catch (e) {
      console.error('スプーフィング値の取得に失敗しました:', e);
      displayErrorMessage();
    }
  }
  
  // 表示内容をリセットする関数
  function resetDisplayValues() {
    // 基本情報
    document.getElementById('originalUserAgent').textContent = '取得中...';
    document.getElementById('spoofedUserAgent').textContent = '取得中...';
    document.getElementById('originalPlatform').textContent = '取得中...';
    document.getElementById('spoofedPlatform').textContent = '取得中...';
    document.getElementById('originalLanguage').textContent = '取得中...';
    document.getElementById('spoofedLanguage').textContent = '取得中...';
    document.getElementById('originalScreenWidth').textContent = '取得中...';
    document.getElementById('spoofedScreenWidth').textContent = '取得中...';
    document.getElementById('originalScreenHeight').textContent = '取得中...';
    document.getElementById('spoofedScreenHeight').textContent = '取得中...';
    document.getElementById('originalHardwareConcurrency').textContent = '取得中...';
    document.getElementById('spoofedHardwareConcurrency').textContent = '取得中...';
    document.getElementById('originalDoNotTrack').textContent = '取得中...';
    document.getElementById('spoofedDoNotTrack').textContent = '取得中...';
    
    // WebGL情報
    document.getElementById('originalWebGLVendor').textContent = '取得中...';
    document.getElementById('spoofedWebGLVendor').textContent = '取得中...';
    document.getElementById('originalWebGLRenderer').textContent = '取得中...';
    document.getElementById('spoofedWebGLRenderer').textContent = '取得中...';
    
    // フォントリスト
    document.getElementById('originalFonts').innerHTML = '取得中...';
    document.getElementById('spoofedFonts').innerHTML = '取得中...';
    
    // メディアデバイス
    document.getElementById('originalDevices').innerHTML = '取得中...';
    document.getElementById('spoofedDevices').innerHTML = '取得中...';
    
    // バッテリー情報
    document.getElementById('originalBatteryCharging').textContent = '取得中...';
    document.getElementById('spoofedBatteryCharging').textContent = '取得中...';
    document.getElementById('originalBatteryLevel').textContent = '取得中...';
    document.getElementById('spoofedBatteryLevel').textContent = '取得中...';
    
    // 接続情報
    document.getElementById('originalConnectionType').textContent = '取得中...';
    document.getElementById('spoofedConnectionType').textContent = '取得中...';
    document.getElementById('originalDownlink').textContent = '取得中...';
    document.getElementById('spoofedDownlink').textContent = '取得中...';
    
    // ブラウザバー
    document.getElementById('originalMenubar').textContent = '取得中...';
    document.getElementById('spoofedMenubar').textContent = '取得中...';
    document.getElementById('originalToolbar').textContent = '取得中...';
    document.getElementById('spoofedToolbar').textContent = '取得中...';
    
    // メディアフォーマット
    document.getElementById('originalMP4Support').textContent = '取得中...';
    document.getElementById('spoofedMP4Support').textContent = '取得中...';
    document.getElementById('originalWebMSupport').textContent = '取得中...';
    document.getElementById('spoofedWebMSupport').textContent = '取得中...';
  }
  
  // 元の値を表示する関数
  function displayOriginalValues() {
    // 基本情報
    document.getElementById('originalUserAgent').textContent = originalValues.userAgent || 'データなし';
    document.getElementById('originalPlatform').textContent = originalValues.platform || 'データなし';
    document.getElementById('originalLanguage').textContent = originalValues.language || 'データなし';
    document.getElementById('originalScreenWidth').textContent = originalValues.screenWidth || 'データなし';
    document.getElementById('originalScreenHeight').textContent = originalValues.screenHeight || 'データなし';
    document.getElementById('originalHardwareConcurrency').textContent = originalValues.hardwareConcurrency || 'データなし';
    document.getElementById('originalDoNotTrack').textContent = originalValues.doNotTrack || 'データなし';
    
    // WebGL情報
    document.getElementById('originalWebGLVendor').textContent = originalValues.webglVendor || 'データなし';
    document.getElementById('originalWebGLRenderer').textContent = originalValues.webglRenderer || 'データなし';
    
    // フォントリスト
    displayFonts('originalFonts', originalValues.fonts || []);
    
    // メディアデバイス
    displayDevices('originalDevices', originalValues.devices || []);
    
    // バッテリー情報
    document.getElementById('originalBatteryCharging').textContent = 
      originalValues.batteryCharging !== undefined ? (originalValues.batteryCharging ? '充電中' : '充電していない') : 'データなし';
    document.getElementById('originalBatteryLevel').textContent = 
      originalValues.batteryLevel !== undefined ? Math.round(originalValues.batteryLevel * 100) + '%' : 'データなし';
    
    // 接続情報
    document.getElementById('originalConnectionType').textContent = originalValues.connectionType || 'データなし';
    document.getElementById('originalDownlink').textContent = 
      originalValues.downlink ? originalValues.downlink + 'Mbps' : 'データなし';
    
    // ブラウザバー
    document.getElementById('originalMenubar').textContent = 
      originalValues.menubarVisible !== undefined ? (originalValues.menubarVisible ? '表示' : '非表示') : 'データなし';
    document.getElementById('originalToolbar').textContent = 
      originalValues.toolbarVisible !== undefined ? (originalValues.toolbarVisible ? '表示' : '非表示') : 'データなし';
    
    // メディアフォーマット
    document.getElementById('originalMP4Support').textContent = originalValues.mp4Support || '対応していません';
    document.getElementById('originalWebMSupport').textContent = originalValues.webmSupport || '対応していません';
  }
  
  // スプーフィング後の値を表示する関数
  function displaySpoofedValues() {
    // 基本情報
    document.getElementById('spoofedUserAgent').textContent = spoofedValues.userAgent || 'データなし';
    document.getElementById('spoofedPlatform').textContent = spoofedValues.platform || 'データなし';
    document.getElementById('spoofedLanguage').textContent = spoofedValues.language || 'データなし';
    document.getElementById('spoofedScreenWidth').textContent = spoofedValues.screenWidth || 'データなし';
    document.getElementById('spoofedScreenHeight').textContent = spoofedValues.screenHeight || 'データなし';
    document.getElementById('spoofedHardwareConcurrency').textContent = spoofedValues.hardwareConcurrency || 'データなし';
    document.getElementById('spoofedDoNotTrack').textContent = spoofedValues.doNotTrack || 'データなし';
    
    // WebGL情報
    document.getElementById('spoofedWebGLVendor').textContent = spoofedValues.webglVendor || 'データなし';
    document.getElementById('spoofedWebGLRenderer').textContent = spoofedValues.webglRenderer || 'データなし';
    
    // フォントリスト
    displayFonts('spoofedFonts', spoofedValues.fonts || []);
    
    // メディアデバイス
    displayDevices('spoofedDevices', spoofedValues.devices || []);
    
    // バッテリー情報
    document.getElementById('spoofedBatteryCharging').textContent = 
      spoofedValues.batteryCharging !== undefined ? (spoofedValues.batteryCharging ? '充電中' : '充電していない') : 'データなし';
    document.getElementById('spoofedBatteryLevel').textContent = 
      spoofedValues.batteryLevel !== undefined ? Math.round(spoofedValues.batteryLevel * 100) + '%' : 'データなし';
    
    // 接続情報
    document.getElementById('spoofedConnectionType').textContent = spoofedValues.connectionType || 'データなし';
    document.getElementById('spoofedDownlink').textContent = 
      spoofedValues.downlink ? spoofedValues.downlink + 'Mbps' : 'データなし';
    
    // ブラウザバー
    document.getElementById('spoofedMenubar').textContent = 
      spoofedValues.menubarVisible !== undefined ? (spoofedValues.menubarVisible ? '表示' : '非表示') : 'データなし';
    document.getElementById('spoofedToolbar').textContent = 
      spoofedValues.toolbarVisible !== undefined ? (spoofedValues.toolbarVisible ? '表示' : '非表示') : 'データなし';
    
    // メディアフォーマット
    document.getElementById('spoofedMP4Support').textContent = spoofedValues.mp4Support || '対応していません';
    document.getElementById('spoofedWebMSupport').textContent = spoofedValues.webmSupport || '対応していません';
  }
  
  // エラーメッセージを表示する関数
  function displayErrorMessage() {
    const errorMsg = 'データの取得に失敗しました。再試行してください。';
    
    // 基本情報
    document.getElementById('originalUserAgent').textContent = errorMsg;
    document.getElementById('spoofedUserAgent').textContent = errorMsg;
    // 他の要素も同様に
    document.getElementById('originalPlatform').textContent = errorMsg;
    document.getElementById('spoofedPlatform').textContent = errorMsg;
    document.getElementById('originalLanguage').textContent = errorMsg;
    document.getElementById('spoofedLanguage').textContent = errorMsg;
    document.getElementById('originalScreenWidth').textContent = errorMsg;
    document.getElementById('spoofedScreenWidth').textContent = errorMsg;
    document.getElementById('originalScreenHeight').textContent = errorMsg;
    document.getElementById('spoofedScreenHeight').textContent = errorMsg;
    document.getElementById('originalHardwareConcurrency').textContent = errorMsg;
    document.getElementById('spoofedHardwareConcurrency').textContent = errorMsg;
    document.getElementById('originalDoNotTrack').textContent = errorMsg;
    document.getElementById('spoofedDoNotTrack').textContent = errorMsg;
    
    // WebGL情報
    document.getElementById('originalWebGLVendor').textContent = errorMsg;
    document.getElementById('spoofedWebGLVendor').textContent = errorMsg;
    document.getElementById('originalWebGLRenderer').textContent = errorMsg;
    document.getElementById('spoofedWebGLRenderer').textContent = errorMsg;
    
    // フォントリスト
    document.getElementById('originalFonts').innerHTML = errorMsg;
    document.getElementById('spoofedFonts').innerHTML = errorMsg;
    
    // メディアデバイス
    document.getElementById('originalDevices').innerHTML = errorMsg;
    document.getElementById('spoofedDevices').innerHTML = errorMsg;
    
    // バッテリー情報
    document.getElementById('originalBatteryCharging').textContent = errorMsg;
    document.getElementById('spoofedBatteryCharging').textContent = errorMsg;
    document.getElementById('originalBatteryLevel').textContent = errorMsg;
    document.getElementById('spoofedBatteryLevel').textContent = errorMsg;
    
    // 接続情報
    document.getElementById('originalConnectionType').textContent = errorMsg;
    document.getElementById('spoofedConnectionType').textContent = errorMsg;
    document.getElementById('originalDownlink').textContent = errorMsg;
    document.getElementById('spoofedDownlink').textContent = errorMsg;
    
    // ブラウザバー
    document.getElementById('originalMenubar').textContent = errorMsg;
    document.getElementById('spoofedMenubar').textContent = errorMsg;
    document.getElementById('originalToolbar').textContent = errorMsg;
    document.getElementById('spoofedToolbar').textContent = errorMsg;
    
    // メディアフォーマット
    document.getElementById('originalMP4Support').textContent = errorMsg;
    document.getElementById('spoofedMP4Support').textContent = errorMsg;
    document.getElementById('originalWebMSupport').textContent = errorMsg;
    document.getElementById('spoofedWebMSupport').textContent = errorMsg;
  }
  
  // フォントリストを表示する関数
  function displayFonts(elementId, fonts) {
    const fontDiv = document.getElementById(elementId);
    fontDiv.innerHTML = '';
    
    if (!fonts || fonts.length === 0) {
      fontDiv.textContent = 'フォントデータがありません';
      return;
    }
    
    fonts.forEach(font => {
      const fontItem = document.createElement('div');
      fontItem.className = 'font-item';
      fontItem.textContent = `${font.name}: ${font.available ? '利用可能' : '利用不可'}`;
      fontItem.style.color = font.available ? '#4CAF50' : '#999';
      fontDiv.appendChild(fontItem);
    });
  }
  
  // メディアデバイスを表示する関数
  function displayDevices(elementId, devices) {
    const devicesDiv = document.getElementById(elementId);
    devicesDiv.innerHTML = '';
    
    if (!devices || devices.length === 0) {
      devicesDiv.textContent = 'デバイスがありません';
      return;
    }
    
    // スタイリングを適用
    devicesDiv.style.maxHeight = '200px';
    devicesDiv.style.overflowY = 'auto';
    devicesDiv.style.padding = '10px';
    devicesDiv.style.backgroundColor = '#f9f9f9';
    devicesDiv.style.border = '1px solid #ddd';
    devicesDiv.style.borderRadius = '4px';
    
    devices.forEach(device => {
      const deviceItem = document.createElement('div');
      deviceItem.style.padding = '3px 0';
      deviceItem.style.fontSize = '13px';
      deviceItem.textContent = `${device.kind}: ${device.label || '名前なし'}`;
      devicesDiv.appendChild(deviceItem);
    });
  }
  
  // キャンバスフィンガープリントを描画する関数
  function renderCanvasFingerprint() {
    try {
      const text = "Ununique Canvas Test 123!";
      
      // オリジナルキャンバス
      const originalCanvas = document.getElementById('originalCanvas');
      const originalCtx = originalCanvas.getContext('2d');
      drawCanvasContent(originalCtx, text, false);
      
      // スプーフィングされたキャンバス
      const spoofedCanvas = document.getElementById('spoofedCanvas');
      const spoofedCtx = spoofedCanvas.getContext('2d');
      drawCanvasContent(spoofedCtx, text, true);
      
    } catch (e) {
      console.error('キャンバス描画エラー:', e);
    }
  }
  
  // キャンバスにコンテンツを描画する関数
  function drawCanvasContent(ctx, text, isSpoof) {
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
