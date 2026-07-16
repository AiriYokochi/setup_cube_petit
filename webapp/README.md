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
curl -X POST http://localhost:8760/api/debug/mock/seed/ros_setup   # 既存フォルダを作る
curl -X POST http://localhost:8760/api/debug/mock/clear/ros_setup  # 消す
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

デバイス設定・動作確認・petit導入(Phase 2)、自動起動設定(Phase 3)は今後の対応です。
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
