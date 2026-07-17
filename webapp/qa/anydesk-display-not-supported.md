# AnyDeskで「Display server not supported」と出て遠隔サポートを受けられない

- 症状: ロボットにAnyDeskを入れて遠隔サポートを受けようとすると、
  AnyDesk側の画面に「Display server not supported」と表示され、
  接続しても画面が見えない
- 機種/日付: cube-petit-orange / cube-petit-yellow、AnyDeskオプション導入時

## 原因

ロボットのUbuntuは既定でWayland(画面表示の新しい方式)を使っています。
AnyDeskはWaylandでの画面受信に対応しておらず、Xorg(従来方式)でないと
遠隔から画面を見ることができません。

## 対処

**開発ツールステップの「AnyDesk (リモートサポート)」を有効にすると
自動で対処されます**。`setup_pc.bash` がGDMの設定に
`WaylandEnable=false` を書き込み、次回の再起動からXorgでログインする
ようになります(AnyDeskのopt-inはデフォルトOFFです。サポートを受ける
予定がある人だけONにしてください)。

手動で直す場合は以下を実行し、**再起動**してください(次回ログインから
反映されます)。

```bash
sudo sed -i '/^\[daemon\]/a WaylandEnable=false' /etc/gdm3/custom.conf

# 反映には再起動が必要
sudo reboot
```

再起動後、AnyDeskで再接続すれば画面が表示されるはずです。

補足: AnyDeskの運用方針は「画面での都度承認のみ・無人アクセス用の
パスワードは設定しない」です。常設の遠隔アクセス権は作らない前提なので、
サポートが不要になったらAnyDeskのチェックを外して再セットアップしても
構いません。
