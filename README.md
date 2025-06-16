# Package README Core MCP Server

Package README Core MCP Server は、複数のパッケージマネージャー対応MCPサーバーを統合する仲介型MCP（Model Context Protocol）サーバーです。ユーザーが問い合わせるパッケージマネージャーが不明な場合に、適切なツールを自動的に判定・呼び出しします。

## ⚠️ 重要: 必要な依存関係

このサーバーを動作させるためには、**以下の個別パッケージマネージャー対応MCPサーバーが必要**です：

### 必須MCPサーバー

以下のMCPサーバーを事前にセットアップし、ビルドしておく必要があります：

- **npm-package-readme-core-mcp-server** - Node.js/npm パッケージ対応
- **composer-package-readme-core-mcp-server** - PHP/Composer パッケージ対応  
- **pip-package-readme-core-mcp-server** - Python/pip パッケージ対応
- **cargo-package-readme-core-mcp-server** - Rust/Cargo パッケージ対応
- **maven-package-readme-core-mcp-server** - Java/Maven パッケージ対応
- **nuget-package-readme-core-mcp-server** - .NET/NuGet パッケージ対応
- **gem-package-readme-core-mcp-server** - Ruby/RubyGems パッケージ対応
- **cocoapods-package-readme-core-mcp-server** - iOS/macOS/CocoaPods パッケージ対応
- **conan-package-readme-core-mcp-server** - C/C++/Conan パッケージ対応
- **cpan-package-readme-core-mcp-server** - Perl/CPAN パッケージ対応
- **cran-package-readme-core-mcp-server** - R/CRAN パッケージ対応
- **docker-hub-readme-mcp-server** - Docker Hub パッケージ対応
- **helm-package-readme-core-mcp-server** - Kubernetes/Helm パッケージ対応
- **swift-package-readme-core-mcp-server** - Swift Package Manager 対応
- **vcpkg-package-readme-core-mcp-server** - C/C++/vcpkg パッケージ対応

### セットアップ手順

1. **各MCPサーバーのビルド**
   ```bash
   # 例: npm用MCPサーバー
   cd ../npm-package-readme-core-mcp-server
   npm install
   npm run build
   
   # 他のパッケージマネージャーについても同様に実行
   ```

2. **設定ファイルの確認**
   
   `config/mcp-servers.json` で各MCPサーバーのパスが正しく設定されていることを確認してください。

## 概要

このサーバーは以下の機能を提供します：

- **自動パッケージマネージャー判定**: パッケージ名やコンテキストヒントから最適なパッケージマネージャーを判定
- **統一インターフェース**: 複数のパッケージマネージャーに対して統一されたAPIを提供
- **並列実行**: 複数のパッケージマネージャーを並列で実行し、最適な結果を返却
- **フォールバック機能**: 一つのパッケージマネージャーが失敗した場合の代替手段を提供

## サポートパッケージマネージャー

- npm (Node.js)
- Composer (PHP)
- pip (Python)
- Cargo (Rust)
- Maven (Java)
- NuGet (.NET)
- RubyGems (Ruby)
- CocoaPods (iOS/macOS)
- Conan (C/C++)
- CPAN (Perl)
- CRAN (R)
- Docker Hub (Docker)
- Helm (Kubernetes)
- Swift Package Manager (Swift)
- vcpkg (C/C++)

## 提供ツール

### 1. smart_package_search

パッケージマネージャーを自動判定してパッケージを検索します。

```json
{
  "package_name": "express",
  "context_hints": ["node", "web server"],
  "preferred_managers": ["npm"],
  "limit": 10
}
```

### 2. smart_package_readme

パッケージマネージャーを自動判定してREADMEを取得します。

```json
{
  "package_name": "lodash",
  "version": "latest",
  "context_hints": ["javascript"],
  "include_examples": true
}
```

### 3. smart_package_info

パッケージマネージャーを自動判定してパッケージ情報を取得します。

```json
{
  "package_name": "requests",
  "context_hints": ["python", "http"],
  "include_dependencies": true
}
```

### 4. list_supported_managers

サポートしているパッケージマネージャーの一覧と接続状況を取得します。

```json
{}
```

## インストールと設定

### 1. 前提条件

**必須**: 上記の各パッケージマネージャー対応MCPサーバーがビルド済みであることを確認してください。

### 2. 依存関係のインストール

```bash
cd package-readme-core-mcp-server
npm install
```

### 3. ビルド

```bash
npm run build
```

### 4. 設定ファイルの調整

必要に応じて以下の設定ファイルを調整してください：

- `config/package-managers.json`: パッケージマネージャーの定義
- `config/mcp-servers.json`: 外部MCPサーバーの接続設定

**重要**: `config/mcp-servers.json` 内のパスが、実際にビルドした各MCPサーバーの場所と一致していることを確認してください。

### 5. 実行

```bash
npm start
```

## 設定

### 環境変数

