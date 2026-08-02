# AMO掲載メタデータ

`metadata.json` は Firefox Add-ons (AMO) の submission API / `web-ext sign --amo-metadata` に渡す掲載情報です。`name`、`summary`、`description`、更新ノートを拡張機能の対応ロケールに合わせて用意し、`default_locale` は AMO のロケール名である `en-US` にしています。拡張機能側の `en`、`es`、`pt_BR`、`zh_CN` は、それぞれ AMO の `en-US`、`es-ES`、`pt-BR`、`zh-CN` へ変換します。

2026-08-02 に Mozilla の公式ソースを確認した結果、AMO の本番フロントエンドで有効なロケールは `cs`、`de`、`dsb`、`el`、`en-CA`、`en-GB`、`en-US`、`es-AR`、`es-CL`、`es-ES`、`es-MX`、`fi`、`fr`、`fur`、`fy-NL`、`he`、`hr`、`hsb`、`hu`、`ia`、`it`、`ja`、`ka`、`kab`、`ko`、`nb-NO`、`nl`、`nn-NO`、`pl`、`pt-BR`、`pt-PT`、`ro`、`ru`、`sk`、`sl`、`sq`、`sr`、`sv-SE`、`tr`、`uk`、`vi`、`zh-CN`、`zh-TW` です。AMO サーバーの言語一覧はこれより広く、`ar`、`bn`、`hi`、`id`、`ur` も掲載用翻訳として表現できるため、今回のメタデータでは拡張機能が実際に提供する15言語を掲載します。AMO側で未有効の言語が受理されない場合は、その言語だけを削除して再送します。

参照した公式ソース:

- AMO本番フロントエンドの `langs`: <https://raw.githubusercontent.com/mozilla/addons-frontend/master/config/default.js>
- AMOサーバーの `PROD_LANGUAGES` / `AMO_LANGUAGES`: <https://raw.githubusercontent.com/mozilla/addons-server/master/src/olympia/core/languages.py>
- AMO v5 Add-ons API: <https://mozilla.github.io/addons-server/topics/api/addons>
- AMO掲載の `web-ext` 手順: <https://extensionworkshop.com/documentation/develop/web-ext-command-reference/>

リリース workflow は `web-ext sign --channel listed --amo-metadata amo/metadata.json` を使用します。初回掲載では AMO API credentials と、Mozilla Account で所有者になっているアドオンIDが必要です。レビュー待ち・却下・認証不足はローカルで成功扱いにせず、workflow の結果を確認します。
