# 別のPCからロボットにsshすると「Connection refused」になる

- 症状: `ssh cube-petit@<ロボットのIP>` すると、待たされずに即座に
  `Connection refused` で拒否される(タイムアウトではない)。pingは通る
- 機種/日付: cube-petit-yellow、2026-07-16

## 原因

`Connection refused` は「相手のPCまでは届いているが、22番ポートで誰も
待ち受けていない」ことを意味します。ロボット側で`sshd`(SSHサーバー)が
起動していないのが原因です。

今回の実例では、ロボット側で `systemctl status ssh` が `failed`、
`journalctl -u ssh` に **no hostkeys available**(`/etc/ssh/ssh_host_*_key`
が存在しない)と出ていました。ホスト鍵がないと sshd は起動できません。

なお「ロボット→自分のPCへのsshは成功する」ことは、ロボット側の
sshdが生きている証拠には**なりません**。sshクライアントとsshサーバーは
別物で、クライアントだけが生きていても発信専用の状態はあり得ます。

## 対処

ロボット本体に直接ログイン(モニタ・キーボードを繋ぐか、既に繋がっている
セッションから)して以下を実行してください。

```bash
# ホスト鍵を再生成
sudo ssh-keygen -A

# sshdを再起動
sudo systemctl restart ssh

# 状態確認
systemctl status ssh
```

`active (running)` になれば、別PCから
`ssh cube-petit@<ロボットのIP>` で接続できるはずです。
