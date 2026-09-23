1. `package.json` のバージョンを上げる。
2. `CHANGELOG.md` に対象バージョンの変更点を追加する。
3. `bun install --frozen-lockfile`、`bun run validate-amo`、`bun run validate-locales`、`bun run test`、`bun run lint`、`bun run type-check`、`bun run build`、`bun run web-ext:lint`、`bun audit` を実行する。
4. `bun run package` でXPIを作成し、必要なら `bun run e2e:firefox` を専用プロファイルで実行する。
5. `git tag vX.X.X` を作成し、`git push Ununique main vX.X.X` でGitHub Actionsを起動する。リリースworkflowは `amo/metadata.json` を使ってAMOへ `listed` チャンネルで提出する。
6. GitHub ActionsのAMO検証・レビュー・署名済みXPI・GitHub Releaseを確認する。認証不足やレビュー待ちは、提出完了とは扱わない。

タグやバージョンを間違えた場合は、公開前であることを確認してから、影響範囲を確認したうえで修正する。既にAMOへ提出したバージョンの差し替えは、AMOのレビュー状態を確認してから行う。

## Dependabot PR の更新

前提は `.github/dependabot.yml` と PR 用 CI（CI）です。更新 PR の head SHA と `gh pr checks <PR番号>` の結果を確認してください。patch／minor は全チェック成功後に自動取り込みされます。初回 CI 失敗は failed jobs のみを 1 回再実行し、再失敗時は `bun.lock` の再生成を試み、修復後の CI を再実行します。変更がない場合や再度失敗した場合は PR を残します。

設定を変えたときは `actionlint .github/workflows/dependabot-automation.yml` と実際の PR の Actions 結果を確認します。問題があれば呼び出し先の共通 workflow SHA を直前の検証済み値へ戻すコミットを push します。取り込まれた依存更新に問題があれば通常の revert コミットで復旧します。

## 依存脆弱性の更新

`package.json` の `overrides` は、上流パッケージが adm-zip、brace-expansion、fast-uri、image-size の旧版を固定している間に安全な patch 版を選ぶために使う。上流が安全版を採用したら override を減らせるか確認する。更新時は `bun install --lockfile-only --ignore-scripts`、`bun install --frozen-lockfile`、`bun audit` を実行し、該当する lint・型・テスト・ビルドを確認する。問題があれば更新コミットを revert し、lockfile と package.json を同じ版へ戻す。

CI 完了より Dependabot の分類が遅れる場合は、`callback_workflow_file` が指す呼び出し側 workflow を `workflow_dispatch` し、同じ PR 番号・head SHA・全チェックを再確認する。呼び出し側のファイル名を変える際はこの入力も一緒に更新する。
