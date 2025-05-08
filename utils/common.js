export const getGpsPosition = (positions) => {

    // 1. 使用 split(',') 將字串以逗號分隔成陣列
    // 2. 使用 map(Number) 將每個分割出來的字串轉為數字
    const result = positions.split(',').map(Number);

    return {
        latitude: result[0], // 緯度
        longitude: result[1], // 經度
    };
}

// 新增函數：為GPS座標添加隨機變化（從小數點後第四位開始全部隨機）
export const randomizeGpsCoordinate = (coordinate) => {
    if (!coordinate && coordinate !== 0) return coordinate;

    // 將座標轉換為字串
    let coordStr = coordinate.toString();

    // 檢查是否有小數點
    const decimalIndex = coordStr.indexOf('.');

    // 如果沒有小數點，添加小數點
    if (decimalIndex === -1) {
        coordStr = coordStr + '.';

        // 添加6位隨機小數（3位固定+3位變化）
        let newCoordStr = coordStr;
        for (let i = 0; i < 6; i++) {
            newCoordStr += Math.floor(Math.random() * 10);
        }

        console.log(`無小數點 ${coordinate} -> ${newCoordStr} (添加6位隨機小數)`);
        return parseFloat(newCoordStr);
    }

    // 計算小數點後有幾位數字
    const decimalPlaces = coordStr.length - decimalIndex - 1;

    // 如果小數點後不足3位，補充到3位
    if (decimalPlaces < 3) {
        let newCoordStr = coordStr;
        // 補充隨機數字使其達到3位小數
        for (let i = 0; i < (3 - decimalPlaces); i++) {
            newCoordStr += Math.floor(Math.random() * 10);
        }

        // 再添加3位隨機數字
        for (let i = 0; i < 3; i++) {
            newCoordStr += Math.floor(Math.random() * 10);
        }

        // console.log(`小數點不足3位 ${coordinate} -> ${newCoordStr} (補充至6位)`);
        return parseFloat(newCoordStr);
    }

    // 保留小數點後三位
    let newCoordStr = coordStr.substring(0, decimalIndex + 4);

    // 計算原始座標小數點後第4位開始有多少位數字
    const remainingDigits = coordStr.length - (decimalIndex + 4);

    // 確定需要生成的隨機數字數量（至少3位，或者與原始數量相同，取較大者）
    const randomDigitsCount = Math.max(remainingDigits, 3);

    // 生成隨機數字字串
    for (let i = 0; i < randomDigitsCount; i++) {
        newCoordStr += Math.floor(Math.random() * 10);
    }

    // console.log(`標準情況 ${coordinate} -> ${newCoordStr} (保留3位，第4位開始隨機化，確保至少有${randomDigitsCount}位隨機數字)`);
    return parseFloat(newCoordStr);
};
