import {getHolidayInfo, isHoliday} from './services/holiday-service.js';
const today = new Date();
const holidayCheck = await isHoliday(today);

console.log(`今天 ${today.toLocaleDateString()} 是假日嗎？ ${holidayCheck ? '是' : '否'}`);
getHolidayInfo(today).then(holidayInfo => {
    console.log(`假日資訊: ${holidayInfo ? JSON.stringify(holidayInfo) : '無'}`);
})
