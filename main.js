// 使用 ES Module 語法 (import)
import dotenv from 'dotenv';
import { chromium } from '@playwright/test';
import cron from 'node-cron';

// 載入環境變數
dotenv.config();

// 從環境變數取得使用者資訊
const users = JSON.parse(process.env.NUEIP_USERS);

console.log(users, '用戶資訊');


const clockAction = async (actionType) => {
    const isClockIn = actionType === 'in';
    const actionName = isClockIn ? '上班' : '下班';
    const buttonIndex = isClockIn ? 0 : 1;

    console.log(`開始執行${actionName}打卡: ${new Date().toLocaleString()}`);

    // 使用 Playwright 的 chromium 瀏覽器 (已改為 import)
    const browser = await chromium.launch();

    for (const user of users) {
        try {
            console.log(`為用戶 ${user.username} 打${actionName}卡`);
            const context = await browser.newContext();
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
            await page.screenshot({ path: `clock-${isClockIn ? 'in' : 'out'}-${user.username}-${new Date().toISOString().slice(0, 10)}.png` });

            await context.close();
        } catch (error) {
            console.error(`用戶 ${user.username} ${actionName}打卡失敗:`, error);
        }
    }

    await browser.close();
    console.log(`${actionName}打卡程序完成: ${new Date().toLocaleString()}`);
};

// 上班打卡函數
const ClockOn = async () => {
    return clockAction('in');
};

// 下班打卡函數
const ClockOff = async () => {
    return clockAction('out');
};

// 設置定時任務 - 每週一到週五的早上8:50執行上班打卡
cron.schedule('50 8 * * 1-5', () => {
    ClockOn().catch(err => console.error('上班打卡執行錯誤:', err));
}, {
    timezone: "Asia/Taipei" // 設置為台灣時區
});

// 設置定時任務 - 每週一到週五的晚上18:00執行下班打卡
cron.schedule('0 18 * * 1-5', () => {
    ClockOff().catch(err => console.error('下班打卡執行錯誤:', err));
}, {
    timezone: "Asia/Taipei" // 設置為台灣時區
});

console.log('打卡排程已啟動，等待執行中...');
console.log('上班打卡時間: 週一至週五 早上 08:50');
console.log('下班打卡時間: 週一至週五 晚上 18:00');

// 測試打卡功能區塊
// ClockOn();
// ClockOff();
