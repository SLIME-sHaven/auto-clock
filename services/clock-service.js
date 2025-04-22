import {getHolidayInfo, isHoliday, isSkipDate} from "./holiday-service.js";
import {getGpsPosition} from "../utils/common.js";
import {sendMessage, sendPhoto} from "./telegram-service.js"
import {chromium} from "@playwright/test";
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

// 從環境變數取得使用者資訊
const users = JSON.parse(process.env.NUEIP_USERS);

console.log(users, '用戶資訊');

const clockSendMessage = async (msg) => {
    const isUseTelegram = global.telegramKey;
    if (!isUseTelegram) return false;
    await sendMessage(msg)
    return true;
}

const clockSendPhoto = async (screenshotPath) => {
    const isUseTelegram = global.telegramKey;
    if (!isUseTelegram) return false;
    const sendSuccess = await sendPhoto(screenshotPath);
    // 成功的話刪除圖片
    if (sendSuccess) {
        await fs.unlink(screenshotPath);
        return true;
    } else {
        return false;
    }
}

const clockAction = async (actionType) => {
    const isClockIn = actionType === 'in';
    const actionName = isClockIn ? '上班' : '下班';
    const buttonIndex = isClockIn ? 0 : 1;

    console.log(`開始執行${actionName}打卡: ${new Date().toLocaleString()}`);
    const today = new Date();
    const holidayCheck = await isHoliday(today);

    if (holidayCheck) {
        const holidayInfo = await getHolidayInfo(today);
        console.log(`今天是假日: ${holidayInfo?.description || '週末'}, 跳過打卡操作`);
        // clockSendMessage(`今天是假日: ${holidayInfo?.description || '週末'}, 跳過打卡操作`);
        return;
    }

    // 檢查今天是否是指定跳過不打卡的日期
    const skipDateCheck = await isSkipDate(today);
    if (skipDateCheck) {
        console.log(`今天是指定跳過打卡的日期: ${today.toISOString().slice(0, 10)}, 跳過打卡操作`);
        clockSendMessage(`今天是指定跳過打卡的日期: ${today.toISOString().slice(0, 10)}, 跳過打卡操作`);
        return;
    }

    // 使用 Playwright 的 chromium 瀏覽器 (已改為 import)
    const browser = await chromium.launch();

    for (const user of users) {
        try {
            let context;
            console.log(`為用戶 ${user.username} 打${actionName}卡`);
            const gpsPosition = user.gpsPosition;
            console.log(gpsPosition !== '' && gpsPosition !== undefined)
            console.log(`GPS 位置: ${gpsPosition}`);
            if (gpsPosition === '' || gpsPosition === undefined || gpsPosition === null) {
                context = await browser.newContext();
                console.log('沒有 GPS 位置，使用預設位置');
            } else {
                const {latitude, longitude} = getGpsPosition(gpsPosition);
                console.log(`GPS 位置: 緯度 ${latitude}, 經度 ${longitude}`);
                context = await browser.newContext({
                    geolocation: {
                        latitude: latitude, // 緯度座標
                        longitude: longitude, // 經度座標
                        accuracy: 100 // 精確度
                    },
                    permissions: ['geolocation']
                });
            }
            // const context = await browser.newContext();

            const page = await context.newPage();

            // 1. 訪問登入頁面
            await page.goto('https://portal.nueip.com/login');

            // 2. 填寫登入表單
            await page.fill('input[name="inputCompany"]', user.company);
            await page.fill('input[name="inputID"]', user.username);
            await page.fill('input[name="inputPassword"]', user.password);

            // 3. 點擊登入按鈕
            await page.click('.login-button');
            console.log(`用戶 ${user.username} 登入`);
            // 4. 等待登入成功
            await page.waitForURL('https://portal.nueip.com/home');
            console.log(`用戶 ${user.username} 登入成功`);
            // 5. 點擊指定的DOM按鈕 (上班卡或下班卡)
            await page.locator('.punch-button').nth(buttonIndex).click();

            // 6. 驗證按鈕點擊是否產生預期結果
            await page.waitForTimeout(3000);
            const hasClass = await page.locator('.punch-button').nth(buttonIndex).evaluate(el => el.classList.contains('is-punched'));
            console.log(`${actionName}卡打卡成功狀態: ${hasClass ? '成功' : '失敗'}`);

            // 7. 截取結果截圖
            const screenshotPath = `clock-${isClockIn ? 'in' : 'out'}-${user.username}-${new Date().toISOString().slice(0, 10)}.png`;
            await page.screenshot({path: screenshotPath});

            // 8. 發送截圖與文字到 Telegram
            const sendSuccess = await clockSendPhoto(screenshotPath);
            // 成功的話刪除圖片
            if (sendSuccess) {
                await clockSendMessage(`${actionName}打卡成功: ${user.username}`);
            } else {
                await clockSendMessage(`${actionName}打卡截圖發送失敗: ${user.username}`);
            }

            await context.close();
        } catch (error) {
            console.error(`用戶 ${user.username} ${actionName}打卡失敗:`, error);
            await clockSendMessage(`${actionName}打卡失敗: ${user.username}`);
        }
    }

    await browser.close();
    console.log(`${actionName}打卡程序完成: ${new Date().toLocaleString()}`);
};

// 上班打卡函數
export const ClockOn = async () => {
    return clockAction('in');
};

// 下班打卡函數
export const ClockOff = async () => {
    return clockAction('out');
};

