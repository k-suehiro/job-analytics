/**
 * Webアプリとして公開するエントリポイント。
 * デプロイ: 拡張機能 → Webアプリ → 種類「ウェブアプリ」→ デプロイ
 * @version 2.1.3
 */

var SHARED_AI_SETTINGS_KEY = 'SHARED_AI_SETTINGS';
var AI_SETTINGS_ADMIN_EMAILS_KEY = 'AI_SETTINGS_ADMIN_EMAILS';
var AI_SETTINGS_ADMIN_ACCESS_KEY = 'AI_SETTINGS_ADMIN_ACCESS_KEY';

function getViewerEmail() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (email) return String(email).trim();
  } catch (e) { /* fall through */ }
  return '';
}

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

function ensureAdminAccessKeyExists() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty(AI_SETTINGS_ADMIN_ACCESS_KEY)) {
    props.setProperty(AI_SETTINGS_ADMIN_ACCESS_KEY, Utilities.getUuid());
  }
}

function isAdminAccessKeyValid(accessKey) {
  if (!accessKey) return false;
  ensureAdminAccessKeyExists();
  var stored = PropertiesService.getScriptProperties().getProperty(AI_SETTINGS_ADMIN_ACCESS_KEY);
  return !!stored && String(accessKey) === String(stored);
}

function isAiSettingsAdminByEmail() {
  var email = getViewerEmail().toLowerCase();
  if (!email) return false;
  return getAiSettingsAdminEmails().some(function(adminEmail) {
    return String(adminEmail || '').toLowerCase() === email;
  });
}

function isAiSettingsAdmin(accessKey) {
  return isAiSettingsAdminByEmail() || isAdminAccessKeyValid(accessKey);
}

/** クライアント初期化用: 設定ボタン表示可否 */
function checkAiSettingsAdmin(accessKey) {
  return {
    isAdmin: isAiSettingsAdmin(accessKey),
    email: getViewerEmail(),
    viaAccessKey: !isAiSettingsAdminByEmail() && isAdminAccessKeyValid(accessKey)
  };
}

function buildGasClientInit(accessKey) {
  ensureAdminAccessKeyExists();
  return {
    isGas: true,
    isAdmin: isAiSettingsAdmin(accessKey),
    sharedSettings: getSharedAiSettings()
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
function saveSharedAiSettings(settingsJson, accessKey) {
  if (!isAiSettingsAdmin(accessKey)) {
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

/** GAS エディタから実行: 自分のメールを管理者に登録 */
function registerAiSettingsAdminEmails() {
  var email = Session.getEffectiveUser().getEmail();
  if (!email) throw new Error('メールを取得できません');
  PropertiesService.getScriptProperties().setProperty(
    AI_SETTINGS_ADMIN_EMAILS_KEY,
    JSON.stringify([email])
  );
  Logger.log('AI設定管理者に登録しました: ' + email);
  return email;
}

/** GAS エディタから実行: 設定ボタン付きURLをログに出力 */
function logAiSettingsAdminAccessUrl() {
  ensureAdminAccessKeyExists();
  var url = getAiSettingsAdminAccessUrl();
  Logger.log('AI設定用URL（ブックマークしてください）:\n' + url);
  return url;
}

function getAiSettingsAdminAccessUrl() {
  ensureAdminAccessKeyExists();
  var url = ScriptApp.getService().getUrl();
  var key = PropertiesService.getScriptProperties().getProperty(AI_SETTINGS_ADMIN_ACCESS_KEY);
  var sep = url.indexOf('?') >= 0 ? '&' : '?';
  return url + sep + 'ak=' + encodeURIComponent(key);
}

function doGet(e) {
  var accessKey = e && e.parameter ? String(e.parameter.ak || '') : '';
  var template = HtmlService.createTemplateFromFile('index');
  template.gasInitJson = JSON.stringify(buildGasClientInit(accessKey));
  return template.evaluate()
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
