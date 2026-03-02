# Nueip自動打卡系統

## Version

- **Node.js** v22.13.1

## Config
- **.env** 登入帳密設定檔

```env
NUEIP_USERS=[{"company":"COMP_A","username":"userA","password":"passA","gpsPosition":"24.1785068,120.6720471"},{"company":"COMP_B","username":"userB","password":"passB","gpsPosition":"24.1785068,120.6720471"}]
TELEGRAM_KEY=123456789:ABC-DEF1234ghIkl-zyx57W2L0u
RANGE_MIN=10
# 聊天室ID 沒有則為空字串
CHAT_ID=123456789
# 上班打卡時間
WORK_START_TIME=08:50
# 下班打卡時間
WORK_END_TIME=18:00
```
### NUEIP_USERS
- **company** 公司代號
- **username** 登入帳號
- **password** 登入密碼
- **gpsPosition** 打卡位置緯度與經度
  可以直接輸入經緯度字串，或者是傳入陣列
  陣列會根據索引值決定當日打卡位置，例如週一就是0，週二則是1，依此類推
  - **週一到週五的打卡地點各別設置：** ['24.1785068,120.6720471', '24.1785068,120.6720471', '25.1785068,121.6720471', '24.1785068,120.6720471', '24.1785068,120.6720471']
  - **固定打卡地點：** 24.1785068,120.6720471

### TELEGRAM_KEY
telegram機器人Key

### RANGE_MIN
打卡時間分鐘的隨機range範圍

### CHAT_ID
telegram訊息發送聊天室ID
不填會抓機器人預設的聊天室ID
### WORK_START_TIME && WORK_END_TIME
上班打卡時間與下班打卡時間

### SKIP_DATES
指定跳過打卡的日期，可在 `.env` 中預先設定，與 `contants/skip-dates.json` 的資料會合併使用。

**格式：** `username:YYYYMMDD`，多筆以逗號分隔

**支援功能：**
- **指定使用者：** `bonnie:20260216` 僅 bonnie 在該日跳過打卡
- **所有使用者：** `*:20260216` 所有使用者在該日跳過打卡
- **日期範圍：** `*:20260216-20260221` 所有使用者在 2/16 ~ 2/21 期間跳過打卡
- **混合使用：** `*:20260216-20260221,bonnie:20260301`

```env
# 所有使用者 2/16 ~ 2/21 不打卡
SKIP_DATES="*:20260216-20260221"

# 多筆混合設定
SKIP_DATES="*:20260216-20260221,bonnie:20260301,userA:20260305"
```

### HOLIDAY_TYPE
假日判斷策略，決定系統如何判定某天是否為假日。

| 值 | 說明 |
|---|---|
| `taiwan` | 使用台灣行事曆 API 判斷國定假日與週末 |
| `biWeekly` | 雙週六假日策略（每週日放假 + 隔週六放假） |

```env
HOLIDAY_TYPE="biWeekly"
```

### BIWEEKLY_START_DATE
當 `HOLIDAY_TYPE` 設為 `biWeekly` 時必須設定。指定一個**放假的週六**作為起始日期，系統會以此日期為基準，每隔一週的週六判定為假日。

- 格式：`YYYY-MM-DD`
- 必須為**週六**，否則啟動時會報錯
- 該日期本身為放假日，下一個週六則為上班日，以此交替

```env
BIWEEKLY_START_DATE="2026-03-08"
```

**範例（起始日 2026-03-08）：**

| 日期 | 星期 | 結果 |
|------|------|------|
| 03/08 | 六 | 放假 |
| 03/15 | 六 | 上班 |
| 03/22 | 六 | 放假 |
| 03/29 | 六 | 上班 |

### SKIP_WEEKEND
是否跳過假日判斷，設為 `true` 時即使是假日也會執行打卡。

```env
SKIP_WEEKEND="false"
```

### WORK_TIMEZONE
排程與打卡使用的時區，預設為 `Asia/Taipei`。

```env
WORK_TIMEZONE="Asia/Tokyo"
```

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
docker run -d --name auto-clock-container --restart always auto-clock:1.0 // 啟動容器並設定自動重啟
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
- **我要請假YYYYMMDD,username** 指定帳號於指定日期不執行打卡
- **我要收回請假YYYYMMDD,username** 收回"指定帳號於指定日期不執行打卡"
- **幫我打下班卡** 透過系統幫你直接打卡下班
- **幫我打上班卡** 透過系統幫你直接打卡上班
- **今日時程** 查看今日打卡時程安排
