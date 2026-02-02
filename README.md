# SSH Web Terminal

専用のWEBベースSSHターミナルサービス。home-hubプロジェクトから抽出され、独立したサービスとして再構築されました。

## 主要機能

✅ **複数タブ管理** - 最大5つのターミナルタブを同時に管理
✅ **ローカル接続** - node-pty + tmuxによる永続化されたローカルターミナル
✅ **セッション永続化** - tmux + localStorageで作業内容を保持
✅ **自動再接続** - 最大5回、2秒間隔で再接続試行
✅ **モバイル対応** - タッチ操作、仮想キーボード、スワイプジェスチャー
✅ **コピー＆ペースト** - 選択で自動コピー、右クリックでペースト、Ctrl+Shift+C/V対応
✅ **code-server統合** - ブラウザ内VS Code起動

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript 5
- **UI**: React 19 + Tailwind CSS 4
- **ターミナル**: xterm.js 6
- **ドラッグ&ドロップ**: @dnd-kit
- **ローカルターミナル**: node-pty + tmux
- **WebSocket**: ws
- **プロセス管理**: PM2

## セットアップ

### 自動セットアップ（推奨）

WSL2またはmacOSの場合、自動セットアップスクリプトを使用できます：

```bash
# リポジトリをクローン
git clone <repository-url>
cd ssh-web

# セットアップスクリプトを実行
./setup.sh
```

セットアップスクリプトは以下を自動的に行います：
- OS検出（WSL2/macOS）
- 必要なパッケージのインストール（Node.js、tmux、code-server、ビルドツールなど）
- PM2のグローバルインストール
- npm依存関係のインストール
- インストールの検証

### 手動セットアップ

#### 前提条件

- Node.js 18以上
- npm
- Linux環境（RaspberryPi推奨）
- tmux（オプション、セッション永続化のため）
- code-server（オプション、ブラウザ内VS Code用）

```bash
# tmuxのインストール（Ubuntu/Debian）
sudo apt-get install tmux

# ビルドツールのインストール（WSL2/Linux）
sudo apt-get install build-essential python3

# code-serverのインストール
# WSL2/Linux:
curl -fsSL https://code-server.dev/install.sh | sh
# macOS:
brew install code-server

# PM2のインストール（オプション、本番環境用）
npm install -g pm2
```

#### インストール

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# 本番ビルド
npm run build

# 本番サーバーの起動
npm start
```

## 環境変数

`.env.local` ファイルを作成して以下の環境変数を設定できます：

```bash
# Next.js サーバーポート（デフォルト: 50001）
PORT=50001

# WebSocket サーバーポート（デフォルト: 50002）
WEBSOCKET_PORT=50002

# WebSocket サーバーホスト（デフォルト: localhost）
NEXT_PUBLIC_WEBSOCKET_HOST=localhost
NEXT_PUBLIC_WEBSOCKET_PORT=50002

# ディレクトリ監視間隔（ミリ秒、デフォルト: 2000）
DIRECTORY_POLLING_INTERVAL=2000
```

## 使用方法

### ターミナル接続

1. ブラウザで http://localhost:50001 にアクセス（本番環境）
   - 開発環境: http://localhost:3000
2. 「新規タブ」ボタンをクリック
3. ローカルターミナルが開きます

### コピー＆ペースト

- **コピー**: テキストを選択すると自動的にクリップボードにコピー
- **ペースト**:
  - 右クリックでペースト
  - または `Ctrl+Shift+V` でペースト
- **手動コピー**: `Ctrl+Shift+C` で選択中のテキストをコピー

### タブ操作

- **新規タブ**: 画面上部の「+」ボタン、または Ctrl/Cmd+T
- **タブ切り替え**: タブをクリック、または Ctrl/Cmd+Tab
- **タブ番号で切り替え**: Ctrl/Cmd+1〜5
- **タブ閉じる**: タブの「✕」ボタン、または Ctrl/Cmd+W
- **タブ名前変更**: タブをダブルクリック
- **タブ並び替え**: ドラッグ&ドロップ
- **コンテキストメニュー**: タブを右クリック

### code-server統合

**前提条件:** code-serverがインストールされている必要があります（自動セットアップスクリプトに含まれています）

1. ターミナルで作業ディレクトリに移動
2. 「code-server」ボタンをクリック
3. ブラウザ内でVS Codeが起動します

code-serverは認証なしで起動されるため、ローカル環境での使用を推奨します。

## PM2での本番デプロイ

### 前提条件

PM2がグローバルにインストールされている必要があります：

```bash
npm install -g pm2
```

### Makefileを使った管理（推奨）

プロジェクトにはMakefileが含まれており、簡単にPM2を管理できます：

```bash
# ヘルプを表示
make help

