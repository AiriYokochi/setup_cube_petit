## SETUP_WIFI.md

## TASKS
- Set Wifi Router **SSID** to `cube-petit-wifi`
- Set Wifi Router **PASSWORD** to `cube_petit_wifi`
- Set **IP Adress**
    - Cube petit PC:`192.168.2.101`  
    - Your PC:`192.168.2.102`

---

## Cube petit v2~

### Hardware
- [WRH-583xx2](https://www.biccamera.com/bc/item/3229618/)
- [Manuals](https://www.elecom.co.jp/support/manual/network/wireless-lan/hotel/wrh-583xx2-s/WRH-583xx2_UsersManual_V01.pdf?_ga=2.42861285.1744147222.1575966434-1402647822.1575966434)

### Usage

1. LANと設定したいPCをケーブルで接続
2. Chrome等ブラウザから```192.168.2.1```に接続する
3. 初期ユーザ名は```admin ``` パスは```admin```

### Settings

※設定後、適用を押したあとに毎回更新すると時間がかかるので注意
※PCのターミナルから```ifconfig```コマンドを打ち込みMACアドレスを確認する。
　MACアドレスは数値と小文字アルファベットからなる12文字 ``` 例：HWaddr XX:XX:XX:XX:XX:XX  ```

1. [無線設定]の**2.4GHzを無効**に変更、5GHzを有効に変更
2. [無線設定->5Ghz->基本設定]の**5G SSIDを任意の文字列**に変更 ```例：cube-petit-wifi```
3. [無線設定->5Ghz->暗号化設定]の**暗号キーを任意の文字列**に変更
4. [WAN&LAN設定->LAN設定]の**IPアドレスを任意の数字列**に変更 ```例：192.168.13.1```
5. [WAN&LAN設定->LAN設定->固定DHCP設定]の**固定DHCPの有効**にチェック
6. 5の**IPアドレスに任意のIPアドレス、MACアドレスにPCのMACアドレス、コメントにホストネームを設定**
```例　192.168.13.101  XX:XX:XX:XX:XX:XX <your-pc-name></your-pc-name>```

PC側のネットワーク設定を消してもう一度接続する