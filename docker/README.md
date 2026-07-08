# Cube petit Docker開発環境

実機がなくてもCube petitの開発・シミュレーションができるDockerイメージです。
jazzy-develブランチへのpushをトリガーにGitHub Actionsがビルドし、GHCRに公開されます。

イメージにはビルド済みのROS2 Jazzyワークスペース(`/ws`)が入っています:

- [cube_petit_ros](https://github.com/sbgisen/cube_petit_ros)(ナビゲーション・シミュレーション・bringup)
- [cube_petit_interaction](https://github.com/sbgisen/cube_petit_interaction)(インタラクション)
- [cube_petit_scenario](https://github.com/sbgisen/cube_petit_scenario)(シナリオ・anima)
- 上記の `.repos` が参照する依存リポジトリ一式

## 使い方

### イメージの取得

```bash
docker pull ghcr.io/sbgisen/cube_petit_dev:jazzy
```

タグは2種類あります:

| タグ | 内容 |
| --- | --- |
| `jazzy` | 最新(週次で自動更新) |
| `jazzy-YYYYMMDD` | 日付固定のスナップショット(再現性が必要なとき用) |

### まずはシェルに入る

```bash
docker run -it --rm ghcr.io/sbgisen/cube_petit_dev:jazzy
```

ワークスペースはsource済みの状態で起動します:

```bash
ros2 pkg list | grep cube_petit
```

### Gazeboシミュレーションを起動する(GUIあり)

X11(WaylandでもXWayland経由で可)のフォワード設定をしてから起動します:

```bash
xhost +local:docker
docker run -it --rm \
    --net=host \
    --ipc=host \
    -e DISPLAY="$DISPLAY" \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    --device /dev/dri \
    ghcr.io/sbgisen/cube_petit_dev:jazzy \
    ros2 launch cube_petit_gazebo cube_petit_gazebo.launch.py sample_world:=true
```

- `--device /dev/dri` はGPUアクセラレーション用(なくても動くが重い)。NVIDIA環境では代わりに
  `--gpus all` + `nvidia-container-toolkit` を使ってください
- Wayland環境で表示されない場合は `xhost +local:` を試すか、`QT_X11_NO_MITSHM=1` を追加してください

別ターミナルから同じイメージでrviz2やteleopを起動できます(`--net=host` 同士で通信できます):

```bash
docker run -it --rm --net=host --ipc=host -e DISPLAY="$DISPLAY" \
    -v /tmp/.X11-unix:/tmp/.X11-unix ghcr.io/sbgisen/cube_petit_dev:jazzy rviz2
```

### 自分のソースで開発する

イメージ内のワークスペース(`/ws/src`)に、手元のリポジトリをマウントで上書きして使います:

```bash
docker run -it --rm \
    --net=host --ipc=host \
    -v ~/ros/src/cube_petit_ros:/ws/src/cube_petit_ros \
    ghcr.io/sbgisen/cube_petit_dev:jazzy
```

コンテナ内で変更したパッケージだけビルドし直します:

```bash
cd /ws
colcon build --symlink-install --packages-select cube_petit_navigation
source /ws/install/setup.bash
```

ビルド成果物(`/ws/build`・`/ws/install`)をホストに残したい場合は、named volumeを割り当てると
コンテナを作り直してもフルビルドが不要になります:

```bash
docker run -it --rm \
    -v ~/ros/src/cube_petit_ros:/ws/src/cube_petit_ros \
    -v cube_petit_build:/ws/build \
    -v cube_petit_install:/ws/install \
    ghcr.io/sbgisen/cube_petit_dev:jazzy
```

### VSCode devcontainerで使う

このリポジトリの [`.devcontainer/devcontainer.json`](../.devcontainer/devcontainer.json) が
このイメージを参照しています。VSCodeで「Reopen in Container」を選ぶだけで、開いているフォルダが
`/ws/src/<フォルダ名>` にマウントされた開発環境が立ち上がります。
cube_petit_ros等の各リポジトリで使う場合は、`.devcontainer/` をそのリポジトリにコピーしてください。

## イメージに含まれないもの(除外パッケージ)

以下のパッケージは、ビルド時に `uv` で独自のPython venv(TensorFlow等を含む、数GB規模)を作るため、
イメージサイズを抑える目的で `COLCON_IGNORE` により除外しています。
ナビゲーション・シミュレーション・コア機能の開発には影響しません。

| パッケージ | リポジトリ | 主な内容 |
| --- | --- | --- |
| `cube_petit_speech_to_text` | cube_petit_ros | 音声認識(venv + Julius) |
| `cube_petit_text_to_speech` | cube_petit_ros | 音声合成(venv) |
| `cube_petit_chat` | cube_petit_interaction | LLM会話(venv) |
| `cube_petit_perception` | cube_petit_interaction | 画像認識(venv + TensorFlow) |
| `cube_petit_state_machine` | cube_petit_scenario | 状態遷移(venv) |
| `cube_petit_rsj_2025` | cube_petit_scenario | RSJ2025デモ(venv) |
| `memory_talk_demo` | cube_petit_scenario | 対話デモ(venv) |

これらを使いたい場合は、コンテナ内で対象の `COLCON_IGNORE`/`AMENT_IGNORE` を消して
`rosdep install` → `colcon build --packages-select <パッケージ名>` してください(時間とディスクを消費します)。

## イメージのビルド(手元で)

通常は不要です(GHCRからpullすればよい)。Dockerfileを変更するときなどに:

```bash
cd docker
docker build -t cube_petit_dev:local --build-arg WORKSPACE_SNAPSHOT=$(date +%Y%m%d) .
```

`WORKSPACE_SNAPSHOT` はソースclone層のキャッシュ無効化用です(値が変わると最新ソースを取り直す)。

## CI(自動ビルド)

[`.github/workflows/docker.yaml`](../.github/workflows/docker.yaml) が以下のタイミングでビルド・pushします:

- `jazzy-devel` へのpush(`docker/` またはワークフロー自体の変更時)
- 週次(毎週月曜 6:00 JST)— ワークスペースのスナップショットを最新に保つため
- 手動(workflow_dispatch)
