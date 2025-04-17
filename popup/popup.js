// ポップアップが読み込まれたときに実行
document.addEventListener('DOMContentLoaded', async () => {
  // Chrome と Firefox の両方に対応するためのブラウザAPI
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // 要素の取得
  const headerSpoofingCheckbox = document.getElementById('headerSpoofing');
  const jsSpoofingCheckbox = document.getElementById('jsSpoofing');
  const openOptionsLink = document.getElementById('openOptions');
  
  // 保存された設定を取得して表示
  const response = await browserAPI.runtime.sendMessage({ type: 'getSettings' });
  const settings = response.settings;
  
  // チェックボックスの状態を設定
  headerSpoofingCheckbox.checked = settings.enableHeaderSpoofing;
  jsSpoofingCheckbox.checked = settings.enableJsSpoofing;
  
  // チェックボックスの変更を検知して設定を保存
  headerSpoofingCheckbox.addEventListener('change', saveSettings);
  jsSpoofingCheckbox.addEventListener('change', saveSettings);
  
  // 詳細設定リンクのクリックイベント
  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    browserAPI.runtime.openOptionsPage();
  });
  
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
    
    // 設定が変更されたことをユーザーに通知
    // （ここではシンプルさを優先して通知は省略）
  }
}); 