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

1. **OpenAPI生成コードの同期チェック**
   - `api/openapi.yaml`からコードを再生成
   - 生成結果と`backend/internal/api/generated.go`を比較

2. **Lintと型チェック**
   - Backend: golangci-lint
   - Frontend: TypeScriptとESLint

3. **Compose統合テスト**
   - 全サービスの起動確認
   - ヘルスチェック
   - APIエンドポイントの基本動作確認
   - 予約作成APIのテスト
   - ジョブ終了時のサービス停止

### PR承認基準

PRでは、これらのジョブがすべて成功することを確認します。

現在、mainブランチへのpushでコンテナイメージを公開するワークフローはありません。
