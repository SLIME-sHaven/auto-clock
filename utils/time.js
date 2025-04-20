export const getRandomTime = (baseHour, baseMinute, rangeInMinutes) => {
    const randomMinutes = Math.floor(Math.random() * rangeInMinutes);
    const date = new Date();
    date.setHours(baseHour);
    date.setMinutes(baseMinute + randomMinutes);
    date.setSeconds(Math.floor(Math.random() * 60)); // 隨機秒數，增加更多變化
    return date;
};
