# DJ Event Streaming System

DJイベント配信システム - ライブストリーミングとタイムテーブル管理のための全機能Webアプリケーション。

## 機能

- **ライブストリーミング**: RTMP経由でのライブストリーム受信とHLS配信
- **Webインターフェース**: リアルタイムでのストリーム視聴とタイムテーブル管理
- **タイムテーブル管理**: 予約の作成・削除・閲覧（15分単位、最大1時間枠）
- **自動ステータス表示**: 現在のDJ名とスケジュールの自動更新
- **パスコード認証**: 4桁パスコードによる予約削除保護

## アーキテクチャ

- **フロントエンド**: React 19 + TypeScript + Vite
- **バックエンド**: Go 1.24 + Echo Framework
- **ストリーミング**: MediaMTX (RTMP → HLS変換)
- **データベース**: PostgreSQL 17
- **リバースプロキシ**: Nginx
- **API**: OpenAPI 3.0によるスキーマファースト開発
- **コンテナ化**: Docker + Docker Compose

## クイックスタート

### Docker Composeを使用した起動（推奨）

```bash
# リポジトリのクローン
git clone <repository-url>
cd stream-system-backend

# Docker Composeで全サービス起動
docker compose up -d

# ログの確認
docker compose logs -f
```

### アクセス情報

- **Webアプリケーション**: http://localhost
- **RTMP配信URL**: rtmp://localhost:19350/stream-endpoint
  - ユーザー名: `mediamtx-streaming-usr`
  - パスワード: `mediamtx-streaming-passwd`
- **HLS視聴URL**: http://localhost/hls/stream-endpoint/index.m3u8

## サービス構成

- **nginx**: リバースプロキシ（ポート80）
- **frontend**: React Webアプリケーション
- **backend**: Go API サーバー
- **mediamtx**: RTMPストリーミングサーバー（ポート19350）
- **postgres**: データベース

## ローカル開発

### フロントエンド開発

```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

### バックエンド開発

```bash
cd backend
go mod download

# APIコードの生成
make generate-api

# ローカル実行（PostgreSQLが必要）
make run
```

### 必要なソフトウェア

- Docker & Docker Compose（推奨）
- または個別実行の場合：
  - Node.js 18以上（フロントエンド）
  - Go 1.24以上（バックエンド）
  - PostgreSQL 17（データベース）

## API仕様

APIの詳細仕様は `api/openapi.yaml` を参照してください。

### 主要エンドポイント

- `GET /api/v1/stream/status` - 配信状態とスケジュール情報
- `GET /api/v1/reservations` - 予約一覧の取得
- `POST /api/v1/reservations` - 新規予約の作成
- `DELETE /api/v1/reservations/{id}` - 予約の削除（パスコード認証）
- `GET /api/v1/available-slots` - 指定時間範囲内の利用可能時間枠

## 配信設定

### RTMP配信設定

- **サーバー**: `rtmp://localhost:19350/stream-endpoint`
- **認証**:
  - ユーザー名: `mediamtx-streaming-usr`
  - パスワード: `mediamtx-streaming-passwd`

### OBS Studio設定例

1. **設定** → **配信**
2. **サービス**: カスタム
3. **サーバー**: `rtmp://localhost:19350/stream-endpoint`
4. **ストリームキー**: `mediamtx-streaming-usr:mediamtx-streaming-passwd`

または認証情報をサーバーURLに含める場合：
- **サーバー**: `rtmp://mediamtx-streaming-usr:mediamtx-streaming-passwd@localhost:19350/stream-endpoint`
- **ストリームキー**: （空欄）

## テスト動作確認

### APIテストコマンド例

```bash
# ヘルスチェック
curl http://localhost/health

# ストリーム状態確認
curl http://localhost/api/v1/stream/status | jq .

# 予約一覧取得
curl http://localhost/api/v1/reservations | jq .

# 予約作成（絵文字対応）
curl -X POST http://localhost/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "djName": "DJ テスト 🎵",
    "startTime": "'$(date -u -d "+1 hour" +%Y-%m-%dT%H:00:00Z)'",
    "endTime": "'$(date -u -d "+2 hours" +%Y-%m-%dT%H:00:00Z)'",
    "passcode": "1234"
  }' | jq .

# 利用可能時間枠確認（72時間以内）
curl "http://localhost/api/v1/available-slots?startTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)&endTime=$(date -u -d "+24 hours" +%Y-%m-%dT%H:%M:%SZ)" | jq .

# 予約削除
curl -X DELETE http://localhost/api/v1/reservations/{reservation-id} \
  -H "Content-Type: application/json" \
  -d '{"passcode": "1234"}'
```

### 配信テスト

```bash
# FFmpegでテスト配信（テスト用動画ファイルが必要）
ffmpeg -re -i test_video.mp4 -c:v libx264 -c:a aac \
  -f flv rtmp://mediamtx-streaming-usr:mediamtx-streaming-passwd@localhost:19350/stream-endpoint

# ブラウザで視聴テスト
open http://localhost/hls/stream-endpoint/index.m3u8
```

## プロジェクト構造

```
stream-system-backend/
├── api/                    # OpenAPI仕様
│   └── openapi.yaml       # API定義
├── backend/               # Goバックエンド
│   ├── cmd/server/        # メインアプリケーション
│   ├── internal/          # 内部パッケージ
│   │   ├── api/          # APIハンドラー・生成コード
│   │   ├── config/       # 設定管理
│   │   └── db/           # データベース層
│   ├── db/               # データベーススキーマ
│   └── Makefile          # ビルドタスク
├── frontend/             # React Webアプリ
│   ├── src/
│   │   ├── components/   # UIコンポーネント
│   │   ├── pages/        # ページコンポーネント
│   │   ├── api/          # APIクライアント
│   │   ├── hooks/        # Reactフック
│   │   └── types/        # TypeScript型定義
│   └── package.json
├── mediamtx/             # ストリーミングサーバー設定
├── nginx/                # リバースプロキシ設定
├── compose.yml           # Docker Compose設定
└── media/               # 生成されるメディアファイル
```

### 開発コマンド

#### バックエンド（Go）
```bash
cd backend

# 依存関係のインストール
go mod download

# APIコード再生成
make generate-api

# ビルド
make build

# ローカル実行
make run
```

#### フロントエンド（React）
```bash
cd frontend

# 依存関係のインストール  
npm install

# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# リント実行
npm run lint
```

## トラブルシューティング

### ポート競合

デフォルトポート使用状況：
- **HTTP（Nginx）**: 80
- **RTMP（MediaMTX）**: 19350  

ポートが使用中の場合、`compose.yml`の`ports`セクションを編集してください。

### コンテナ起動失敗

```bash
# 既存コンテナとボリュームの削除
docker compose down -v

# イメージの再ビルド
docker compose build --no-cache

# 再起動
docker compose up -d
```

## ライセンス

このプロジェクトはプライベートプロジェクトです。
