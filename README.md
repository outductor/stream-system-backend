# DJ Event Streaming System Backend

DJイベント配信システムのバックエンドサーバー。RTMPストリーム受信、HLS配信、タイムテーブル管理機能を提供します。

## 機能

- **RTMP配信受信**: DJブースからのライブストリームを受信
- **HLS配信**: ブラウザで視聴可能な形式に変換して配信
- **タイムテーブル管理**: 予約の作成・削除・閲覧
- **自動タイトル切り替え**: 時間に合わせて現在のDJ名を自動表示

## 技術スタック

- **言語**: Go 1.24
- **データベース**: PostgreSQL 17
- **ストリーミング**: RTMP (joy4), HLS (FFmpeg)
- **API**: OpenAPI 3.0によるスキーマ定義とコード生成
- **Webフレームワーク**: Chi

## クイックスタート

### Dockerを使用した起動（推奨）

```bash
# リポジトリのクローン
git clone <repository-url>
cd stream-system-backend

# 環境変数ファイルの作成
cp .env.example .env

# Docker Composeで起動
docker compose up -d

# ログの確認
docker compose logs -f
```

### アクセス情報

- **API**: http://localhost:18080/api/v1
- **RTMP配信URL**: rtmp://localhost:11935/live/djevent2024  
- **HLS視聴URL**: http://localhost:18080/hls/stream.m3u8
- **PostgreSQL**: localhost:15432 (ユーザー: postgres, パスワード: postgres)

## セットアップ

### 必要なソフトウェア

- Go 1.24以上
- PostgreSQL 17
- FFmpeg
- Docker & Docker Compose (オプション)

### ローカル開発

1. 依存関係のインストール
```bash
go mod download
make deps
```

2. 環境変数の設定
```bash
cp .env.example .env
# .envファイルを編集して適切な値を設定
```

3. データベースのセットアップ
```bash
createdb stream_system
psql -U postgres -d stream_system -f db/schema.sql
```

4. APIコードの生成
```bash
make generate-api
```

5. サーバーの起動
```bash
make run
```

### Dockerを使用した起動

```bash
docker-compose up -d
```

## API仕様

APIの詳細仕様は `api/openapi.yaml` を参照してください。

### 主要エンドポイント

- `GET /api/v1/stream/status` - 配信状態の取得
- `GET /api/v1/reservations` - 予約一覧の取得
- `POST /api/v1/reservations` - 新規予約の作成
- `DELETE /api/v1/reservations/{id}` - 予約の削除
- `GET /api/v1/available-slots` - 利用可能時間枠の取得

## 配信設定

### RTMPストリーム設定

- **サーバー**: `rtmp://localhost:11935/live`
- **ストリームキー**: 環境変数 `RTMP_STREAM_KEY` で設定（デフォルト: djevent2024）

### OBS設定例

1. 設定 → 配信
2. サービス: カスタム
3. サーバー: `rtmp://localhost:11935/live`
4. ストリームキー: `djevent2024`

### HLS視聴URL

- `http://localhost:18080/hls/stream.m3u8`

## テスト動作確認

### APIテストコマンド例

```bash
# ヘルスチェック
curl http://localhost:18080/health

# ストリーム状態確認
curl http://localhost:18080/api/v1/stream/status | jq .

# 予約一覧取得
curl http://localhost:18080/api/v1/reservations | jq .

# 予約作成（絵文字対応）
curl -X POST http://localhost:18080/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "djName": "DJ テスト 🎵",
    "startTime": "'$(date -u -d "+1 hour" +%Y-%m-%dT%H:00:00Z)'",
    "endTime": "'$(date -u -d "+2 hours" +%Y-%m-%dT%H:00:00Z)'",
    "passcode": "1234"
  }' | jq .

# 利用可能時間枠確認
curl "http://localhost:18080/api/v1/available-slots?date=$(date +%Y-%m-%d)" | jq .

# 予約削除
curl -X DELETE http://localhost:18080/api/v1/reservations/{reservation-id} \
  -H "Content-Type: application/json" \
  -d '{"passcode": "1234"}'
```

## 開発

### コマンド

```bash
# ビルド
make build

# テスト実行
make test

# APIコード再生成
make generate-api

# 開発モード（ホットリロード）
make dev
```

### プロジェクト構造

```
.
├── api/              # OpenAPI定義
├── cmd/server/       # メインアプリケーション
├── internal/         # 内部パッケージ
│   ├── api/         # APIハンドラー
│   ├── config/      # 設定管理
│   ├── db/          # データベース層
│   ├── rtmp/        # RTMPサーバー
│   └── hls/         # HLS変換
├── db/              # データベーススキーマ
└── media/           # メディアファイル出力
```

## トラブルシューティング

### FFmpegが見つからない

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Alpine Linux
apk add ffmpeg
```

### ポートが使用中

デフォルトポート:
- HTTP API: 18080（Docker Compose使用時）
- RTMP: 11935（Docker Compose使用時）  
- PostgreSQL: 15432（Docker Compose使用時）

環境変数またはcompose.ymlで変更可能です。

## ライセンス

このプロジェクトはプライベートプロジェクトです。