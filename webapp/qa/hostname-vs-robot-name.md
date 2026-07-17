# ホスト名と個体名で綴り(ハイフン/アンダースコア)が違うのは正しい?

- 症状: 同じロボットなのに、PCのホスト名は `cube-petit-yellow`
  (ハイフン区切り)なのに、セットアップ時に指定する個体名(環境変数
  `ROBOT_NAMESPACE`)は `cube_petit_yellow`(アンダースコア区切り)に
  なっていて、打ち間違いかと不安になる
- 機種/日付: cube-petit-yellow / cube-petit-orange(命名規則全般)

## 原因

打ち間違いではなく、**両方とも正しい**書き方です。ハイフンと
アンダースコアが使い分けられているのは、それぞれ別のルールに
従っているためです。

- **PCのホスト名**(`cube-petit-yellow`): 昔からの慣習で、ホスト名には
  ハイフンを使い、アンダースコアは避けるのが一般的です
  (`ssh cube-petit@192.168.128.117` してから `hostname` すると
  この形式で返ってきます)
- **ROS 2の名前空間**(`ROBOT_NAMESPACE=cube_petit_yellow`):
  ROS 2のノード名・名前空間はプログラム上の識別子として扱われるため、
  英数字とアンダースコアしか使えず、**ハイフンは使えません**

つまり「PCとしての名前」と「ROSの世界での名前」で、それぞれの
世界の綴りルールに従って書き分けているだけで、指す個体は同じロボット
です。

## 対処

対処が必要な不具合ではありません。以下の対応関係を覚えておけばOKです。

| 用途 | 綴り | 例 |
|---|---|---|
| PCのホスト名・sshのユーザー@ホスト | ハイフン `-` | `cube-petit-yellow` |
| `ROBOT_NAMESPACE`・ROS 2の名前空間 | アンダースコア `_` | `cube_petit_yellow` |

`setup_bashrc.bash` を実行するときは、個体名の部分をアンダースコアで
指定してください。

```bash
ROBOT_NAMESPACE=cube_petit_yellow ROS_DOMAIN_ID=94 ./setup_bashrc.bash
```
