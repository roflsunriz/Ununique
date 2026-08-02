# Changelog

## Unreleased

## 1.4.0 - 2026-08-02

### Added

- Canvas、WebGL、音声、フォント、メディアデバイス、Workerを対象にした保護プロファイルとバランス／厳格モードを追加した。
- 単体・統合・拡張機能契約・AMOメタデータ検証、Firefox E2E実行スクリプト、15ロケールのUIと10ロケールの掲載情報を追加した。

### Changed

- HTTPヘッダーとJavaScript値を別々の固定値ではなく、ブラウザー系列・バージョンと画面・CPU・言語が整合する共通プロファイルから生成するようにした。
- Canvasノイズをドキュメント単位の決定的な短命ノイズへ変更し、CanvasのPNGバイト列を直接破壊しない方式にした。
- 無効化・再設定時にメインワールドのプロパティを復元し、既存のReferer・キャッシュ・Upgradeヘッダーを保持するようにした。
- ポップアップ、オプション画面、AMO掲載ページのi18nを拡張し、RTLロケールの方向も設定するようにした。

### Security

- push前監査で検出された既知の依存脆弱性を解消するため、安全版へ依存関係とロックファイルを更新した。

### Changed

- 作業開始時の共通指針見落としを防ぐため、調査やコマンド実行より前に `COMMON-AGENTS.md` を先頭から末尾まで読み、EOFを確認する必須ゲートを追加した。

### Fixed

- CI のフォーマット検査に適合するよう、既存のオプション画面とブラウザー拡張型定義を整形した。
- 厳格モードのフォント判定が `16px Arial` のような実際のCSSフォント指定を誤って拒否しないようにした。

## 1.3.1

### Changed

- Refreshed the extension icon set with a more polished, modern design for release.

## 1.3.0

### Added

- Added a manifest version synchronization script and updated the options page footer.
- Added CI/CD and release automation workflows.
- Added multilingual labels and locale resources for multiple languages.

### Changed

- Updated the options page copy to clearer English and improved the loading messages.
- Improved the `judgementSummary` message and error message formatting across locales.
- Refined the main-world injection flow so settings are injected immediately and continue to sync afterward.

### Fixed

- Fixed TypeScript 7 compatibility issues in the build and source code.

## 1.2.0

### Added

- Migrated the extension codebase to TypeScript.
- Added multilingual labels and locale resources for multiple languages.
- Added CI/CD and release automation workflows.

### Changed

- Updated the options page copy to clearer English and improved the loading messages.
- Improved the `judgementSummary` message and error message formatting across locales.
- Refined the main-world injection flow so settings are injected immediately and continue to sync afterward.

### Fixed

- Fixed TypeScript 7 compatibility issues in the build and source code.

## 1.1.0

### Changed

- Fixed the WebGL vendor and renderer values being swapped.
- Replaced `innerHTML` with `textContent` in the options UI.
- Added a test page and made script behavior configurable from settings.

## 1.0.0

### Added

- Initial release of Ununique.
- Added HTTP header spoofing and JavaScript property spoofing.
- Added the options page and popup for managing spoofing settings.
