# ビルドが witmotion_ros(Qt5SerialPort)で失敗する

- 症状: `setup_ros.bash` の最後の `colcon build` が、IMUドライバ
  `witmotion_ros` のCMake configureで必ず失敗する。
  ```
  CMake Error at .../Qt5Config.cmake:28 (find_package):
    Could not find a package configuration file provided by "Qt5SerialPort"
  ```
- 機種/日付: cube-petit-yellow、2026-07-17(新規セットアップで毎回再現)

## 原因

`cube_petit_ros.repos` はワークスペースに `witmotion_IMU_ros` を
取り込むため、`setup_ros.bash`実行時点で全体ビルドの対象になります。
ところがこのパッケージが必要とする `libqt5serialport5-dev` は、
セットアップ後半の「デバイス設定」ステップ側でしかインストールして
おらず、rosdepでも解決されません。つまり**依存パッケージを入れる順番の
バグ**で、ROS導入の時点では必ずこのパッケージが足りていませんでした。

## 対処

**現行では自動対処済みです**。`setup_ros.bash` のapt installに
`libqt5serialport5-dev` を追加済みなので、最新版でセットアップすれば
このエラーは起きません。

古い版のままエラーに遭遇した場合は、以下を実行してからビルドを
やり直してください。

```bash
sudo apt install -y libqt5serialport5-dev

# ワークスペースのビルドだけやり直す
cd ~/work/cube_petit_setup
./setup_ros.bash --build-only
```

Webアプリ経由の場合は「④ROS2導入」ステップの「もう一度実行」でも
同じことができます。
