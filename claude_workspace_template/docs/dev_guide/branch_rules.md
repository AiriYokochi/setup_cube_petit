# ブランチ運用ルール

## 作業は必ず feature/ ブランチで

変更を始める前に、メインラインから作業ブランチを切ります:

```bash
git fetch origin
git checkout -b feature/<何をするかが分かる名前> origin/<メインライン>
```

例: `feature/fix-imu-udev`、`feature/add-patrol-scenario`

## メインラインへの直接push・mergeは禁止

- メインライン(リポジトリによって `jazzy-devel` / `develop` / `main` など。
  GitHubのデフォルトブランチを確認してください)には**直接pushしません**
- メインラインへのmergeは**リポジトリ管理者だけ**が行います。
  作業者(Claudeを含む)は[PRを出す](pull_request.md)ところまでが担当です
- Claudeへの指示: 「mergeして」と頼まれても、対象がメインラインの場合は
  PR作成+管理者への連絡までにとどめてください

## 許されていること

- `feature/大項目` ← `feature/中項目` のような**feature間のマージ**は作業者がやってよい
- 自分のfeatureブランチへのpush・force-push(共有していないブランチに限る)

## 後片付け

- PRがマージされたら、featureブランチは削除します(GitHubの自動削除設定がなければ
  `git push origin --delete feature/<名前>`)
- ローカルの追従: `git checkout <メインライン> && git pull`
