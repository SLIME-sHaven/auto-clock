export const getGpsPosition = (positions) => {

    // 1. 使用 split(',') 將字串以逗號分隔成陣列
    // 2. 使用 map(Number) 將每個分割出來的字串轉為數字
    const result = positions.split(',').map(Number);

    return {
        latitude: result[0], // 緯度
        longitude: result[1], // 經度
    };
}
