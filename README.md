# cube_petit_setup

English version → [README_EN.md](README_EN.md)

キューブプチ(ロボット実機)のPCをセットアップするスクリプト集です。

> 自分のPC(シミュレータ環境)で動かしたいだけの場合、このスクリプトは不要です。[cube_petit_ros](https://github.com/sbgisen/cube_petit_ros) を直接クローンするか、[Docker開発環境](docker/README.md)(ビルド済みワークスペース入りイメージを `docker pull` するだけ)を使ってください。

## 3ステップでセットアップ

以下を上から順にコピペしていくだけでセットアップが完了します。

### ① リポジトリを取得

```bash
sudo apt install -y git ssh

mkdir -p ~/work && cd ~/work/
git clone https://github.com/sbgisen/cube_petit_setup.git -b jazzy-devel
cd cube_petit_setup
```

- GitHubにSSH鍵を登録していない場合は、続けて `ssh-keygen` を実行し、表示された公開鍵を [https://github.com/settings/keys](https://github.com/settings/keys) に登録してください(登録済みならスキップでOK)。

### ② PC本体とROSをセットアップ

```bash
source setup_pc.bash
source setup_dev_tools.sh
source setup_ros.bash
```

- `setup_pc.bash`: sudoパスワードを聞かれます。最後に画面が一瞬暗くなり、キューブプチの顔の壁紙が表示されます(正常動作です)。
- `setup_dev_tools.sh`: GitKraken・VSCodeを入れるか対話式(Y/n、Enterでインストール)で聞かれます。sudoパスワードも聞かれます。
- `setup_ros.bash`: sudoパスワードや、Enterキーを求められる場面があります。
- **完了後、再起動してください**(dialout/videoグループの権限を反映するため。次のステップに進む前に必須です)。

### ③ デバイスをセットアップ(再起動後)

```bash
cd ~/work/cube_petit_setup
source setup_devices.bash
```

- Wifi・Audio・IMU・CAN・Realsenseの各項目ごとに、セットアップするか対話式(Y/n、Enterでインストール)で聞かれます。
- Wifiはルータが用意されているとき、AudioはSoundBlasterが繋がっているときのみ実行してください。ロボット本体に繋いでいないデバイスはスキップしてOKです。

## 動作確認

1. PCをロボット筐体内に設置する
2. **電源**、**USB×2**、**HDMI**を接続する
3. **電源ON** し、キューブプチの顔が表示されることを確認する
4. **ネットワーク**設定を確認する
5. **スピーカー・マイク**設定を確認する
6. **USB認識**を確認する(`udevs/*.rules` で作成されるデバイス名)
    ```bash
    ls /dev
    ```
    以下が含まれていればOK
    ```
    ttyWitMotion
    ttyCANable
    ttyLD06-19
    ```
7. **コントローラ**が使えることを確認する
8. **自動起動**を設定する

## Docker開発環境(実機なしで開発する)

実機がなくても、ビルド済みワークスペース入りのDockerイメージで開発・シミュレーションができます。

```bash
docker pull ghcr.io/sbgisen/cube_petit_dev:jazzy
```

イメージは `jazzy-devel` へのpushと週次スケジュールでGitHub Actionsが自動ビルドします。
使い方(Gazeboシミュレーション・ソースのマウント・VSCode devcontainer)は [docker/README.md](docker/README.md) を参照してください。

## PRを実機でテストする(petit-test)

GitHubのPRを実機でサクッと試すためのヘルパースクリプト。
`petit-test <repo> <PR番号>` の一発で、PRのコード取得 → 依存解決 → ビルド → tmux起動までやる。

### インストール

```bash
sudo ln -s "$(pwd)/bin/petit-test" /usr/local/bin/petit-test
# もしくはPATHに bin/ を追加
```

### 使い方

```bash
petit-test cube_petit_scenario 4    # sbgisen/cube_petit_scenario のPR #4 をテスト
petit-test clean                    # 後片付け(tmux終了・~/ros_test削除)
```

### やること

1. `gh` でPRのブランチを解決し、`~/ros/src/<repo>` に fetch
2. `~/ros_test/src/<repo>` にPRブランチの **git worktree**(detached)を作成/更新
3. `rosdep install` で依存を解決(失敗しても続行)
4. PRで変更されたパッケージだけを `colcon build --symlink-install --packages-up-to` でビルド
   (underlayとして `~/ros/install` をsource)
5. PR本文の「実機確認」セクション(なければ本文全体)を表示
6. tmuxセッション `petit-test` を3ペインで起動
   - **PRサマリ**: タイトル・URL・実機確認チェックリスト
   - **起動用**: `ros2 launch ...` を打つ用
   - **確認用**: `ros2 topic list` / `echo` を打つ用
   - 各ペインは underlay(`~/ros/install`)+ overlay(`~/ros_test/install`)がsource済み、
     `ROS_DOMAIN_ID=94` / `RMW_IMPLEMENTATION=rmw_cyclonedds_cpp` 設定済み

同じコマンドの再実行はブランチ更新+差分リビルドだけ行う(冪等)。
tmuxが無い環境では、手動実行用のコマンドを表示して終了する。

### 安全性

- 稼働中ワークスペース **`~/ros` のソース・installには手を入れない**
  - `~/ros/src/<repo>` への書き込みは `git fetch` と worktree のメタデータ(`.git/worktrees/`)のみで、作業ツリー・checkout状態は変わらない
- PRのコードは `~/ros_test` に分離してビルドし、`petit-test clean` で完全に元に戻せる
- worktreeはdetached checkoutなので、同じブランチが他でcheckout済みでも衝突しない

## 詳細

### Cube petitとは

- **オープンソースのハード・ソフト**で作られたパーソナルロボットキット
- 実機・シミュレータ(Gazebo11)どちらでも簡単に開発できる環境
- 基本機能として **SLAM・ナビゲーション**
- 発展機能として **簡単な会話・自動充電** など(ROS1でも利用可)

### 動作環境

- Ubuntu 24.04
- インターネット接続

### 各セットアップスクリプトについて

| スクリプト | 内容 |
| --- | --- |
| `setup_pc.bash` | 壁紙・Chrome導入・サイドバー非表示・電源設定など |
| `setup_dev_tools.sh` | (任意)GitKraken・VSCodeの導入 |
| `setup_ros.bash` | ROS2 Jazzyと`cube_petit_ros`リポジトリの導入 |
| `setup_devices.bash` | Wifi・Audio・IMU・CAN・Realsenseの設定 |
