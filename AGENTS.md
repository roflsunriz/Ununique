# AGENTS.md

## 作業開始前の必須手順（最優先・例外なし）

1. エージェントは、調査、計画、コマンド実行、スキル利用、ファイル編集、コミット、プッシュを始める前に、必ずリポジトリ直下の `.\COMMON-AGENTS.md` を開き、先頭から末尾まで全文を読む。
2. `COMMON-AGENTS.md` はGit管理外のシンボリックリンクである。`git`や既定のignore設定が有効な`rg --files`の検索結果だけで、ファイルが存在しないと判断してはならない。PowerShellでは最初に次を実行する。

```powershell
Get-Content -Raw -LiteralPath .\COMMON-AGENTS.md
```

3. 読み取りに失敗した場合、出力が省略された場合、または末尾まで読めたことを確認できない場合は、一切の作業を開始せず、パスとシンボリックリンク先を確認して全文を再取得する。必要なら分割して末尾まで読む。
4. 全文を読了するまで、ローカル `AGENTS.md` だけを根拠に作業を続けてはならない。読了後は `COMMON-AGENTS.md` を最優先の指針とし、読了直後の最初の進捗報告で全文を読了したことを明示する。
   このファイルでは `Ununique` 固有の補足だけを記載する。

## Package Manager

Use Bun for this repository.

- Install dependencies with `bun install`.
- Add dependencies with `bun add` or `bun add -d`.
- Run scripts with `bun run <script>`.
- Do not add npm, pnpm, or yarn lockfiles.

## Common Commands

- `bun run format`
- `bun run lint`
- `bun run type-check`
- `bun run build`
- `bun run preview`

## 依存監査で確定した事項（2026-09-23）

- `bun audit fix` だけでは adm-zip、brace-expansion、fast-uri、image-size の脆弱版が上流の厳密な依存範囲で残る。`package.json` の既存 `overrides` と `bun.lock` を同時に更新し、`bun audit` と関連テスト・ビルドで確認する。上流が安全版を取り込んだ場合は override の必要性を再評価する。

## Dependabot の限定修復（2026-09-23）

- CI 再失敗後の自動修復は `bun.lock` だけをパッチとして適用する。修復後は `workflow_dispatch` で `.github/workflows/ci.yml` を再実行するため、この CI の `contents: read` と checkout の `persist-credentials: false` を維持し、PR コードを実行するジョブへ書き込み権限や秘密情報を渡さない。根拠は `.github/workflows/dependabot-automation.yml` と共通ワークフローの権限分離。
