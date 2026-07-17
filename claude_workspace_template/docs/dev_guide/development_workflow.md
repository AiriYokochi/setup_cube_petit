# 開発の方法(基本の流れ)

## ソースコードの場所

- ロボットのソフトウェア一式は ROSワークスペース(標準では `~/ros/src/`)にあります。
  例: `~/ros/src/cube_petit_ros/` とその関連リポジトリ
- セットアップスクリプト類は `~/work/cube_petit_setup/` にあります
- このワークスペース(`~/work/{{ROBOT_NAME}}_claude/`)にはロボットのコードを入れません。
  ドキュメント・作業ログ・計画の置き場です

## 変更からコミットまでの流れ

1. 変更したいリポジトリで、まず[ブランチを切ります](branch_rules.md)(`feature/<内容>`)
2. コードを変更したらビルドします:

   ```bash
   cd ~/ros
   colcon build --symlink-install
   source install/setup.bash
   ```

   特定パッケージだけなら `colcon build --symlink-install --packages-select <パッケージ名>` が速いです
3. 実機またはシミュレーションで動作確認します。**動かして確認するまで「直った」と言わない**こと
4. 動作を確認できたらコミットします。コミットメッセージは「何を・なぜ」が分かるように
5. やったこと(試したこと・ハマったこと含む)を `docs/worklog/YYYY-MM-DD.md` に記録します

## 心がけ

- 1つの変更は小さく。大きな変更は計画(`plans/`)に分割してから着手します
- 既存コードのスタイル(命名・コメントの言語・整形)に合わせます
- 壊れた状態でメインラインに持ち込まない([branch_rules.md](branch_rules.md))