```bash
# 基本設定
NODE_ENV=production
LOG_LEVEL=info

# 判定エンジン設定
DETECTION_TIMEOUT=1000
HIGH_CONFIDENCE_THRESHOLD=0.8
MEDIUM_CONFIDENCE_THRESHOLD=0.6

# MCP Client設定
MCP_TOOL_TIMEOUT=5000
MCP_CONNECTION_TIMEOUT=3000
MAX_CONCURRENT_CONNECTIONS=10

# キャッシュ設定
CACHE_TTL_DETECTION=3600
CACHE_TTL_RESPONSES=1800
CACHE_MAX_SIZE=100
```

### パッケージマネージャー設定例

```json
{
  "managers": {
    "npm": {
      "name": "npm",
      "description": "Node.js package manager",
      "file_patterns": ["package.json", "package-lock.json"],
      "package_name_patterns": [
        "^@[a-z0-9-~][a-z0-9-._~]*\\/[a-z0-9-~][a-z0-9-._~]*$",
        "^[a-z0-9-~][a-z0-9-._~]*$"
      ],
      "context_keywords": ["node", "javascript", "typescript"],
      "priority": 1
    }
  }
}
```

### MCPサーバー設定例

```json
{
  "servers": {
    "npm": {
      "server_id": "npm-package-mcp",
      "command": "node",
      "args": ["../npm-package-readme-core-mcp-server/dist/index.js"],
      "env": {},
      "tools": ["get_package_readme", "get_package_info", "search_packages"],
      "health_check_interval": 30000
    }
  }
}
```

## アーキテクチャ

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│ Package README Core │───▶│   npm-mcp      │
│   (Claude等)    │    │    MCP Server       │    │    Server      │
└─────────────────┘    └─────────────────────┘    └─────────────────┘
                                │                   ┌─────────────────┐
                                ├──────────────────▶│ composer-mcp    │
                                │                   │    Server       │
                                │                   └─────────────────┘
                                │                   ┌─────────────────┐
                                ├──────────────────▶│   pip-mcp       │
                                │                   │    Server       │
                                │                   └─────────────────┘
                                ▼                   ┌─────────────────┐
                       ┌─────────────────┐         │   cargo-mcp     │
                       │   Detection     │────────▶│    Server       │
                       │    Engine       │         └─────────────────┘
                       └─────────────────┘
```

## 判定アルゴリズム

### 1. パッケージ名パターン判定

各パッケージマネージャーの命名規則に基づいてパッケージ名を解析します。

### 2. コンテキストヒント解析

- ファイル拡張子の解析
- キーワードの検出
- フレームワークパッケージの特定

### 3. 信頼度スコア計算

```typescript
weights: {
  exact_package_name_match: 0.4,      // 正確なパッケージ名一致
  package_name_pattern: 0.3,          // パッケージ名パターン一致
  context_hints: 0.2,                 // コンテキストヒント
  user_preference: 0.1                // ユーザー設定
}
```

## エラーハンドリング

- **DETECTION_FAILED**: パッケージマネージャーの判定失敗
- **ALL_MANAGERS_FAILED**: 全パッケージマネージャーでの実行失敗
- **MCP_SERVER_UNAVAILABLE**: MCPサーバーが利用不可
- **TIMEOUT**: タイムアウト
- **INVALID_PACKAGE_NAME**: 無効なパッケージ名

## パフォーマンス

### キャッシュ機能

- 判定結果キャッシュ（1時間）
- ツール実行結果キャッシュ（30分）
- 接続状態キャッシュ（5分）

### 並列実行

- 高信頼度（0.8以上）: 単一マネージャー実行
- 中信頼度（0.6-0.8）: 上位3マネージャー並列実行
- 低信頼度（0.6未満）: 全マネージャー並列実行

## トラブルシューティング

### よくある問題

1. **MCPサーバーに接続できない**
   - 各個別MCPサーバーがビルドされ、正しいパスに配置されていることを確認
   - `config/mcp-servers.json` のパス設定を確認

2. **特定のパッケージマネージャーが動作しない**
   - 対応するMCPサーバーが正常に動作することを個別に確認
   - ログを確認してエラーの詳細を調査

3. **判定精度が低い**
   - より多くのコンテキストヒントを提供
   - `preferred_managers` パラメータを使用して優先順位を指定

## 開発

### テスト

```bash
npm test
```

### リント

```bash
npm run lint
```

### 開発モード

```bash
npm run dev
```

## 使用例

### Claude での使用例

```
ユーザー: "lodash について教えて"

# Package README Core MCP Server が動作:
1. "lodash" のパッケージ名解析
2. npmパッケージの可能性が高いと判定（信頼度: 0.9）
3. npm-mcp サーバーの get_package_readme tool を呼び出し
4. 結果をユーザーに返却
```

```
ユーザー: "symfony/console のドキュメントが欲しい"

# Package README Core MCP Server が動作:
1. "symfony/console" のパッケージ名解析 
2. vendor/package 形式からComposerと判定（信頼度: 0.95）
3. composer-mcp サーバーの get_package_readme tool を呼び出し
4. 結果をユーザーに返却
```

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します。

## サポート

質問や問題がある場合は、GitHubのIssuesを使用してください。