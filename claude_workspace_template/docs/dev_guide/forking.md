# 自分だけの改造をしたいとき(fork運用)

本家リポジトリ(cube_petit_ros / cube_petit_setup など)に取り込む予定のない
個人的な改造は、本家にfeatureブランチを増やし続けるのではなく、**GitHubで自分の
アカウントにforkして、そのforkをcloneして**使います。

## forkの初期設定

1. GitHubで本家リポジトリの「Fork」ボタンから自分のアカウントにforkを作る
2. forkをcloneして、本家を `upstream` として登録する:

   ```bash
   git clone git@github.com:<あなたのアカウント>/<リポジトリ名>.git
   cd <リポジトリ名>
   git remote add upstream <本家のURL>
   ```

以後、`origin` = 自分のfork、`upstream` = 本家、です。

## 本家の更新を取り込む

まず本家の動きを取得します:

```bash
git fetch upstream
git log --oneline HEAD..upstream/jazzy-devel   # 何が来ているか確認(ブランチ名は本家に合わせる)
```

- **大事な修正だけ拾う**(バグ修正など単発向け):

  ```bash
  git cherry-pick <コミットハッシュ>
  ```

- **まとまった更新を全部取り込む**:

  ```bash
  git merge upstream/jazzy-devel
  ```

- コンフリクトしたら、自分の改造を優先するか本家に合わせるかをその場で判断します。
  迷ったら、自分の改造部分がどう壊れるかを確認してから決めてください

## 本家への還元

自分の改造が他の個体にも有益だと分かったら、featureブランチに切り出して
本家へPRを出します([pull_request.md](pull_request.md))。個体固有の値が
混ざっていないか([robot_specific.md](robot_specific.md))を先に確認してください。

## 注意: 更新チェックはforkしか見ていない

セットアップWebアプリなどの更新チェックは `origin`(=自分のfork)を見るため、
**本家の更新には自動では気づけません**。ときどき `git fetch upstream` して
本家の動きを確認する習慣をつけてください。
