/**
 * Webアプリとして公開するエントリポイント。
 * デプロイ: 拡張機能 → Webアプリ → 種類「ウェブアプリ」→ デプロイ
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('AI工数アナライザー')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * HTTPS ページから HTTP の OpenAI 互換 API へ接続するためのサーバー側プロキシ。
 * ブラウザの Mixed Content 制限を回避します（GAS サーバーから API へリクエスト）。
 */
function proxyOpenAiChat(url, model, apiKey, prompt, maxTokens) {
  var apiUrl = String(url || '').trim().replace(/\/+$/, '');
  if (!/\/chat\/completions$/i.test(apiUrl)) apiUrl += '/chat/completions';

  var headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

  var response = UrlFetchApp.fetch(apiUrl, {
    method: 'post',
    headers: headers,
    payload: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: maxTokens
    }),
    muteHttpExceptions: true
  });

  var status = response.getResponseCode();
  var body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('HTTP ' + status + ' ' + body.slice(0, 300));
  }

  var data = JSON.parse(body);
  var choice = data.choices && data.choices[0];
  return (choice && choice.message && choice.message.content) || '';
}
