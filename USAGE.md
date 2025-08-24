# 本番環境 使用ガイド - DJ Event Streaming System

本番環境での起動方法と配信設定のガイドです。

## 必要なもの

- Docker & Docker Compose
- OBS Studio（配信用）
- 80番ポートと19350番ポートが利用可能であること
- 本番用ドメイン名（推奨）

## 本番環境のセットアップ

### 1. 環境変数の設定

```bash
# リポジトリのクローン
git clone https://github.com/outductor/stream-system-backend.git
cd stream-system-backend

# 環境変数ファイルの作成
cp .env.example .env
```

`.env` ファイルを編集して本番用の値を設定：

```bash
# 必須設定
PRODUCTION_DOMAIN=https://your-event.com
DB_PASSWORD=your-secure-password

# イベント期間（東京時間）
EVENT_START_TIME=2025-08-29 00:00:00
EVENT_END_TIME=2025-08-31 23:59:59
EVENT_TIMEZONE=Asia/Tokyo
```

### 2. システムの起動

```bash
# 起動
docker compose up -d --build

# たまにnginxが502になるときは
docker compose restart nginx -d
```

### 3. 動作確認

```bash
# ヘルスチェック
curl http://your-domain.com/health

# API動作確認
curl http://your-domain.com/api/v1/stream/status
```

## OBS Studioでの配信設定

### 配信設定手順（OBSの場合）

1. OBS Studioを起動
2. **設定** → **配信** を開く
3. 以下の設定を入力（環境に合わせて適宜変えてください）：

   - **サービス**: カスタム
   - **サーバー**: `rtmp://your-domain.com:19350/`
   - **ストリームキー**: `stream-endpoint?user=mediamtx-streaming-usr&pass=mediamtx-streaming-passwd`

4. **OK** をクリックして設定を保存
5. **配信開始** ボタンで配信を開始

### 配信の確認

1. Webブラウザで `https://your-domain.com/` にアクセス
2. ライブ配信が表示されることを確認

## システム管理

### 基本的な運用コマンド

```bash
# システム状態の確認
docker compose ps

# ログの確認（全サービス）
docker compose logs -f

# 特定サービスのログ確認
docker compose logs -f backend
docker compose logs -f mediamtx

# システムの再起動
docker compose restart

# システムの停止
docker compose stop

# システムの完全停止
docker compose down
```
