# DJ Event Streaming System Frontend

DJイベント配信システムのフロントエンドアプリケーション。ライブストリーミング視聴とタイムテーブル表示機能を提供します。

## 機能

- **ライブ配信視聴**: HLS形式でのストリーミング視聴
- **配信状態表示**: 現在のDJと次のDJの情報をリアルタイム表示
- **タイムテーブル**: 今日と明日の予約一覧表示
- **レスポンシブデザイン**: モバイル・タブレット・デスクトップ対応

## 技術スタック

- React 18 + TypeScript
- Vite
- React Router
- HLS.js
- Axios
- date-fns

## セットアップ

1. 依存関係のインストール
```bash
npm install
```

2. 環境変数の設定
```bash
cp .env.example .env
# 必要に応じて.envファイルを編集
```

3. 開発サーバーの起動
```bash
npm run dev
```

## ビルド

```bash
npm run build
```

## 環境変数

- `VITE_API_BASE_URL`: バックエンドAPIのベースURL（デフォルト: http://localhost:18080/api/v1）

## ページ構成

- `/`: ライブ配信視聴ページ
- `/timetable`: タイムテーブルページ

## Dockerを使用したデプロイ

### ビルド

```bash
make build
# または
docker build -t dj-event-frontend .
```

### 実行（バックエンドと連携）

```bash
make run
# または
docker-compose up -d
```

### 実行（スタンドアロン）

```bash
make run-standalone
# または
docker-compose -f docker-compose.standalone.yml up -d
```

### アクセス

- フロントエンド: http://localhost:3000

### 停止

```bash
make stop
# または
docker-compose down
```

## Nginx設定

- React Routerに対応したSPA設定
- Gzip圧縮
- 静的アセットのキャッシュ設定
- バックエンドAPIへのプロキシ設定
- HLSストリームへのプロキシ設定
