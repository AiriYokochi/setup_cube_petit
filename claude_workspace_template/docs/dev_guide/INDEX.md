# 開発ガイド索引

CubePetitの開発に関わるときの基本ルール集です。1トピック1ファイル。
ClaudeもこのINDEXから該当ガイドを読んでから作業してください。

- [development_workflow.md](development_workflow.md) — 開発の方法: ソースの場所、ビルド、動作確認からコミットまでの流れ
- [branch_rules.md](branch_rules.md) — ブランチ運用: feature/ブランチを切る、メインラインへの直接merge禁止
- [pull_request.md](pull_request.md) — PRの出し方: タイトル・本文の書き方、実機テストの明記
- [setup_and_update.md](setup_and_update.md) — セットアップWebアプリの使い方と、ソフトウェアのアップデート手順
- [forking.md](forking.md) — 自分だけの改造をしたいとき: fork運用と本家の更新の取り込み方
- [robot_specific.md](robot_specific.md) — 個体固有の情報(個体名・ROS_DOMAIN_ID・キャリブレーション値)の扱い

## このガイド集のルール

- 新しいガイドを書いたら、**この索引にも1行説明付きで追加**してください
- 既存のトピックに関する知見は、新ファイルを作らず既存ファイルに追記・マージしてください
- ロボット実装の技術詳細(ノード構成・トピック名など)はここには書かず、
  各リポジトリのREADME・docsを参照してください(二重管理を避けるため)
