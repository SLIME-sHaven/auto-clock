// 使用 ES Module 語法 (import)
import cron from 'node-cron';
import {getRandomTime} from "./utils/time.js";
import {ClockOn, ClockOff} from "./services/clock-service.js"
import startTelegramService, {sendMessage} from './services/telegram-service.js';
import {isHoliday} from "./services/holiday-service.js";
import dotenv from 'dotenv';

let todayClockInTimeText = ""
let todayClockOutTimeText = ""


// 根據隨機時間設置排程
const scheduleWithRandomTime = (baseHour, baseMinute, rangeInMinutes, jobFunction, isIn) => {
    const randomTime = getRandomTime(baseHour, baseMinute, rangeInMinutes);
    const cronTime = `${randomTime.getSeconds()} ${randomTime.getMinutes()} ${randomTime.getHours()} * * 1-5`;

    console.log(`排程設置為: ${randomTime.toLocaleTimeString()} (${cronTime})`);
    if (isIn) {
        todayClockInTimeText = randomTime.toLocaleTimeString()
    } else {
        todayClockOutTimeText = randomTime.toLocaleTimeString()
    }
    return cron.schedule(cronTime, jobFunction, {
        timezone: "Asia/Taipei"
    });
};

// 主函數 - 每天重新設置隨機排程
const setupDailySchedules = async () => {
    // 清除前一天的排程
    if (global.clockInJob) global.clockInJob.stop();
    if (global.clockOutJob) global.clockOutJob.stop();

    // 設置今天的隨機上班打卡時間 (8:50-9:00 之間)
    global.clockInJob = scheduleWithRandomTime(8, 50, 10, () => {
        ClockOn(users).catch(err => console.error('上班打卡執行錯誤:', err));
    }, true);

    // 設置今天的隨機下班打卡時間 (18:00-18:10 之間)
    global.clockOutJob = scheduleWithRandomTime(18, 0, 10, () => {
        ClockOff(users).catch(err => console.error('下班打卡執行錯誤:', err));
    }, false);

    // 假日不發送訊息 因為不打卡
    const today = new Date();
    const holidayCheck = await isHoliday(today);
    if (holidayCheck) return
    sendMessage(
        `已設置今天的隨機打卡時間 (${new Date().toLocaleDateString()})\n今天的上班打卡時間: ${todayClockInTimeText}\n下班打卡時間: ${todayClockOutTimeText}`
    )
    console.log(`已設置今天的隨機打卡時間 (${new Date().toLocaleDateString()})`);
};

// 每天凌晨重新設置隨機排程
cron.schedule('0 0 * * *', setupDailySchedules, {
    timezone: "Asia/Taipei"
});

// 程式啟動時立即設置今天的排程
setupDailySchedules();

// 有telegram key的話就啟動telegram服務
if(process.env.TELEGRAM_KEY) {
    startTelegramService();
    global.telegramKey = process.env.TELEGRAM_KEY;
}

console.log('打卡排程已啟動，等待執行中...');
console.log('上班打卡時間範圍: 週一至週五 早上 08:50 ~ 09:00');
console.log('下班打卡時間範圍: 週一至週五 晚上 18:00 ~ 18:10');

// 測試打卡功能區塊
// ClockOn();
// ClockOff();
