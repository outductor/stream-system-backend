# DJ Event Streaming System

DSR配信システム - ライブストリーミングとタイムテーブル管理のための全機能Webアプリケーション。

📖 **[使用ガイド（USAGE.md）](./USAGE.md)** - 本番環境での起動方法とOBS配信設定はこちら

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
- **データベース**: PostgreSQL 18
- **リバースプロキシ**: Nginx
- **API**: OpenAPI 3.0によるスキーマファースト開発
- **コンテナ化**: Docker + Docker Compose

## 開発環境のセットアップ

### 必要なソフトウェア

- Docker & Docker Compose（推奨）
- Node.js 20以上（フロントエンド開発）
- Go 1.24以上（バックエンド開発）
- PostgreSQL 18（ローカル開発時）

### Docker Composeを使用した開発環境起動

```bash
# リポジトリのクローン
git clone <repository-url>
cd stream-system-backend

# 開発環境の起動
docker compose up -d

# ログの確認
docker compose logs -f
```

## サービス構成

- **nginx**: リバースプロキシ（ポート80）
- **frontend**: React Webアプリケーション
- **backend**: Go API サーバー
- **mediamtx**: RTMPストリーミングサーバー（ポート19350）
- **postgres**: データベース

## 環境変数

開発時に設定可能な環境変数：

```bash
# バックエンド
DB_HOST=localhost          # データベースホスト
DB_PORT=5432              # データベースポート
DB_NAME=stream_system     # データベース名
DB_USER=postgres          # データベースユーザー
DB_PASSWORD=postgres      # データベースパスワード
SERVER_PORT=8080          # APIサーバーポート
LOG_LEVEL=debug           # ログレベル
EVENT_START_TIME=2025-08-29 00:00:00  # イベント開始時刻
EVENT_END_TIME=2025-08-31 23:59:59    # イベント終了時刻
EVENT_TIMEZONE=Asia/Tokyo             # タイムゾーン

# フロントエンド（ビルド時）
VITE_API_BASE_URL=http://localhost/api/v1     # API基底URL
VITE_HLS_ENDPOINT=http://localhost/hls/stream-endpoint/index.m3u8  # HLS配信URL
```

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

### ローカル開発時のテスト

```bash
# ユニットテスト（バックエンド）
cd backend
go test ./...

# フロントエンドのテスト
cd frontend
npm test

# E2Eテスト（Docker Compose環境が必要）
docker compose up -d
./scripts/e2e-test.sh  # テストスクリプトがある場合
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

## CI/CD

### GitHub Actions

`.github/workflows/` に以下のワークフローが定義されています：

- `pr-build-check.yaml`: プルリクエスト時のビルドチェック
- `docker-publish.yaml`: Dockerイメージのビルドとプッシュ

### コード品質

```bash
# バックエンドのリント
cd backend
golangci-lint run

# フロントエンドのリント
cd frontend
npm run lint

# TypeScriptの型チェック
npm run type-check
```

## コントリビューティング

1. フィーチャーブランチを作成
2. 変更をコミット
3. プルリクエストを作成
4. レビューを受ける
5. マージ

### コミットメッセージのフォーマット

```
feat: 新機能の追加
fix: バグ修正
docs: ドキュメントのみの変更
style: コードの意味に影響しない変更
refactor: バグ修正や機能追加を含まないコード変更
test: テストの追加や修正
chore: ビルドプロセスやツールの変更
```

## ライセンス

このプロジェクトは[MIT License](./LICENSE)の下で公開されています。
