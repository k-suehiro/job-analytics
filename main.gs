/**
 * Webアプリとして公開するエントリポイント。
 * デプロイ: 拡張機能 → Webアプリ → 種類「ウェブアプリ」→ デプロイ
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('AI工数アナライザー')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
