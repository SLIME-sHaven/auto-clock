// 使用 ES Module 語法 (import)
import cron from 'node-cron';
import {getRandomTime, parseTimeString} from "./utils/time.js";
import {ClockOn, ClockOff} from "./services/clock-service.js"
import startTelegramService, {sendMessage, setScheduleText} from './services/telegram-service.js';
import dotenv from 'dotenv';
dotenv.config();

const clockInTime = process.env.WORK_START_TIME || '08:50'; // 上班打卡時間
const clockOutTime = process.env.WORK_END_TIME || '18:00'; // 下班打卡時間
const formatClockInTime = parseTimeString(clockInTime);
const formatClockOutTime = parseTimeString(clockOutTime);
const { hour:defaultStartHour, minute:defaultStartMin } = formatClockInTime;
const { hour:defaultEndHour, minute:defaultEndMin } = formatClockOutTime;


let todayClockInTimeText = ""
let todayClockOutTimeText = ""

let rangeMinutes = Number(JSON.parse(process.env.RANGE_MIN)) || 10; // 隨機時間範圍 (分鐘)
let startHour = defaultStartHour;
let startMin = defaultStartMin;
let endHour = defaultEndHour;
let endMin = defaultEndMin;

const setOutTime = (outTime) => {
    const formatClockOutTime = parseTimeString(outTime);
    const { hour:setEndHour, minute:setEndMin } = formatClockOutTime;
    endHour = setEndHour;
    endMin = setEndMin;
    // 根據新的下班時間重新設置排程
    setupDailySchedules();
}

const setInTime = (inTime) => {
    const formatClockInTime = parseTimeString(inTime);
    const { hour:setStartHour, minute:setStartMin } = formatClockInTime;
    startHour = setStartHour;
    startMin = setStartMin;
    // 根據新的上班時間重新設置排程
    setupDailySchedules();
}

const setRangeMinutes = (range) => {
    rangeMinutes = Number(range);
    // 根據新的隨機時間範圍重新設置排程
    setupDailySchedules();
}

// 根據隨機時間設置排程
const scheduleWithRandomTime = (baseHour, baseMinute, rangeInMinutes, jobFunction, isIn) => {
    const randomTime = getRandomTime(baseHour, baseMinute, rangeInMinutes);
    const cronTime = `${randomTime.getSeconds()} ${randomTime.getMinutes()} ${randomTime.getHours()} * * *`; // 每天都跑
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

    // 設置今天的隨機上班打卡時間 (預設是8:50-9:00 之間)
    global.clockInJob = scheduleWithRandomTime(startHour, startMin, rangeMinutes, () => {
        ClockOn().catch(err => console.error('上班打卡執行錯誤:', err));
    }, true);

    // 設置今天的隨機下班打卡時間 (預設是18:00-18:10 之間)
    global.clockOutJob = scheduleWithRandomTime(endHour, endMin, rangeMinutes, () => {
        ClockOff().catch(err => console.error('下班打卡執行錯誤:', err));
    }, false);

    sendMessage(
        `已設置今天的排程打卡時間 (${new Date().toLocaleDateString()})\n今天的上班打卡時間: ${todayClockInTimeText}\n下班打卡時間: ${todayClockOutTimeText}\n僅僅設置排程，假日與請假判斷依照各個用戶`
    )
    setScheduleText(
        `今天的上班打卡時間: ${todayClockInTimeText}\n下班打卡時間: ${todayClockOutTimeText}`
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
if (process.env.TELEGRAM_KEY) {
    startTelegramService();
    global.telegramKey = process.env.TELEGRAM_KEY;
}

console.log('打卡排程已啟動，等待執行中...');
console.log(`上班打卡時間範圍: 週一至週五 早上 ${startHour}:${startMin}+-${rangeMinutes} 特殊：假日的補班日會打卡、國定假日則不會打卡`);
console.log(`下班打卡時間範圍: 週一至週五 晚上 ${endHour}:${endMin}+-${rangeMinutes} 特殊：假日的補班日會打卡、國定假日則不會打卡`);

export { setInTime, setOutTime, setRangeMinutes }
