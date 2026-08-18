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
- **バックエンド**: Go + Chi v5
- **ストリーミング**: MediaMTX (RTMP → HLS変換)
- **データベース**: PostgreSQL 18
- **リバースプロキシ**: Nginx
- **API**: OpenAPI 3.0によるスキーマファースト開発
- **コンテナ化**: Docker + Docker Compose

## 開発環境のセットアップ

### 必要なソフトウェア

- Docker EngineとDocker Compose
- Node.js 20.19以上または22.12以上（フロントエンドを個別に開発する場合）
- Go 1.25.5以上（バックエンドを個別に開発する場合）
- PostgreSQL 18（データベースを個別に起動する場合）

### Docker Composeを使用した開発環境起動

```bash
# リポジトリのクローン
git clone https://github.com/outductor/stream-system-backend.git
cd stream-system-backend

# 環境変数の作成と編集
cp .env.example .env

# 開発環境の起動
docker compose up -d --build

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

Compose環境では、リポジトリ直下の`.env`に次の値を設定します。
日時は`EVENT_TIMEZONE`のローカル時刻として解釈されます。

```bash
PRODUCTION_DOMAIN=http://localhost
DB_PASSWORD=change-this-password
EVENT_START_TIME=2026-08-28 00:00:00
EVENT_END_TIME=2026-08-30 23:59:59
EVENT_TIMEZONE=Asia/Tokyo
```

`VITE_API_BASE_URL`と`VITE_HLS_ENDPOINT`はComposeビルド時に`PRODUCTION_DOMAIN`から生成されます。
バックエンドを個別に起動する場合は、`DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`、`DB_SSLMODE`、`SERVER_HOST`、`SERVER_PORT`、`LOG_LEVEL`も設定できます。

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

## API仕様

APIの詳細仕様は `api/openapi.yaml` を参照してください。

### 主要エンドポイント

- `GET /api/v1/stream/status` - 配信状態とスケジュール情報
- `GET /api/v1/reservations` - 予約一覧の取得
- `POST /api/v1/reservations` - 新規予約の作成
- `DELETE /api/v1/reservations/{reservationId}` - 予約の削除（パスコード認証）
- `GET /api/v1/available-slots` - 指定時間範囲内の利用可能時間枠
- `GET /api/v1/event-config` - イベント期間とタイムゾーンの取得
- `GET /api/v1/ws/viewer` - 視聴者数更新用WebSocket


## テスト動作確認

### APIテストコマンド例

```bash
# ヘルスチェック
curl http://localhost/health

# ストリーム状態確認
curl http://localhost/api/v1/stream/status | jq .

# 予約一覧取得
curl http://localhost/api/v1/reservations | jq .

# 予約作成（イベント期間内の未来時刻へ置き換えてください）
curl -X POST http://localhost/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "djName": "DJ テスト 🎵",
    "startTime": "2026-08-28T10:00:00+09:00",
    "endTime": "2026-08-28T11:00:00+09:00",
    "passcode": "1234"
  }' | jq .

# 利用可能時間枠確認（72時間以内）
curl "http://localhost/api/v1/available-slots?startTime=2026-08-28T00:00:00%2B09:00&endTime=2026-08-29T00:00:00%2B09:00" | jq .

# 予約削除
curl -X DELETE http://localhost/api/v1/reservations/{reservation-id} \
  -H "Content-Type: application/json" \
  -d '{"passcode": "1234"}'
```

### ローカル開発時のテスト

```bash
# ユニットテスト（バックエンド）
(cd backend && go test ./...)

# フロントエンドの型チェック、ビルド、Lint
(cd frontend && npm run build && npm run lint)
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
├── compose.yaml          # Docker Compose設定
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

ポートが使用中の場合、`compose.yaml`の`ports`セクションを編集してください。

### コンテナ起動失敗

```bash
# 既存コンテナの停止
docker compose down

# イメージの再ビルド
docker compose build --no-cache

# 再起動
docker compose up -d
```

データベースを含む永続データも破棄する場合に限り、`docker compose down -v`を使用してください。

## CI

### GitHub Actions

`.github/workflows/`には次のワークフローが定義されています。

- `pr-build-check.yaml`: プルリクエスト時のコード生成同期、Lint、型チェック、Compose統合テスト

### コード品質

```bash
# バックエンドのリント
(cd backend && golangci-lint run)

# フロントエンドのLint、型チェック、プロダクションビルド
(cd frontend && npm run lint && npm run build)
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
