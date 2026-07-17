# Claude Code ワークスペース

このフォルダは、CubePetitのセットアップアプリ(「Claude Codeコード支援」ステップ)が
作成した、Claude Code用の作業場です。

## 使い方

```bash
cd ~/work/<個体名>_claude
claude
```

初回は `claude` コマンドがブラウザを開いてログインを求めます(Claude Pro/Max等の
プランまたはAPIの課金が必要です)。

ログイン後は、このフォルダでClaudeに話しかけるだけで、`CLAUDE.md` に書かれた
運用ルール(作業ログの残し方・記憶の管理)に沿って作業してくれます。

## GitHubリポジトリとの接続(推奨)

作業ログや記憶をバックアップ・複数PCで共有するため、個人の**private**リポジトリに
つなぐことを推奨します。セットアップステップのログに表示された手順どおり:

1. GitHubで新しいprivateリポジトリを作成(例: `<個体名>_claude`)
2. セットアップ時に生成されたSSH公開鍵(`~/.ssh/id_ed25519.pub` の中身)を
   GitHubの Settings → SSH and GPG keys に登録
3. このフォルダで:

```bash
git remote add origin git@github.com:<あなたのアカウント>/<個体名>_claude.git
git add -A && git commit -m "initial workspace"
git push -u origin main
```

## 入っているもの

- `CLAUDE.md` — このワークスペースの運用ルール(Claudeが毎回読む)
- `.claude/skills/` — Claudeに教えた定型ワークフロー(Issue作成・PR作成・計画と委譲)。
  中身はテンプレートなので、自分のリポジトリ・チームに合わせて書き換えて使う
- `docs/dev_guide/` — 開発の基本ルール集(開発の流れ・ブランチ運用・PRの出し方・
  アップデート・fork運用・個体固有情報の扱い)。入口は `docs/dev_guide/INDEX.md`
- `docs/worklog/` — 日次作業ログ置き場
- `plans/` — 計画書置き場
- `memory/` — Claudeの長期記憶の実体(CLAUDE.mdの手順でsymlink接続)
