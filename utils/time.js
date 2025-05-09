export const getRandomTime = (baseHour, baseMinute, rangeInMinutes) => {
    const randomMinutes = Math.floor(Math.random() * rangeInMinutes);
    const date = new Date();
    date.setHours(baseHour);
    date.setMinutes(baseMinute + randomMinutes);
    date.setSeconds(Math.floor(Math.random() * 60)); // 隨機秒數，增加更多變化
    return date;
};

export function parseTimeString(timeString) {
    // 使用冒號分割時間字串
    const [hourStr, minuteStr] = timeString.split(':');

    // 將小時和分鐘轉換為數字，並去除前導零
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    // 返回格式化後的物件
    return {
        hour: hour,
        minute: minute
    };
}
