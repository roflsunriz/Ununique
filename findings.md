# 調査知見

- TypeScript 7はAPIを含まずtypescript-eslintも未対応のため、`typescript` は `@typescript/typescript6`、TS7 CLIは `@typescript/native` を併用する。`tsc` は7系、`tsc6` は6系。TS 7.1とeslint対応後に再評価する。
- `bun audit fix` だけでは上流の厳密範囲により脆弱版が残る。親の要求系列ごとにversion-scoped `overrides` と `bun.lock` を同時更新する。Bun 1.4.2のlockfile形式3をCI/Releaseでも揃える。
- `node-forge` 1.4.2 は DigestInfo を正規DERとして照合する。旧1.4.0向けパッチと監査例外を撤去し、正常な署名構造と余分な要素の拒否を回帰検証する。
- `deepmerge` 4.3.1 は GHSA-gcqx-w48m-w2h4 の修正版が未公開。上流PR #274 に基づき `__proto__` の書込みを両ループで防ぐ限定パッチを適用し、パッチと全配布入口のハッシュ・攻撃回帰を毎回確認する。
- GHSA-g3hv-75wg-m249 のDBは `<11.0.1` を対象とする一方、[作者の原文](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)は10.2.6の `optimizationLevel >= 2` にある二段の展開処理を対象とする。3.1.5は `make()` でbrace展開後にパス分割と変換を各1回行い、この反復展開処理を持たない。`**/../a/b/` の反復では10.2.5が1〜5回で2・4・8・16・32候補に増え、3.1.5は128回でも1候補、部分数513と線形だった。旧APIを必要とする3.1.5はソース全体のSHA-256と再現回帰を検証し、10系だけ11.0.1へ更新する。他の版・勧告は監査失敗とする。
- Firefox E2Eは一時profileの `marionette.port` を設定し、`Addon:Install` と `WebDriver:Navigate` を使う。WebDriverのsandboxではページ側の変更を正しく観測できないため、ページ内scriptで値を取得し、現在の代表的な画面サイズと保護状態を確認する。
- Dependabot自動修復は読取り権限で `bun.lock` だけを変更し、PRコードを実行するジョブへ書込み権限や秘密を渡さない。手動push後はDependabot由来判定から外れるため、CI確認後に手動マージする。
