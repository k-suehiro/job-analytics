# AI工数アナライザー

**Version 1.1.0**

工数データ（TSV/CSV）をアップロードし、拠点・スタッフ別 / 作業種別 / 月別に集計する Web アプリです。  
オプションで LLM による PM 向け総括・インサイトを生成できます。

**社内オンプレミス Web サーバー**に `index.html` を配置して利用する、単一 HTML ファイル構成です。  
ビルドやサーバーサイド処理は不要です。

## 主な機能

- **ファイル取り込み** — TXT / TSV / CSV（Shift_JIS・UTF-8 自動判定）
- **集計表示** — 3 タブで切り替え
  - 拠点・スタッフ別
  - 作業種別
  - 月別
- **詳細モーダル** — 集計行をクリックすると明細一覧を表示（列ヘッダークリックでソート）
- **AI 分析（任意）** — 集計サマリーを LLM に渡し、総括コメントを生成
- **AI プロバイダ切替（⚙）** — GB10 / Gemini / LM Studio を比較可能

## リポジトリ構成

```
job-analytics/
├── index.html        # UI・集計ロジック・AI 呼び出し（これだけ配置すれば動作）
└── README.md
```

## 前提条件

- 社内 Web サーバー（IIS / nginx / Apache 等）
- 利用 PC が Web サーバーおよび AI API に到達できること
- AI 分析を使う場合
  - **GB10（本番想定）**: 閉域網内の OpenAI 互換 API（例: `http://172.16.4.223:3000/...`）
  - **Gemini**: インターネット経由で Google AI API に到達可能であること
  - **LM Studio**: 利用 PC 上で LM Studio サーバーが起動していること

## セットアップ

### 1. ファイルの配置

```bash
git clone https://github.com/k-suehiro/job-analytics.git
```

`index.html` を Web サーバーの公開ディレクトリにコピーします。

| サーバー | 配置例 |
|---------|--------|
| IIS | `C:\inetpub\wwwroot\job-analytics\index.html` |
| nginx | `/var/www/html/job-analytics/index.html` |

### 2. HTTP で配信すること（GB10 利用時）

GB10 は閉域網内の **HTTP** API であることが多いため、**この HTML も HTTP で配信**することを推奨します。

- ✅ `http://intranet.example.local/job-analytics/` → GB10 `http://172.16.x.x:3000/...` に接続可
- ❌ `https://intranet.example.local/...` → GB10 が HTTP の場合 **Mixed Content** でブロック

HTTPS で HTML を配信する場合は、GB10 側も HTTPS 対応が必要です。

### 3. 動作確認

1. ブラウザで `http://<社内サーバー>/job-analytics/` にアクセス
2. 工数 TSV をアップロードして **集計する** をクリック
3. ⚙ 設定で GB10 の API URL / モデル / API Key を確認し、**AI分析** を実行

### IIS の最小設定例

1. IIS マネージャーでサイトまたは仮想ディレクトリを作成
2. `index.html` を配置
3. 必要に応じて MIME タイプ `.html` → `text/html` を確認（通常はデフォルト）

### nginx の最小設定例

```nginx
server {
    listen 80;
    server_name intranet.example.local;

    location /job-analytics/ {
        alias /var/www/html/job-analytics/;
        index index.html;
    }
}
```

## 使い方

### 基本フロー

1. 工数ファイル（TSV/CSV）を選択
2. **集計する** をクリック → 集計結果が即時表示
3. （任意）**AI分析も実行する** にチェックを入れて集計 → 集計と AI 分析を連続実行  
   または、集計のみ実行後に **「ファイル名」を分析する** ボタンで AI 分析のみ実行

### AI 設定（⚙ アイコン）

ヘッダー右の歯車から設定モーダルを開きます。設定はブラウザの `localStorage` に保存されます。

| プロバイダ | 用途 | 主な設定 |
|-----------|------|----------|
| GB10（社内） | 本番想定 | API URL / モデル / API Key |
| Gemini | 比較・検証 | API Key / モデル名（インターネット接続が必要） |
| LM Studio | ローカル比較 | API URL / モデル名（`localhost`、利用 PC 上のみ） |

**最大出力トークン数** を小さくすると、AI 分析は一般に高速化しやすくなります。

## 入力データ形式

タブ区切り（TSV）を想定しています。8 列以上必要です。

| 列番号 | 内容 | 備考 |
|--------|------|------|
| 0 | 作業日 | `2024-12-19` 形式など |
| 1 | 拠点 | |
| 3 | スタッフ | |
| 4 | 作業種別 | |
| 7 | 作業時間（h） | 数値 |

- 文字コード: UTF-8 / Shift_JIS（CP932）を自動判定
- 日付列は先頭列を優先して認識（見つからない場合は他列も探索）
- `#` で始まる行はコメントとしてスキップ

## AI 分析について

- LLM には **明細行ではなく集計サマリー** のみ送信します
  - スタッフ別: 上位 20 件
  - 作業種別: 上位 15 件
  - 月別: 全件
- 分析結果は Markdown 風テキストを HTML に変換して表示します

## 開発メモ

### 更新の反映

`index.html` を Web サーバー上のファイルと差し替えるだけです。  
利用者にはブラウザのハードリロード（`Ctrl+Shift+R`）を案内してください。

### 外部 CDN

`index.html` は以下を CDN から読み込みます（インターネット接続が必要）。

- Tailwind CSS
- marked.js（Markdown → HTML）

閉域網で CDN に到達できない場合は、Tailwind / marked を社内 CDN またはローカルにホストし、`index.html` の `<script>` / `<link>` URL を差し替えてください。

## トラブルシューティング

| 症状 | 確認ポイント |
|------|-------------|
| ボタンが動かない / `xxx is not defined` | ブラウザをハードリロード。サーバー上の `index.html` が最新か確認 |
| 文字化け | 元ファイルの文字コード。Shift_JIS / UTF-8 以外の場合は要調整 |
| 月別が空 | 日付列の形式・位置（先頭列に `YYYY-MM-DD` があるか） |
| GB10 で Mixed Content エラー | HTML が HTTPS、GB10 が HTTP の組み合わせ。**HTML を HTTP で配信**するか GB10 を HTTPS 化 |
| GB10 に接続できない | API URL・ネットワーク（同一閉域網から到達可能か）、CORS 設定 |
| AI 分析が遅い | モデルサイズ・サーバー負荷・出力トークン数。GB10 は 35B 級モデルのため数十秒〜数分かかることもある |
| Gemini / LM Studio で失敗 | API Key、ネットワーク。Gemini のモデル名は `gemini-2.5-flash-lite` など現行 ID を指定（`models/` プレフィックス不要） |
| 画面が崩れる | Tailwind CDN に到達できていない。社内プロキシまたは CDN のローカルホスト化を検討 |

## バージョン履歴

### v1.1.0

- GAS 配信を廃止し、社内オンプレ Web サーバーへの静的配置構成に変更
- GB10（閉域網 HTTP API）をデフォルト AI プロバイダとして利用可能に

### v1.0.0

- 工数 TSV/CSV の取り込み（UTF-8 / Shift_JIS 自動判定）
- 拠点・スタッフ別 / 作業種別 / 月別の 3 タブ集計
- 集計行クリックによる詳細モーダル（ソート対応）
- 任意の LLM による PM 向け総括（GB10 / Gemini / LM Studio 切替）

## ライセンス

社内利用を想定したプロジェクトです。利用ポリシーは組織の規定に従ってください。
