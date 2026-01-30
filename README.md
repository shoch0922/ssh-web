# SSH Web Terminal

専用のWEBベースSSHターミナルサービス。home-hubプロジェクトから抽出され、独立したサービスとして再構築されました。

## 主要機能

✅ **複数タブ管理** - 最大5つのターミナルタブを同時に管理
✅ **ローカル接続** - node-pty + tmuxによる永続化されたローカルターミナル
✅ **リモート接続** - ssh2ライブラリによる実際のSSH接続
✅ **セッション永続化** - tmux + localStorageで作業内容を保持
✅ **自動再接続** - 最大5回、2秒間隔で再接続試行
✅ **モバイル対応** - タッチ操作、仮想キーボード、スワイプジェスチャー
✅ **code-server統合** - ブラウザ内VS Code起動（ローカル接続のみ）

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript 5
- **UI**: React 19 + Tailwind CSS 4
- **ターミナル**: xterm.js 6
- **ドラッグ&ドロップ**: @dnd-kit
- **ローカルSSH**: node-pty + tmux
- **リモートSSH**: ssh2
- **WebSocket**: ws

## セットアップ

### 前提条件

- Node.js 18以上
- npm
- Linux環境（RaspberryPi推奨）
- tmux（オプション、セッション永続化のため）

```bash
# tmuxのインストール（Ubuntu/Debian）
sudo apt-get install tmux
```

### インストール

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
# Next.js サーバーポート（デフォルト: 3000）
NEXT_PORT=3000

# WebSocket サーバーポート（デフォルト: 8081）
WEBSOCKET_PORT=8081

# WebSocket サーバーホスト（デフォルト: localhost）
NEXT_PUBLIC_WEBSOCKET_HOST=localhost
NEXT_PUBLIC_WEBSOCKET_PORT=8081

# ディレクトリ監視間隔（ミリ秒、デフォルト: 2000）
DIRECTORY_POLLING_INTERVAL=2000
```

## 使用方法

### ローカル接続

1. ブラウザで http://localhost:3000 にアクセス
2. 「新規タブ」ボタンをクリック
3. 「ローカル」を選択して「接続」をクリック
4. ローカルターミナルが開きます

### リモート接続

1. 「新規タブ」ボタンをクリック
2. 「リモート」を選択
3. 接続情報を入力：
   - **ホスト名/IPアドレス**: リモートサーバーのアドレス
   - **ポート番号**: SSHポート（デフォルト: 22）
   - **ユーザー名**: SSHユーザー名
   - **認証方法**: パスワードまたは秘密鍵
   - **パスワード/秘密鍵**: 認証情報
4. 「接続」をクリック
5. リモートサーバーのターミナルが開きます

### タブ操作

- **新規タブ**: 画面上部の「+」ボタン、または Ctrl/Cmd+T
- **タブ切り替え**: タブをクリック、または Ctrl/Cmd+Tab
- **タブ番号で切り替え**: Ctrl/Cmd+1〜5
- **タブ閉じる**: タブの「✕」ボタン、または Ctrl/Cmd+W
- **タブ名前変更**: タブをダブルクリック
- **タブ並び替え**: ドラッグ&ドロップ
- **コンテキストメニュー**: タブを右クリック

### code-server統合（ローカル接続のみ）

1. ローカル接続のターミナルで作業ディレクトリに移動
2. 「code-server」ボタンをクリック
3. ブラウザ内でVS Codeが起動します

## PM2での本番デプロイ

### PM2のインストール

```bash
npm install -g pm2
```

### 起動・停止

```bash
# すべてのプロセスを起動
npm run pm2:start

# 状態確認
npm run pm2:status

# ログ確認
npm run pm2:logs

# 再起動
npm run pm2:restart

# 停止
npm run pm2:stop
```

### 自動起動の設定

```bash
# 起動スクリプトを生成
pm2 startup

# 表示されたコマンドをroot権限で実行
# 例: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username

# 現在のプロセスリストを保存
pm2 save
```

## セキュリティに関する注意

### 認証情報の扱い

⚠️ **重要**: パスワードは絶対にlocalStorageに保存されません
- パスワードはメモリのみで保持されます
- 再接続時は再入力が必要です
- 秘密鍵認証を推奨します

### 秘密鍵認証の使用

サーバー側で秘密鍵ファイルを準備：

```bash
# SSH鍵ペアの生成（リモートサーバー上で）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa

# 公開鍵をauthorized_keysに追加
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 秘密鍵のパスをConnectionSelectorに入力
# 例: /home/username/.ssh/id_rsa
```

### 接続情報の検証

- ホスト名のバリデーション
- ポート範囲の制限（1-65535）
- タイムアウト設定（30秒）

### ローカル専用設計

- 認証機能なし（localhost からのアクセスのみ想定）
- 公開インターネットには露出しない前提
- 必要に応じてリバースプロキシ（nginx等）でBasic認証を追加

## トラブルシューティング

### WebSocket接続エラー

```bash
# WebSocketサーバーが起動しているか確認
lsof -i :8081

# サーバーを個別に起動
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

### リモート接続失敗

- ホスト名/IPアドレスが正しいか確認
- ポート番号が正しいか確認（デフォルト: 22）
- ファイアウォールで接続が許可されているか確認
- SSH鍵認証の場合、秘密鍵ファイルのパスが正しいか確認
- タイムアウト（30秒）を待ってから再試行

### 接続エラーの詳細確認

```bash
# PM2ログを確認
pm2 logs ssh-web-websocket

# または直接WebSocketサーバーを起動してログを確認
npm run dev:websocket
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
│   ├── VirtualKeyboard.tsx   # モバイル仮想キーボード
│   └── ConnectionSelector.tsx # 接続先選択UI
├── lib/                      # ユーティリティ
│   ├── ssh-session-store.ts  # セッション管理
│   ├── ssh-server.ts         # WebSocketサーバー
│   ├── ssh-server-standalone.ts # スタンドアロン起動
│   └── ssh-remote.ts         # ssh2統合
├── types/                    # 型定義
│   └── ssh.ts                # SSH関連型定義
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── ecosystem.config.js       # PM2設定
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
