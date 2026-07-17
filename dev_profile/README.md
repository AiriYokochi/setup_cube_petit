# dev_profile — 開発環境プロファイル(VS Code「cube-petit-ROS2」)

CubePetitの開発PCに、cube-petit-ROS2開発のVS Code環境(フォーマッタ・linter連携・
ライセンスヘッダ挿入)を1コマンドで導入する。

```bash
cd ~/work/cube_petit_setup
./dev_profile/setup_dev_profile.bash
```

VS Code本体が先に必要(`setup_dev_tools.sh` またはWebアプリの「開発ツール」ステップで導入)。
実行後、VS Codeの新しいウィンドウは自動的に **cube-petit-ROS2 プロファイル**で開く。
sudoは任意(`/opt/work/.github` のシンボリックリンク作成のみ。無ければ手動コマンドを案内)。

## 入るもの

| ファイル | 役割 |
|---|---|
| `extensions.txt` | プロファイルに入れる拡張(ruff / isort / yapf / clangd / cmake-format / ROS / psi-header ほか) |
| `settings.json` | プロファイル用設定。フォーマッタとlinterはsbgisen共通設定(下記)を参照する |
| `.apache-2` | ライセンスヘッダ本文(Apache 2.0)。psi-header拡張が新規ファイルに挿入する |
| `setup_dev_profile.bash` | 導入スクリプト(冪等) |

- **lint/フォーマット設定の実体は [sbgisen/.github](https://github.com/sbgisen/.github)**
  (org共通の `pyproject.toml`=isort/yapf/ruff、`ros2/.cmake-format` 等)。スクリプトが
  `~/work/.github` にcloneし、`/opt/work/.github` からも参照できるようにする。
  このリポジトリには複製を置かない(二重管理でズレるのを防ぐ。更新は `git -C ~/work/.github pull`)
- **ライセンスヘッダ**: psi-header拡張+`.apache-2` で、新規ソースに
  「Copyright (c) <年> SoftBank Corp. + Apache 2.0本文」のヘッダを挿入できる
  (保存時自動ではなく手動トリガ設定)

## VS Codeの「プロファイル」機能との関係

導入されるのはVS Code標準のプロファイル(Settings → Profiles に「cube-petit-ROS2」が現れる)。
個人設定(デフォルトプロファイル)とは分離されるので、見た目や個人の好みはデフォルト側に
自由に置いてよい。共有設定を更新したいときは `settings.json` を直してこのスクリプトを
再実行する(既存のプロファイル設定は自動バックアップされる)。

## 既知の注意

- `settings.json` が参照する `urdf.xsd` / `sdf.xsd`(URDFのXML検証用スキーマ)は
  sbgisen/.github に現状存在しない。無くても実害はない(XML検証が効かないだけ)
- 個人差が出る設定(テーマ・フォント・キーバインド)は意図的に含めていない
