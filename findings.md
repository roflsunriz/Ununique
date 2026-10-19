# 調査知見

- TypeScript 7はAPIを含まずtypescript-eslintも未対応のため、`typescript` は `@typescript/typescript6`、TS7 CLIは `@typescript/native` を併用する。`tsc` は7系、`tsc6` は6系。TS 7.1とeslint対応後に再評価する。
- `bun audit fix` だけでは上流の厳密範囲により脆弱版が残る。親の要求系列ごとにversion-scoped `overrides` と `bun.lock` を同時更新する。Bun 1.4.2のlockfile形式3をCI/Releaseでも揃える。
- `node-forge@1.4.0` の未公開修正は `patches/node-forge@1.4.0.patch` と回帰テストで担保する。素の監査はパッチを認識しないため、`bun run audit` はこの1件だけを条件付き許容し、他の検出を失敗させる。上流修正版公開後は例外を削除する。
- Dependabot自動修復は読取り権限で `bun.lock` だけを変更し、PRコードを実行するジョブへ書込み権限や秘密を渡さない。手動push後はDependabot由来判定から外れるため、CI確認後に手動マージする。
