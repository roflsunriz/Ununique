# 検証手順

## Dependabot 自動処理（2026-09-23）

`.github/workflows/dependabot-automation.yml` を actionlint で検査し、PR 用 workflow 名（CI）と一致することを確認する。Dependabot の patch／minor かつ全 PR チェック成功の場合だけ取り込み、major・古い SHA・限定修復後も失敗した PR は残す。

実際の Dependabot PR がまだない場合、動作経路は未検証として扱う。実 PR 発生後に自動化ジョブ、CI の再試行、マージ結果を確認する。

## TypeScript 7 併用構成の確認（2026-09-23）

TypeScript 7.0 は API を含まず typescript-eslint 8.70 が未対応のため、公式の併用手順に従い `typescript` を `npm:@typescript/typescript6@^6.0.2` へエイリアスし、`@typescript/native` に `npm:typescript@^7.0.2` を追加した。Dependabot PR #4（typescript 5.9.3→7.0.2）は lint 失敗を確認後に手動で修正し、CI 全成功後にマージした。ローカルでは lint・type-check・14件のテスト・format-check・build・audit（脆弱性 0 件）・validate-locales・validate-amo が成功し、`tsc` が 7.0.2、`tsc6` が 6.0.3 を提供することを確認した。手動修正後は Dependabot 自動化の classify が「PR is not from Dependabot」で失敗するため、自動マージ対象外として手動マージする。

## 依存脆弱性の確認（2026-09-23）

監査では adm-zip、brace-expansion、fast-uri、image-size を含む推移依存の旧版が検出された。Bun 1.4.0 で lockfile の固定インストールと再監査を行い、既知脆弱性 0 件を確認した。書式・lint・型・14件のテスト・ビルド成功。

大量の Dependabot PR により CI 完了より分類が遅れる場合でも、分類後の `workflow_dispatch` が現在の PR 番号と head SHA を照合して再評価する。別の作成者、古い SHA、未完了の CI はマージしない。
