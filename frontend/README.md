# DJ Event Streaming System Frontend

DJイベント配信システムのフロントエンドアプリケーションです。
ライブストリーミング視聴とタイムテーブル表示機能を提供します。

## 機能

- **ライブ配信視聴**: HLS形式でのストリーミング視聴
- **配信状態表示**: 現在のDJと次のDJの情報をリアルタイム表示
- **タイムテーブル**: 設定されたイベント期間の予約作成、取消、空き枠表示
- **進行状況表示**: 進行中セッションと現在位置のハイライト
- **レスポンシブデザイン**: モバイル・タブレット・デスクトップ対応

## 技術スタック

- React 19
- TypeScript
- Vite 7
- React Router 7
- HLS.js
- Axios
- Temporal Polyfill

## セットアップ

Node.js 20.19以上または22.12以上を使用します。

1. 依存関係をインストールします。

```bash
npm ci
```

2. 必要に応じて`.env.local`を作成します。

```bash
# frontend/.env.local
VITE_API_BASE_URL=http://localhost/api/v1
VITE_HLS_ENDPOINT=http://localhost/hls/stream-endpoint/index.m3u8
```

この設定は、リポジトリ直下のCompose環境をAPIとHLSの接続先として使います。

3. 開発サーバーを起動します。

```bash
npm run dev
```

## ビルド

```bash
npm run build
npm run lint
```

## 環境変数

- `VITE_API_BASE_URL`: バックエンドAPIの基底URL（未指定時は`http://localhost:18080/api/v1`）
- `VITE_HLS_ENDPOINT`: HLSプレイリストURL（未指定時は`http://localhost:8888/hls/stream`）

## ページ構成

- `/`: ライブ配信視聴ページ
- `/timetable`: タイムテーブルページ

## Composeを使用した実行

リポジトリ直下で全サービスを起動します。

```bash
cp .env.example .env
docker compose up -d --build
```

フロントエンドは`http://localhost/`、タイムテーブルは`http://localhost/timetable`で開けます。

停止するときもリポジトリ直下で実行します。

```bash
docker compose down
```

## Nginx設定

- React Routerに対応したSPA設定
- Gzip圧縮
- 静的アセットのキャッシュ設定
- APIとHLSのプロキシは、リポジトリ直下のNginxが処理
