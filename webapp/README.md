# Cube Petit セットアップ Webアプリ (Phase 1 / MVP)

非エンジニアの方でも、ブラウザの案内に従うだけで実機PCのセットアップができるようにするための
Webアプリです。既存の `setup_pc.bash` / `setup_dev_tools.sh` / `setup_ros.bash` を呼び出すだけ
のラッパーで、スクリプトの中身自体は変更していません。

## 使い方 (クイックスタート)

```bash
cd ~/work/cube_petit_setup
./webapp/run.sh
```

1. 最初にsudoパスワードを1回だけ聞かれます(以後は自動で認証が維持されます)。
2. ターミナルに表示されるURL(`http://localhost:8760`)をブラウザで開きます。
3. 画面の案内に従って、ステップを上から順に実行してください。

**再起動が必要なステップの後**は、機体を再起動してから、もう一度
`./webapp/run.sh` を実行してください。どこまで終わったかは自動的に記録されているので、
続きから再開できます(進捗は `~/.cube_petit_setup/state.json` に保存されます)。

**途中のステップからやり直したいとき / 最初からやり直したいとき**は、run.sh を
Ctrl+C で止めてから:

```bash
./webapp/reset.sh
```

を実行すると、ステップ一覧が番号付きで表示され、「どのステップからやり直しますか?
[番号 / a=全部 / q=中止]」と聞かれます。番号を選ぶと、そのステップ**以降**の実行記録
だけを消して未実行に戻します(それより前の完了記録と、入力欄に入れた値は残るので、
再実行時にプリフィルされます)。`a` を選ぶ(または `--all` / 旧来の `-f`)と、進行状態を
全部消して最初からやり直せます。

スクリプトを止めずに直接指定したい場合は、非対話フラグも使えます:

```bash
./webapp/reset.sh --from devices   # 「7. デバイス設定」以降だけリセット
./webapp/reset.sh --all            # 全部リセット(確認なし)
```

いずれの場合も、消えるのはウィザード自身の進行記録(`~/.cube_petit_setup/state.json`
と `logs/`)だけです。インストール済みのものが消えるわけではなく、各ステップは
再実行しても安全です。リセット後は `./webapp/run.sh` を起動し直して、ブラウザを
リロードしてください(Ctrl+Shift+R)。

## 開発者向け: mockモード

このアプリの開発・動作確認をするときは、実際のセットアップコマンドを実行しない
`--mock` モードを使ってください(sudoパスワードも不要です)。

```bash
./webapp/run.sh --mock
```

mockモードでは、すべてのコマンド実行が「実行するコマンドをエコー表示 + 数秒スリープ」に
置き換えられ、実機やこのPC自体に一切変更を加えません。ROS導入ステップの「既存フォルダ検知」
分岐を試したい場合は、以下のデバッグ用APIで擬似的に既存フォルダを作成/削除できます(mockモード
限定、実フォルダには一切触れないサンドボックス `~/.cube_petit_setup/mock_home/` を使います)。

```bash
curl -X POST http://localhost:8760/api/debug/mock/seed/ros_setup            # cube_petit_ros未ビルド + ripvcs(全選択肢が出る)
curl -X POST http://localhost:8760/api/debug/mock/seed_bare_ros/ros_setup   # 無関係の空の ~/ros のみ(別ワークスペースのみ出る)
curl -X POST http://localhost:8760/api/debug/mock/seed_built/ros_setup     # ビルド済み(ビルドだけやり直す、は出ない)
curl -X POST http://localhost:8760/api/debug/mock/clear/ros_setup          # すべてのフィクスチャを消す
```

## 構成

```
webapp/
  run.sh              # 起動スクリプト(venv構築・sudo維持・サーバー起動)
  requirements.txt
  app/
    main.py           # FastAPIルーティング
    engine.py         # ステップ実行エンジン(サブプロセス起動・ログ配信・mock切替)
    state.py          # ~/.cube_petit_setup/state.json への永続化
    steps.yaml        # ステップ定義(データのみ。実スクリプトの中身は変更しない)
  static/
    index.html / style.css / app.js   # 素のHTML/JS(外部CDN不使用)
```

## Phase 1 の対象ステップ

1. 前提確認(Ubuntu 24.04・ネット接続・ディスク空きの確認、個体名の入力)
2. PC基本設定 (`setup_pc.bash`)
3. 開発ツール(任意、GitKraken/VS Code、デフォルトOFF) (`setup_dev_tools.sh`)
4. ROS導入 (`setup_ros.bash`、既存フォルダ検知でスキップ/削除して再実行を選択可能)
5. 再起動誘導(再起動後にもう一度 `run.sh` を実行すると続きから再開)

## Phase 2 の対象ステップ

6. 環境設定 (`setup_bashrc.bash`。ROS_DOMAIN_ID・RMW_IMPLEMENTATION・CycloneDDS設定
   (`config/cyclonedds.xml` の配布 + sysctl での受信バッファ拡大)と、01_BRING などの
   起動エイリアスを ~/.bashrc にマーカー付きブロックで冪等に書き込む。個体名は
   ステップ1の保存値をエンジンが自動で渡す)
7. デバイス設定 (`setup_devices.bash`。Wi-Fi優先設定/スピーカー(SoundBlaster)/IMU/CAN/RealSense
   をON/OFFで選択。既存の toggle_script 型をそのまま流用)
8. Bluetoothコントローラ接続(`bluetoothctl` をラップした新規API。スキャン→一覧→接続。
   sudo不要)
9. センサ接続確認(`shell_scripts/udev_check.sh` を実行し、ログの `[OK]`/`[NG]` 行を
   パースして色付き一覧表示。NGがあっても先に進める)

ROSワークスペースについて: ステップ4(ROS導入)は既存の作業跡を検知すると、状況に応じて
「スキップ」「削除してやり直す」に加え、「ソースはあるのでビルドだけやり直す」
(`setup_ros.bash --build-only`)・「既存の ~/ros を残して別ワークスペース
cube_petit_ros2_ws を新規作成」(`CUBE_PETIT_ROS_WS` 環境変数)を動的に提示する。

petit導入・自動起動設定(Phase 3)は今後の対応です。
詳細は `docs/cube_petit_setup_survey.md` と `plans/setup_webapp_plan.md`
(orange_petit_claude リポジトリ)を参照してください。

---

# Cube Petit Setup Web App (Phase 1 / MVP) — English summary

A browser-based wizard so a non-engineer can set up a Cube Petit PC by following
on-screen instructions. It is a thin wrapper around the existing
`setup_pc.bash` / `setup_dev_tools.sh` / `setup_ros.bash` scripts — their
contents are not reimplemented.

**Quick start:**

```bash
cd ~/work/cube_petit_setup
./webapp/run.sh
# open the printed http://localhost:8760 URL in a browser
```

You'll be asked for your sudo password once at the start; after any step that
requires a reboot, reboot the machine and re-run `./webapp/run.sh` — progress
is saved in `~/.cube_petit_setup/state.json` and the wizard resumes where you
left off.

**Development / testing:** use `./webapp/run.sh --mock` to run the whole app
without executing any real setup commands (no sudo needed either). Every
command is replaced by an echo+sleep simulation. See `/api/debug/mock/seed/*`
and `/clear/*` above to exercise the "existing directory detected" branch of
the ROS install step deterministically.
