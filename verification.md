# 検証手順

## 2026-10-19: CI高速化

- 変更したGitHub Actionsをactionlint 1.7.12で検査し、エラー0件を確認した。
- GitHub上の未解決Dependabot更新PRと依存脆弱性アラートがともに0件であることを確認した。

## Dependabot 自動処理（2026-09-23）

`.github/workflows/dependabot-automation.yml` を actionlint で検査し、PR 用 workflow 名（CI）と一致することを確認する。Dependabot の patch／minor かつ全 PR チェック成功の場合だけ取り込み、major・古い SHA・限定修復後も失敗した PR は残す。

実際の Dependabot PR がまだない場合、動作経路は未検証として扱う。実 PR 発生後に自動化ジョブ、CI の再試行、マージ結果を確認する。

## TypeScript 7 併用構成の確認（2026-09-23）

TypeScript 7.0 は API を含まず typescript-eslint 8.70 が未対応のため、公式の併用手順に従い `typescript` を `npm:@typescript/typescript6@^6.0.2` へエイリアスし、`@typescript/native` に `npm:typescript@^7.0.2` を追加した。Dependabot PR #4（typescript 5.9.3→7.0.2）は lint 失敗を確認後に手動で修正し、CI 全成功後にマージした。ローカルでは lint・type-check・14件のテスト・format-check・build・audit（脆弱性 0 件）・validate-locales・validate-amo が成功し、`tsc` が 7.0.2、`tsc6` が 6.0.3 を提供することを確認した。手動修正後は Dependabot 自動化の classify が「PR is not from Dependabot」で失敗するため、自動マージ対象外として手動マージする。

## 依存脆弱性の確認（2026-09-23）

監査では adm-zip、brace-expansion、fast-uri、image-size を含む推移依存の旧版が検出された。Bun 1.4.0 で lockfile の固定インストールと再監査を行い、既知脆弱性 0 件を確認した。書式・lint・型・14件のテスト・ビルド成功。

大量の Dependabot PR により CI 完了より分類が遅れる場合でも、分類後の `workflow_dispatch` が現在の PR 番号と head SHA を照合して再評価する。別の作成者、古い SHA、未完了の CI はマージしない。

## 2026-10-05: GitHub受付・READMEの整備（公開前）

- 比較元: `9e43b3a147f161cf22a9fea1f051768c6afd812e`（`main`）。
- 受付フォーム 2 件のYAML構造、重複キー・ID、入力型、選択肢、予約ファイル名を一括検査し、エラー0件。
- 既存の固有質問・入力例・必須条件を原文と照合。READMEのリンク・画像・コマンド・条件を確認し、裏付けがある誤記だけを訂正した。
- 既存のCI、Dependabot、labeler、ライセンスのファイル内容は比較元から変更していない。
- 製品のビルド・インストール・実機操作、GitHub上のフォーム表示、公開後CIは今回の静的検証に含めない。公開後に実際の受付表示と必要ラベルの適用を確認する。

## 2026-10-05: マージ後の依存監査失敗の修復

- 旧受付整備PRは既にマージ済みで、現在の既定ブランチCIに依存監査の失敗があることをGitHub APIと失敗ログで再確認した。過去の公開前記録を現在の成功根拠には使わない。
- `brace-expansion`、`fast-uri`、`js-yaml`、`undici` は親依存が要求するmajor系列ごとに修正版を指定する。全系列を新majorへ一律置換しない。
- Bun 1.3.8 は新たなversion-scoped overrideを形式1のロックへ保存しても brace-expansion 5.0.9 が残った。Bun 1.4.2で固定インストールすると形式3へ移行し、5.0.12へ解決された。packageManagerとCI・Releaseの固定版を1.4.2へ揃える。
- 書式、lint、型、14テスト（4514アサーション）、ロケール/AMO検査、ビルド、web-ext lint、XPI生成を確認。
- 全重大度の `bun audit` は node-forge のhigh 1件で失敗する。`web-ext 10.7.0 -> @devicefarmer/adbkit 3.3.9 -> node-forge 1.4.0` の経路で、公式npm最新版は1.4.0、GHSA-86w9-cpqp-85rvのfirst_patched_versionはnull。監査抑制、Android実行機能の無根拠な削除、未修正版の別名化はしない。修正版または機能を保持する上流移行が確認されるまでマージ対象にしない。

## 2026-10-11: Dependabot PR の依存監査修復

- npm の公開版で `node-forge` は1.4.0が最新で、GHSA-86w9-cpqp-85rvに修正版がないことを再確認した。上流の digitalbazaar/forge#1152 は入れ子の DigestAlgorithm の要素数を検証する修正と回帰テストを提案している。
- `patches/node-forge@1.4.0.patch` に同じ検証を適用した。`test/node-forge-patch.test.mjs` で正常な構造を受け入れ、余分な入れ子要素を拒否することを確認する。
- `shell-quote` 1.12.0 と `source-map-js` 1.2.2 へ更新した。`bun audit` はパッチ済みの `node-forge` 1件を引き続き報告する。CI の `bun run audit` は全件を取得し、このアドバイザリ1件だけパッチ設定と回帰テストを確認して通す。他の検出、パッチ欠落、テスト失敗は失敗にする。
- 2026-10-05 のマージ保留判断は、上流修正を検証可能なパッチとして適用できたため更新した。上流の正式修正版が公開されたらパッチと検証例外を外して素の監査を再確認する。
- Bun 1.4.2 の固定インストール、format-check、lint、type-check、16件のテスト、validate-locales、validate-amo、build、web-ext lint、XPI生成、`bun run audit` を確認した。素の `bun audit` はパッチ済みの1件を報告する。

## 2026-10-11: Dependabot PR の統合

- PR #11 の監査修復後、Dependabot PR #13（ESLint 10.12.0）、#14（globals 17.13.0）、#12（typescript-eslint 8.71.1）が CI 全成功で main に統合された。PR #12 は Dependabot が公開中の新しい patch 版へ更新した。
- `bun outdated` で残った Prettier 3.9.10 を更新した。固定インストール、書式、lint、型、16テスト、ロケール・AMO検査、ビルド、web-ext lint、監査判定が成功し、更新後の `bun outdated` は更新候補なしだった。

## 2026-10-16: findings.mdへの知見分離

- AGENTS・READMEなどから移した本文を移行前のGit内容と照合し、条件・確認日・コマンド・未検証事項を保持する。移動先の参照とMarkdownの見出し・コードブロックを確認する。
- 変更範囲は文書の配置と参照。アプリのビルド・実機動作を今回再検証したとは扱わない。

- 実行結果: 移行前本文と移動後の文書を行単位で照合し、本文の欠落0件。変更文書の相対リンク・見出し参照の新規エラー0件、git diff --check成功。共通指針の記録先変更は意味の整合を別途確認した。
- GitHub上の既存Dependabot open alertsは0件。更新PRは0件で、今回の文書移行とは別の状態として確認した。新規の外部監査送信は自動承認レビューの制限により実行せず、GitHub上の既存警告確認で補完した。これはローカル依存監査・最新版照会の成功を意味しない。
