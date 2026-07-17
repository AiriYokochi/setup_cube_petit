# Chromeを開くと「キーリングのパスワード」を聞かれる

- 症状: セットアップ後、初めてChromeを開くとパスワード入力ダイアログ
  (キーリングの作成/ロック解除)が出て、何を入れればいいか分からない
- 機種/日付: cube-petit-orange / cube-petit-yellow(setup_pc.bash導入時)

## 原因

ロボットのPCは自動ログイン(`AutomaticLoginEnable=true`)で運用しています。
自動ログインだとログインパスワードを打たないため、GNOMEキーリングが
ログイン時に自動でロック解除されません。その状態でChromeを起動すると、
Chromeがキーリングを開こう/作ろうとしてパスワードを聞いてきます。

## 対処

**v1.0.0以降の`setup_pc.bash`は対策済み**です。パスワードなしの
空キーリングを最初から用意しておくことで、Chrome起動時にダイアログが
出ないようにしています(ロボットはキーリングに秘密情報を保存する用途が
ないため、パスワードなしでも実害はありません)。最新版でセットアップ
すれば発生しません。

古い版のままダイアログが出てしまっている場合は、手動で以下を実行して
から再ログイン(または再起動)してください。

```bash
KEYRING_DIR="$HOME/.local/share/keyrings"
mkdir -p "$KEYRING_DIR"
chmod 700 "$KEYRING_DIR"

# パスワードなしの既定キーリングを作成
printf '[keyring]\ndisplay-name=Default keyring\nctime=0\nmtime=0\nlock-on-idle=false\nlock-after=false\n' \
  > "$KEYRING_DIR/Default_keyring.keyring"
printf 'Default_keyring' > "$KEYRING_DIR/default"

# 既存のログインキーリング(パスワード要求の原因)を削除
rm -f "$KEYRING_DIR/login.keyring"
```

反映のため一度ログアウト→ログイン(または再起動)してください。
