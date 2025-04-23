// // import useTelegram from './services/telegram-service.js';
// // import { isSkipClock } from "./services/holiday-service.js";
// //
// // // useTelegram();
// // const day = new Date('2025-05-01');
// // isSkipClock(day).then(res => {
// //     console.log(res, '是否跳過打卡');
// // })
//
// import dotenv from 'dotenv';
// dotenv.config();
//
// const rangeMinutes = Number(JSON.parse(process.env.RANGE_MIN)) || 5; // 隨機時間範圍 (分鐘)
// console.log(rangeMinutes, '隨機時間範圍');

import { ClockOff } from "./services/clock-service.js";

ClockOff();
