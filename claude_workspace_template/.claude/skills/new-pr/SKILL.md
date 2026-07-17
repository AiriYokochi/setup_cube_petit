---
name: new-pr
description: GitHubにPRを出すときの必須手順。作成→ラベル/assignee→CI確認→レビュー依頼まで、登録漏れなく実行する。
---

# PR作成スキル(テンプレート)

> このスキルは雛形です。ベースブランチ名・ラベル・レビュアーは自分の環境に
> 合わせて書き換えて使ってください。

**PRを作ったら手順を全部やる**(1つでも飛ばすとオーナーが気づけない)。

## 1. ブランチと本文

- ブランチ: `feature/<内容>`。ベースは各リポジトリのメインライン
- 本文に必ず入れるもの:
  - **何を・なぜ**: 変更の目的と背景(Issueがあれば `Closes #<番号>`)
  - **実機確認手順**: コピペで動くこと(ロボットに触れる変更の場合)
  - **ロボットの振る舞いへの影響**: 動き・言葉・見た目に触れるなら記述、なければ「なし」
  - **読む順番ガイド**: ①核心のファイル/関数 ②テスト ③機械的変更
    (レビュアーへの案内は書き手の義務)
- 末尾: 🤖 Generated with [Claude Code](https://claude.com/claude-code)
- コミット末尾: `Co-Authored-By:` に使用したモデル名

## 2. 作成直後

```bash
gh pr create --repo <your-org>/<repo> --base <メインライン> --title "..." --body-file <本文>
gh api -X POST repos/<your-org>/<repo>/issues/<PR番号>/labels -f "labels[]=software"
gh api -X POST repos/<your-org>/<repo>/issues/<PR番号>/assignees -f "assignees[]=<オーナー>"
```

- 実機での動作確認が必要なPRはその旨のラベル(例: `needs-robot-test`)を付け、
  確認が済むまでレビュー依頼しない

## 3. CI確認 → レビュー依頼

- CIがあれば全部緑になるまで面倒を見る(落ちたら直してpush)
- 緑になったらレビュアーをリクエストし、オーナーに一言知らせる
- レビュー指摘を修正したら、対応済みのスレッドは全部Resolveする
  (未Resolveが残るとマージ判断ができない)

## 4. マージ後

- 作業ログ(docs/worklog/)に記録
- 依存する他のPR・Issueの後続処理
