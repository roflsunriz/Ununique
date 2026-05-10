1. package.jsonのバージョンを上げる
2. git tag vX.X.X
3. git push origin main vX.X.XでGithub Actionsが自動でFirefox AMOで署名しxpiファイルをダウンロードしリリース作成
  
---  
  
間違えたときはローカルとリモートのタグを消して新しいHEADのリリースにする  