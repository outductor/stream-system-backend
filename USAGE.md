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
PRODUCTION_DOMAIN=https://your-event.com  # あなたのドメイン
DB_PASSWORD=your-secure-password          # 強固なパスワード
RTMP_STREAM_KEY=your-secure-key          # セキュアなストリームキー

# イベント期間（東京時間）
EVENT_START_TIME=2025-08-29 00:00:00
EVENT_END_TIME=2025-08-31 23:59:59
EVENT_TIMEZONE=Asia/Tokyo
```

### 2. システムの起動

#### 公式イメージを使用する場合（推奨）

```bash
# 本番用構成で起動
docker compose -f compose.production.yaml up -d

# 起動状態の確認
docker compose -f compose.production.yaml ps

# ログの確認
docker compose -f compose.production.yaml logs -f
```

#### ローカルビルドを使用する場合

```bash
# 環境変数を読み込んでビルド
docker compose build

# 起動
docker compose up -d
```

### 3. 動作確認

```bash
# ヘルスチェック
curl http://your-domain.com/health

# API動作確認
curl http://your-domain.com/api/v1/stream/status
```

## OBS Studioでの配信設定

### 配信設定手順

1. OBS Studioを起動
2. **設定** → **配信** を開く
3. 以下の設定を入力：

   - **サービス**: カスタム
   - **サーバー**: `rtmp://your-domain.com:19350/`
   - **ストリームキー**: `stream-endpoint`

4. **OK** をクリックして設定を保存
5. **配信開始** ボタンで配信を開始

**重要**: 
- サーバーURLの最後に必ず `/` を付けてください
- ポート番号は19350を使用（Docker Composeで19350→1935にマッピング）

### 配信の確認

1. Webブラウザで `https://your-domain.com/` にアクセス
2. ライブ配信が表示されることを確認

## 予約管理

### タイムテーブルの使い方

1. `https://your-domain.com/` にアクセス
2. 「タイムテーブル」タブをクリック
3. 予約の追加：
   - 「予約を追加」ボタンをクリック
   - DJ名、日時、パスコード（4桁）を入力
   - 15分単位、最大1時間の枠で予約可能

4. 予約の削除：
   - 予約の「予約取消」ボタンをクリック
   - 登録時のパスコードを入力

### 予約ルール

- **時間単位**: 15分刻み（00, 15, 30, 45分）
- **最大時間**: 1時間まで
- **重複禁止**: 既に予約がある時間帯は選択不可
- **72時間制限**: 現在から72時間以内のみ予約可能
- **イベント期間内のみ**: EVENT_START_TIME〜EVENT_END_TIME内のみ予約可能

## システム管理

### 基本的な運用コマンド

```bash
# システム状態の確認
docker compose -f compose.production.yaml ps

# ログの確認（全サービス）
docker compose -f compose.production.yaml logs -f

# 特定サービスのログ確認
docker compose -f compose.production.yaml logs -f backend
docker compose -f compose.production.yaml logs -f mediamtx

# システムの再起動
docker compose -f compose.production.yaml restart

# システムの停止
docker compose -f compose.production.yaml stop

# システムの完全停止
docker compose -f compose.production.yaml down
```

### バックアップ

```bash
# データベースのバックアップ
docker compose -f compose.production.yaml exec postgres pg_dump -U postgres stream_system > backup_$(date +%Y%m%d).sql

# バックアップのリストア（注意：既存データが上書きされます）
docker compose -f compose.production.yaml exec -T postgres psql -U postgres stream_system < backup_20250824.sql
```

## トラブルシューティング

### 配信が映らない

1. OBSの配信設定を確認
   - サーバーURL: `rtmp://your-domain.com:19350/`
   - ストリームキー: `stream-endpoint`

2. MediaMTXのログを確認
   ```bash
   docker compose -f compose.production.yaml logs mediamtx
   ```

3. ファイアウォールの確認
   - ポート19350（RTMP）が開放されているか確認
   - ポート80/443（HTTP/HTTPS）が開放されているか確認

### Webページにアクセスできない

1. サービスの起動状態を確認
   ```bash
   docker compose -f compose.production.yaml ps
   ```

2. Nginxのログを確認
   ```bash
   docker compose -f compose.production.yaml logs nginx
   ```

3. DNSの設定を確認
   - ドメインが正しくサーバーのIPを指しているか

### 予約が作成できない

1. イベント期間を確認
   ```bash
   docker compose -f compose.production.yaml logs backend | grep EVENT
   ```

2. データベースの状態を確認
   ```bash
   docker compose -f compose.production.yaml exec postgres psql -U postgres -d stream_system -c "SELECT COUNT(*) FROM reservations;"
   ```

## セキュリティ推奨事項

### 本番環境のチェックリスト

- [ ] **強固なパスワード**: DB_PASSWORDに複雑なパスワードを設定
- [ ] **HTTPS化**: Let's Encrypt等でSSL証明書を設定
- [ ] **ファイアウォール**: 必要なポートのみ開放（80, 443, 19350）
- [ ] **定期バックアップ**: cronでデータベースを定期バックアップ
- [ ] **ログ監視**: 異常なアクセスパターンの監視
- [ ] **アップデート**: Dockerイメージの定期的な更新

### HTTPS設定（Let's Encrypt使用例）

```bash
# Certbotのインストールと証明書取得
sudo apt-get update
sudo apt-get install certbot
sudo certbot certonly --standalone -d your-domain.com

# nginx設定の更新（nginx/nginx.conf）
# SSL設定を追加してHTTPSを有効化
```

## メンテナンス

### システムの更新

```bash
# 最新版の取得
git pull origin main

# イメージの更新（公式イメージ使用時）
docker compose -f compose.production.yaml pull

# 再起動
docker compose -f compose.production.yaml up -d
```

### ログのローテーション

```bash
# Dockerログの設定（/etc/docker/daemon.json）
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "10"
  }
}
```

## サポート

問題が解決しない場合は、以下の情報を添えてGitHubのIssuesで報告してください：

```bash
# システム情報の収集
docker compose -f compose.production.yaml version
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml logs --tail 100 > system-logs.txt
```

環境変数（パスワード等は除く）と`system-logs.txt`を添付してください。