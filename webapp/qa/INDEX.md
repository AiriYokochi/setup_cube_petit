# セットアップQ&A集

キューブプチのセットアップ中に実際に詰まった事例を、1問1ファイルの
Markdownで蓄積する場所です。将来、ローカルLLMチャットボット
(`tools/local_llm_lab/ask.py` 方式)の知識源としても使う想定です。

## 一覧

| ファイル | 内容 |
|---|---|
| [ssh-connection-refused.md](ssh-connection-refused.md) | 別PCからのsshが「Connection refused」で拒否される(sshd未起動・ホスト鍵欠落) |
| [setup-stuck-running.md](setup-stuck-running.md) | セットアップWebアプリのステップが「実行中」のまま進まない(ENTER待ち・シリアルopenブロック、現行は修正済み) |
| [chrome-keyring-prompt.md](chrome-keyring-prompt.md) | Chromeを開くとキーリングのパスワードを聞かれる(自動ログインとの相性、v1.0.0以降は対策済み) |
| [anydesk-display-not-supported.md](anydesk-display-not-supported.md) | AnyDeskで「Display server not supported」と出る(Waylandが原因、WaylandEnable=false+再起動で解決) |
| [colcon-build-fails-witmotion.md](colcon-build-fails-witmotion.md) | ビルドがwitmotion_ros/Qt5SerialPortで失敗する(依存インストール順序バグ、現行は自動対処済み) |
| [hostname-vs-robot-name.md](hostname-vs-robot-name.md) | ホスト名と個体名で綴り(ハイフン/アンダースコア)が違うのは正しい?(それぞれ別ルールに従う正常な仕様) |
| [update-notification.md](update-notification.md) | セットアップWebアプリに「更新があります」と出たらどうする?(正常な通知、バナー→アップデート→run.sh再起動→バッジの流れ) |

## 新しいQ&Aの足し方

セットアップ中に新しい詰まりどころが見つかったら、以下の手順で追加してください。

1. `webapp/qa/` に、質問内容が分かる英語スラッグのファイル名で
   `<slug>.md` を新規作成する(例: `wifi-not-connecting.md`)
2. 以下のフォーマットに従って書く

   ```markdown
   # <質問文(利用者の言葉で)>

   - 症状: <何が起きるか>
   - 機種/日付: <確認した機体と日付>

   ## 原因

   <平易に>

   ## 対処

   <コピペで動くコマンド・手順>
   ```

3. 事実は実機での確認・worklog・コミット履歴などの裏取りに基づいて書く。
   すでに直っている不具合は「現行では自動対処済み。古い版や手動セットアップ
   の場合は…」のように、現行版と古い版の対処を書き分ける
4. 日本語で、ロボットに詳しくない利用者にも分かる平易な言葉で書く
5. このINDEX.mdの一覧表にも1行追記する(ファイル名リンク+内容の要約)
