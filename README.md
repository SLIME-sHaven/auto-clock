# Nueip自動打卡系統

## Version

- **Node.js** v22.13.1

## Config
- **.env** 登入帳密設定檔

```env
NUEIP_USERS=[{"company":"COMP_A","username":"userA","password":"passA"},{"company":"COMP_B","username":"userB","password":"passB"}]
```
- **company** 公司代號
- **username** 登入帳號
- **password** 登入密碼

## Setup

```
yarn install
npx playwright install
```

## Start

```
node main.js
```

## Docker Command 簡易啟用指令

```bash
docker build -t auto-clock:1.0 . // 建置映像檔
docker run --name auto-clock -d auto-clock:1.0 // 啟動容器
docer logs -f auto-clock // 查看容器log

```

## 啟用Telegram功能
若要啟用telegram指令以及打卡消息發送功能。
1. 請於環境設定檔加入telegram機器人token
```env
TELEGRAM_KEY=123456789:ABC-DEF1234ghIkl-zyx57W2L0u
```
2. 伺服器啟動後，於聊天室輸入啟動打卡


### Telegram機器人聊天室添加
1. 於telegram搜尋機器人名稱 BotFather
2. 輸入指令 /newbot
3. 為機器人提供一個名稱（顯示名稱）
4. 為機器人提供一個使用者名稱（必須以 "bot" 結尾）
5. 完成後，BotFather 會提供一個 API Token（請妥善保管，不要分享給他人）

### Telegram指令
- **啟動打卡** 開始啟用Telegram訊息功能
- **我要請假YYYYMMDD** 指定日期不執行打卡
- **我要收回請假YYYYMMDD** 收回"指定日期不執行打卡"
- **幫我打下班卡** 透過系統幫你直接打卡下班
- **幫我打上班卡** 透過系統幫你直接打卡上班
