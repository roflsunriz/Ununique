# プロジェクト固有の知見

共通指針と [AGENTS.md](AGENTS.md) を読んだ後、作業前にこの文書を全文読む。元の条件・確認日・未検証事項を保ったまま、固有の実現手段と再利用する知見を集約する。

## 共通指針の具体化と適用範囲

- 対象: 共通指針の「設計と実装方針」「検証」「更新手順」「ドキュメント」と、各節に明記した共通ルール。
- 理由・範囲: Bunを使うFirefox拡張で、TypeScript 6のAPIと7のCLIを併用する。node-forgeの未公開修正を含む監査は下記の限定条件と回帰テストで確認し、他の検出を隠さない。
- 代替手段・検証: 以下の実効コマンド・根拠を用い、[検証記録](verification.md) で成功・未検証を区別する。共通方針の完了条件やユーザーの明示指示は弱めない。

## AGENTS.mdから移した知見

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

## TypeScript 7 の併用構成（2026-09-23）

- TypeScript 7.0 は API を含まず typescript-eslint が未対応のため、`typescript` は `npm:@typescript/typescript6@^6.0.2` へエイリアスし、TS7 の `tsc` は `@typescript/native`（`npm:typescript@^7.0.2`）で併用する。公式手順は TypeScript 7.0 の発表記事「Running Side-by-Side with TypeScript 6.0」による。
- この構成では `tsc` が 7.x、`tsc6` が 6.x を提供し、lint は `typescript` パッケージ経由の 6 系 API で動作する。TypeScript 7.1 で新 API が提供されたら typescript-eslint の対応状況を確認して構成を再評価する。
- 手動で push した Dependabot PR は自動化の classify が対象外（「PR is not from Dependabot」）となるため、CI 全成功を確認して手動でマージする。

## 系列別の依存修復（2026-10-05）

- 全majorへの一律overrideを避け、親パッケージの要求系列に合う修正版をversion-scoped overrideで選ぶ。lockfileの実効版、固定インストール、全重大度監査と製品チェックを確認する。
- version-scoped overrideはBun 1.4.2で形式3のlockfileへ解決し、CI・Releaseでも同じ版を使う。Bun 1.3.8では更新したbrace-expansionの実効版が残る場合があった。node-forgeの未修正highはweb-extのAndroid経路であり、監査除外や機能削除で成功扱いにしない。詳細は `verification.md`。

## 未公開修正の依存パッチ（2026-10-11）

- `node-forge@1.4.0` の GHSA-86w9-cpqp-85rv は npm に修正版がない。上流PR digitalbazaar/forge#1152 の入れ子の DigestAlgorithm 要素数検証を `patches/node-forge@1.4.0.patch` に適用する。`test/node-forge-patch.test.mjs` は正常形と余分な要素を含む形を検証する。
- Bun の素の監査はパッチを認識せず当該バージョンを報告するため、CI は `bun run audit` で監査結果の全件を確認する。この1件だけはパッチ設定と回帰テスト成功を確認し、他の検出は失敗させる。上流修正版が公開されたらパッチと例外を取り除いて素の監査に戻す。根拠と手順は `verification.md` と `how-to-update.md`。

## READMEなどから移した開発・運用情報

## 依存更新の自動処理

Dependabot は対象の依存関係を毎週確認します。patch／minor 更新は PR のチェック（CI）が成功した後に自動で squash merge されます。CI の失敗ジョブは 1 回だけ再実行します。再失敗時は読み取り権限のジョブで `bun.lock` を再生成し、限定した修正コミットで CI を再実行します。自動修復できない PR は手動で原因を確認します。major 更新も手動で確認します。

## 文書の役割

- [README.md](README.md): 利用開始と操作、利用者が知る必要のある制限。
- この文書: 固有の配置・ツール・実行手段・例外・再利用する調査知見。
- [verification.md](verification.md): 検証手順、実測結果、証拠、未検証事項。
- [how-to-update.md](how-to-update.md): 更新と復旧の手順。
