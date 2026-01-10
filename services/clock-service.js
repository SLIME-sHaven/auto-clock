import {isSkipDate} from "./skip-date-service.js";
import {getCurrentPosition, getGpsPosition, randomizeGpsCoordinate} from "../utils/common.js";
import {sendMessage, sendPhoto} from "./telegram-service.js"
import {chromium} from "@playwright/test";
import dotenv from 'dotenv';
import fs from 'fs/promises';
import {TaiwanHolidayStrategy} from "./strategies/holiday/taiwan.js";
import { BiWeeklySaturdayStrategy } from "./strategies/holiday/biWeekly.js";

dotenv.config();

export const HOLIDAY_STRATEGY_MAP = new Map([
    ['taiwan', new TaiwanHolidayStrategy()],
    ['biWeekly', new BiWeeklySaturdayStrategy('2026-01-10')],
]);


// 從環境變數取得使用者資訊
export const users = JSON.parse(process.env.NUEIP_USERS);
const holidayStrategy = HOLIDAY_STRATEGY_MAP.get(process.env.HOLIDAY_TYPE || 'taiwan');
global.holidayStrategy = holidayStrategy;
const isHolidayFunc = holidayStrategy ? holidayStrategy.checkHoliday.bind(holidayStrategy) : null;
const getHolidayInfo = holidayStrategy ? holidayStrategy.getHolidayInfo.bind(holidayStrategy) : null;

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
const clockForUser = async (user, browser, isClockIn, actionName, buttonIndex, strategy) => {
    let retryCount = 0;
    let success = false;

    while (retryCount < MAX_RETRY_ATTEMPTS && !success) {
        try {
            if (retryCount > 0) {
                console.log(`重試第 ${retryCount} 次為用戶 ${user.username} 打${actionName}卡`);
                await clockSendMessage(`重試第 ${retryCount} 次為用戶 ${user.username} 打${actionName}卡`);
            }

            console.log(`為用戶 ${user.username} 打${actionName}卡`);

            // GPS 設定
            const gpsPosition = getCurrentPosition(user.gpsPosition);
            let context;

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

            // 使用根據依賴的模式執行不同系統的打卡流程
            await strategy.login(page, user);
            console.log(`用戶 ${user.username} 登入成功`);

            await strategy.performClock(page, isClockIn, buttonIndex);

            const hasSuccess = await strategy.verifySuccess(page, isClockIn, buttonIndex);
            console.log(`${actionName}卡打卡成功狀態: ${hasSuccess ? '成功' : '失敗'}`);

            // 截取結果截圖並發送
            const screenshotPath = `clock-${isClockIn ? 'in' : 'out'}-${user.username}-${new Date().toISOString().slice(0, 10)}.png`;
            await page.screenshot({path: screenshotPath});

            // 發送截圖與文字到 Telegram
            const sendSuccess = await clockSendPhoto(screenshotPath);
            // 成功的話發送成功訊息，反之
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


const clockAction = async (actionType, strategy) => {
    const isClockIn = actionType === 'in';
    const actionName = isClockIn ? '上班' : '下班';
    const buttonIndex = isClockIn ? 0 : 1;

    console.log(`開始執行${actionName}打卡: ${new Date().toLocaleString()}`);

    const today = new Date();
    const holidayCheck = await isHolidayFunc(today);
    console.log(`今天是假日: ${holidayCheck}`);

    const isNotSkipWeekendJudge = process.env.SKIP_WEEKEND === 'true';

    // 假日時若設定跳過則直接返回 若設置false則繼續打卡
    if (holidayCheck && !isNotSkipWeekendJudge) {
        const holidayInfo = await getHolidayInfo(today);
        console.log(`今天是假日: ${holidayInfo?.description || '週末'}, 跳過打卡操作`);
        return;
    }

    // 使用 Playwright 的 chromium 瀏覽器
    const browser = await chromium.launch();

    // 記錄成功和失敗的用戶
    const results = { success: [], failure: [] };

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
            const success = await clockForUser(user, browser, isClockIn, actionName, buttonIndex, strategy);

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
export const ClockOn = async (strategy) => {
    return clockAction('in', strategy);
};

// 下班打卡函數
export const ClockOff = async (strategy) => {
    return clockAction('out', strategy);
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
