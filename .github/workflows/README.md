# GitHub Actions Workflows

## PR Build Check Workflow (`pr-build-check.yaml`)

Pull Request作成時に自動的に実行されるビルドチェックワークフローです。

### トリガー
- Pull Requestの作成、更新、再オープン時
- 以下のパスに変更がある場合のみ：
  - `backend/**`
  - `frontend/**`
  - `mediamtx/**`
  - `api/**`
  - `.github/workflows/**`

### 実行されるチェック

1. **ビルドチェック**
   - Backend、Frontend、MediaMTXのDockerイメージビルド（プッシュなし）
   - linux/amd64プラットフォームでのビルド確認

2. **バックエンドテスト**
   - Go単体テストの実行
   - OpenAPI生成コードの同期チェック

3. **Lintチェック**
   - Backend: golangci-lint
   - Frontend: TypeScriptチェック、ESLint

4. **統合テスト**
   - 全サービスの起動確認
   - ヘルスチェック
   - APIエンドポイントの基本動作確認
   - 予約作成APIのテスト

### PR承認基準
すべてのチェックが成功することがマージの必要条件です。

## Docker Build and Push Workflow (`docker-publish.yaml`)

このワークフローは、mainブランチへのプッシュ時に自動的にDockerイメージをビルドしてGitHub Container Registry (ghcr.io) にプッシュします。

### トリガー
- `main` ブランチへのプッシュ
- 手動実行（workflow_dispatch）

### ビルドされるイメージ

1. **Backend Image**
   - `ghcr.io/outductor/stream-system-backend`
   
2. **Frontend Image**
   - `ghcr.io/outductor/stream-system-frontend`
   
3. **MediaMTX Image**
   - `ghcr.io/outductor/stream-system-mediamtx`

### タグ戦略

mainブランチへのプッシュ時に以下のタグが付与されます：

- `latest` - 最新のmainブランチビルド
- `YYYYMMDD` - ビルド日付（例：20240824）
- `YYYYMMDD-HHmmss` - ビルド日時（例：20240824-143022）
- `main-{sha}` - コミットSHA付き

その他のブランチからのプッシュ時：
- `{branch}-{sha}` - ブランチ名とコミットSHA

### マルチプラットフォーム対応

すべてのイメージは以下のプラットフォーム向けにビルドされます：
- linux/amd64
- linux/arm64

### 使用方法

#### Production環境での使用

```bash
# プロダクション用compose.ymlを使用
docker compose -f compose.production.yml up -d

# 特定の日付のイメージを使用
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d
```

#### 環境変数の設定

`.env` ファイルを作成：

```env
# データベースパスワード
DB_PASSWORD=your-secure-password

# RTMPストリームキー
RTMP_STREAM_KEY=your-stream-key

# ログレベル
LOG_LEVEL=info

# イベント終了時刻
EVENT_END_TIME=2025-08-31 23:59:59
EVENT_TIMEZONE=Asia/Tokyo
```

### イメージの手動プル

```bash
# 最新版をプル
docker pull ghcr.io/outductor/stream-system-backend:latest
docker pull ghcr.io/outductor/stream-system-frontend:latest
docker pull ghcr.io/outductor/stream-system-mediamtx:latest

# 特定の日付版をプル
docker pull ghcr.io/outductor/stream-system-backend:20240824
```

### アクセス権限

パブリックリポジトリの場合、イメージは誰でもプルできます。
プライベートリポジトリの場合は、GitHubの個人アクセストークンが必要です：

```bash
# GitHub Container Registryにログイン
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

### トラブルシューティング

#### ビルドが失敗する場合

1. Dockerfileの構文エラーを確認
2. ビルドコンテキストに必要なファイルが存在するか確認
3. GitHub Actionsのログを確認

#### イメージがプルできない場合

1. イメージ名とタグが正しいか確認
2. ネットワーク接続を確認
3. 必要に応じてGitHub Container Registryにログイン

### キャッシュ戦略

GitHub Actions Cache (gha) を使用してビルド時間を短縮しています。
キャッシュは自動的に管理され、7日間保持されます。