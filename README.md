# cube_petit_setup

English version → [README_EN.md](README_EN.md)

キューブプチ(ロボット実機)のPCをセットアップするスクリプト集です。

> 自分のPC(シミュレータ環境)で動かしたいだけの場合、このスクリプトは不要です。[cube_petit_ros](https://github.com/sbgisen/cube_petit_ros) を直接クローンしてください。

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
