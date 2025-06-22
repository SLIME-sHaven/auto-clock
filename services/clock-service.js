import {getHolidayInfo, isHoliday, isSkipDate} from "./holiday-service.js";
import {getCurrentPosition, getGpsPosition, randomizeGpsCoordinate} from "../utils/common.js";
import {sendMessage, sendPhoto} from "./telegram-service.js"
import {chromium} from "@playwright/test";
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

// 從環境變數取得使用者資訊
export const users = JSON.parse(process.env.NUEIP_USERS);

// 設置重試次數（可以從環境變數讀取或設為常數）
const MAX_RETRY_ATTEMPTS = parseInt(process.env.MAX_RETRY_ATTEMPTS || '3');

console.log(users, '用戶資訊');
console.log(`最大重試次數: ${MAX_RETRY_ATTEMPTS}`);

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

// 為單個用戶執行打卡操作的函數
const clockForUser = async (user, browser, isClockIn, actionName, buttonIndex) => {
    let retryCount = 0;
    let success = false;

    while (retryCount < MAX_RETRY_ATTEMPTS && !success) {
        try {
            if (retryCount > 0) {
                console.log(`重試第 ${retryCount} 次為用戶 ${user.username} 打${actionName}卡`);
                await clockSendMessage(`重試第 ${retryCount} 次為用戶 ${user.username} 打${actionName}卡`);
            }

            let context;
            console.log(`為用戶 ${user.username} 打${actionName}卡`);
            const gpsPosition = getCurrentPosition(user.gpsPosition);
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
                        latitude: randomizeGpsCoordinate(latitude), // 緯度座標
                        longitude: randomizeGpsCoordinate(longitude), // 經度座標
                        accuracy: 100 // 精確度
                    },
                    permissions: ['geolocation']
                });
            }

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
            success = true; // 標記操作成功
        } catch (error) {
            retryCount++;
            console.error(`用戶 ${user.username} ${actionName}打卡失敗 (嘗試 ${retryCount}/${MAX_RETRY_ATTEMPTS}):`, error);
            await clockSendMessage(`${actionName}打卡失敗 (嘗試 ${retryCount}/${MAX_RETRY_ATTEMPTS}): ${user.username}`);

            // 如果已經達到最大重試次數，則記錄最終失敗
            if (retryCount >= MAX_RETRY_ATTEMPTS) {
                console.error(`用戶 ${user.username} ${actionName}打卡在 ${MAX_RETRY_ATTEMPTS} 次嘗試後失敗`);
                await clockSendMessage(`用戶 ${user.username} ${actionName}打卡在 ${MAX_RETRY_ATTEMPTS} 次嘗試後失敗`);
            } else {
                // 等待一段時間再重試
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }

    return success;
};

const clockAction = async (actionType) => {
    const isClockIn = actionType === 'in';
    const actionName = isClockIn ? '上班' : '下班';
    const buttonIndex = isClockIn ? 0 : 1;
    console.log(`開始執行${actionName}打卡: ${new Date().toLocaleString()}`);
    const today = new Date();
    const holidayCheck = await isHoliday(today);

    // 假日就全部用戶不打卡
    if (holidayCheck) {
        const holidayInfo = await getHolidayInfo(today);
        console.log(`今天是假日: ${holidayInfo?.description || '週末'}, 跳過打卡操作`);
        // clockSendMessage(`今天是假日: ${holidayInfo?.description || '週末'}, 跳過打卡操作`);
        return;
    }

    // 使用 Playwright 的 chromium 瀏覽器 (已改為 import)
    const browser = await chromium.launch();

    // 記錄成功和失敗的用戶
    const results = {
        success: [],
        failure: []
    };

    for (const user of users) {
        try {
            // 檢查今天指定用戶是否不打卡
            const skipDateCheck = await isSkipDate(today, user.username);
            if (skipDateCheck) {
                console.log(`今天是指定跳過打卡的日期: ${today.toISOString().slice(0, 10)}, 跳過打卡操作`);
                await clockSendMessage(`今天是指定跳過打卡的日期: ${today.toISOString().slice(0, 10)}, 跳過打卡操作`);
                continue;
            }

            // 執行打卡並處理重試邏輯
            const success = await clockForUser(user, browser, isClockIn, actionName, buttonIndex);

            if (success) {
                results.success.push(user.username);
            } else {
                results.failure.push(user.username);
            }
        } catch (error) {
            console.error(`用戶 ${user.username} 的處理過程中發生意外錯誤:`, error);
            await clockSendMessage(`用戶 ${user.username} 的處理過程中發生意外錯誤: ${error.message}`);
            results.failure.push(user.username);
        }
    }

    await browser.close();

    console.log(`${actionName}打卡程序完成: ${new Date().toLocaleString()}`);
    console.log(`成功: ${results.success.join(', ') || '無'}`);
    console.log(`失敗: ${results.failure.join(', ') || '無'}`);

    // 發送摘要訊息
    if (results.success.length > 0 || results.failure.length > 0) {
        let summaryMsg = `${actionName}打卡摘要:\n`;
        if (results.success.length > 0) {
            summaryMsg += `✅ 成功: ${results.success.join(', ')}\n`;
        }
        if (results.failure.length > 0) {
            summaryMsg += `❌ 失敗: ${results.failure.join(', ')}`;
        }
        await clockSendMessage(summaryMsg);
    }
};

// 上班打卡函數
export const ClockOn = async () => {
    return clockAction('in');
};

// 下班打卡函數
export const ClockOff = async () => {
    return clockAction('out');
};

export const setAssginUserData = (username,key,value) => {
    const userData = users.find(user => user.username === username);
    const userIndex = users.findIndex(user => user.username === username);
    if (userData) {
        userData[key] = value;
        users[userIndex] = userData; // 更新用戶數據
        // 將更新後的用戶數據寫回環境變數
        process.env.NUEIP_USERS = JSON.stringify(users);
        console.log(`已更新 ${username} 的 ${key} 為 ${value}`);
        return true;
    } else {
        console.error(`找不到用戶 ${username}`);
        return false;
    }
}
