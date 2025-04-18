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
