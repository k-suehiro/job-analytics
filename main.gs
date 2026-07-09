/**
 * Webアプリとして公開するエントリポイント。
 * デプロイ: 拡張機能 → Webアプリ → 種類「ウェブアプリ」→ デプロイ
 * @version 2.1.2
 */

var SHARED_AI_SETTINGS_KEY = 'SHARED_AI_SETTINGS';
var AI_SETTINGS_ADMIN_EMAILS_KEY = 'AI_SETTINGS_ADMIN_EMAILS';

function getAiSettingsAdminEmails() {
  var props = PropertiesService.getScriptProperties();
  var stored = props.getProperty(AI_SETTINGS_ADMIN_EMAILS_KEY);
  if (stored) {
    try {
      var list = JSON.parse(stored);
      if (Array.isArray(list) && list.length) return list;
    } catch (e) { /* fall through */ }
  }
  var owner = Session.getEffectiveUser().getEmail();
  return owner ? [owner] : [];
}

function isAiSettingsAdmin() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) return false;
  return getAiSettingsAdminEmails().some(function(adminEmail) {
    return String(adminEmail || '').toLowerCase() === email;
  });
}

/** クライアント初期化用: 設定ボタン表示可否 */
function checkAiSettingsAdmin() {
  return {
    isAdmin: isAiSettingsAdmin(),
    email: Session.getActiveUser().getEmail() || ''
  };
}

/** 全ユーザー共通の AI 設定を取得 */
function getSharedAiSettings() {
  var raw = PropertiesService.getScriptProperties().getProperty(SHARED_AI_SETTINGS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/** 管理者のみ: 全ユーザー共通の AI 設定を保存 */
function saveSharedAiSettings(settingsJson) {
  if (!isAiSettingsAdmin()) {
    throw new Error('AI設定の変更権限がありません');
  }
  var settings = typeof settingsJson === 'string' ? JSON.parse(settingsJson) : settingsJson;
  if (!settings || typeof settings !== 'object') {
    throw new Error('設定データが不正です');
  }
  PropertiesService.getScriptProperties().setProperty(
    SHARED_AI_SETTINGS_KEY,
    JSON.stringify(settings)
  );
  return true;
}

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
