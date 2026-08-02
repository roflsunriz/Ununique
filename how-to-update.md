1. `package.json` のバージョンを上げる。
2. `CHANGELOG.md` に対象バージョンの変更点を追加する。
3. `bun install --frozen-lockfile`、`bun run validate-amo`、`bun run validate-locales`、`bun run test`、`bun run lint`、`bun run type-check`、`bun run build`、`bun run web-ext:lint`、`bun audit` を実行する。
4. `bun run package` でXPIを作成し、必要なら `bun run e2e:firefox` を専用プロファイルで実行する。
5. `git tag vX.X.X` を作成し、`git push Ununique main vX.X.X` でGitHub Actionsを起動する。リリースworkflowは `amo/metadata.json` を使ってAMOへ `listed` チャンネルで提出する。
6. GitHub ActionsのAMO検証・レビュー・署名済みXPI・GitHub Releaseを確認する。認証不足やレビュー待ちは、提出完了とは扱わない。

タグやバージョンを間違えた場合は、公開前であることを確認してから、影響範囲を確認したうえで修正する。既にAMOへ提出したバージョンの差し替えは、AMOのレビュー状態を確認してから行う。