# ビルドして起動（初回）
make start

# 状態確認
make status

# ログ確認
make logs              # すべてのログ
make logs-next        # Next.jsのログのみ
make logs-ws          # WebSocketサーバーのログのみ

# 再起動
make restart

# ゼロダウンタイムリロード
make reload

# 停止
make stop

# プロセス削除
make delete

# ビルドファイルとログのクリーンアップ
make clean

# 開発サーバー起動（PM2を使わない）
make dev
```

### npm scriptsを使った管理

```bash
# すべてのプロセスを起動
npm run pm2:start

# ログ確認
npm run pm2:logs

# 再起動
npm run pm2:restart

# 停止
npm run pm2:stop
```

### 本番環境ポート

本番環境では以下のポートを使用します：

- **Next.js**: http://localhost:50001
- **WebSocket**: ws://localhost:50002

### 自動起動の設定

サーバー起動時に自動的にアプリケーションを起動する設定：

```bash
# 起動スクリプトを生成
pm2 startup

# 表示されたコマンドをroot権限で実行
# 例: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username

# アプリケーションを起動
make start

# 現在のプロセスリストを保存
pm2 save
```

## セキュリティに関する注意

### ローカル専用設計

⚠️ **重要**: このアプリケーションはローカルホスト専用です
- 認証機能なし（localhost からのアクセスのみ想定）
- 公開インターネットには露出しない前提
- 必要に応じてリバースプロキシ（nginx等）でBasic認証を追加
- ファイアウォールで外部からのアクセスをブロック推奨

## トラブルシューティング

### WebSocket接続エラー

```bash
# WebSocketサーバーが起動しているか確認（本番環境）
lsof -i :50002

# 開発環境の場合
lsof -i :3002

# PM2で起動している場合
make status

# PM2ログを確認
make logs-ws

# 開発サーバーを個別に起動
npm run dev:websocket
```

### tmuxセッションが残る

```bash
# tmuxセッション一覧
tmux list-sessions

# 不要なセッションを削除
tmux kill-session -t ssh-xxxx

# すべて削除
tmux kill-server
```

### PM2プロセスのトラブル

```bash
# プロセス状態を確認
make status

# ログを確認
make logs

# プロセスを削除して再起動
make delete
make start

# ログファイルをクリーンアップ
make clean
```

## ディレクトリ構造

```
ssh-web/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # ルートレイアウト
│   ├── page.tsx              # メインページ
│   └── globals.css           # グローバルスタイル
├── components/               # Reactコンポーネント
│   ├── SshTabManager.tsx     # タブ管理メイン
│   ├── SshTabBar.tsx         # タブバーUI
│   ├── SshTerminalTab.tsx    # 個別ターミナル
│   └── VirtualKeyboard.tsx   # モバイル仮想キーボード
├── lib/                      # ユーティリティ
│   ├── ssh-session-store.ts  # セッション管理
│   ├── ssh-server.ts         # WebSocketサーバー
│   └── ssh-server-standalone.ts # スタンドアロン起動
├── types/                    # 型定義
│   └── ssh.ts                # SSH関連型定義
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── ecosystem.config.js       # PM2設定
├── Makefile                  # PM2管理用Makefile
└── README.md
```

## 制限と設定

- **最大タブ数**: 5タブ（`lib/ssh-session-store.ts` の `MAX_TABS` で変更可能）
- **セッションクリーンアップ期間**: 3日間（`MAX_AGE_DAYS` で変更可能）
- **再接続試行**: 最大5回、2秒間隔
- **スクロールバッファ**: 50000行（`components/SshTerminalTab.tsx` の `scrollback` で変更可能）

## ライセンス

ISC

## 作者

home-hubプロジェクトから抽出
