1. `package.json` のバージョンを上げる
2. `CHANGELOG.md` に対象バージョンの変更点を追加する
3. `bun run build`でpackage.jsonとmanifest.jsonのバージョン表記を同期
3. `git tag vX.X.X`
4. `git push Ununique main vX.X.X` で GitHub Actions が自動で Firefox AMO 署名とリリース作成を行う
  
---  
  
間違えたときはローカルとリモートのタグを消して、新しい HEAD でタグを付け直してリリースする  
