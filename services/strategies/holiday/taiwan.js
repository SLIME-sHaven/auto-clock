// services/holidayService.js
import fs from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';
import {HolidayStrategy} from "./holiday-strategies.js";

// 獲取當前文件的目錄路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 存儲假日數據的變量，使用Map按年份存儲
let holidayDataCache = new Map();

/**
 * 載入假日數據
 * @param {number} year 年份，默認為當前年份
 * @returns {Promise<Array>} 假日數據
 */
export async function loadHolidayData(year = new Date().getFullYear()) {
    try {
        // 檢查緩存中是否已有該年份的數據
        if (holidayDataCache.has(year)) {
            return holidayDataCache.get(year);
        }

        // 先嘗試從網路API獲取數據
        try {
            const apiUrl = `https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`;
            const response = await fetch(apiUrl);

            if (response.ok) {
                const data = await response.json();
                console.log(`從API成功獲取${year}年假日數據`);

                // 緩存數據
                holidayDataCache.set(year, data);
                return data;
            } else {
                console.log(`API請求失敗: ${response.status}, 將使用本地數據`);
            }
        } catch (fetchError) {
            console.log(`從API獲取數據失敗: ${fetchError.message}, 將使用本地數據`);
        }

        // 如果網路獲取失敗，則從本地文件讀取
        // 使用動態的年份構建文件名
        const fileName = `day.${year}.json`;
        const filePath = path.resolve(__dirname, '..', 'contants', fileName);

        try {
            const data = await fs.readFile(filePath, 'utf8');
            const parsedData = JSON.parse(data);
            console.log(`從本地成功載入${year}年假日數據`);

            // 緩存數據
            holidayDataCache.set(year, parsedData);
            return parsedData;
        } catch (readError) {
            console.error(`讀取本地假日數據失敗: ${readError.message}`);

            // 如果是2025年且本地數據不存在，嘗試使用2025年的固定路徑
            if (year === 2025) {
                try {
                    const fallbackPath = path.resolve(__dirname, '..', 'contants', 'day.2025.json');
                    const fallbackData = await fs.readFile(fallbackPath, 'utf8');
                    const parsedFallbackData = JSON.parse(fallbackData);
                    console.log('從備用路徑載入2025年假日數據');

                    // 緩存數據
                    holidayDataCache.set(year, parsedFallbackData);
                    return parsedFallbackData;
                } catch (fallbackError) {
                    console.error('從備用路徑載入失敗:', fallbackError);
                }
            }

            // 都失敗則返回空數組
            holidayDataCache.set(year, []);
            return [];
        }
    } catch (error) {
        console.error('載入假日數據失敗:', error);
        return [];
    }
}

/**
 * 檢查指定日期是否為假日
 * @param {Date} date 要檢查的日期
 * @returns {Promise<boolean>} 是否為假日
 */
export async function isHoliday(date) {
    try {
        const year = date.getFullYear();
        const holidays = await loadHolidayData(year);

        // 格式化日期為 "YYYYMMDD" 格式
        const formattedDate = year.toString() +
            (date.getMonth() + 1).toString().padStart(2, '0') +
            date.getDate().toString().padStart(2, '0');

        // 在假日數據中查找
        const foundHoliday = holidays.find(h => h.date === formattedDate && h.isHoliday === true);

        return !!foundHoliday;
    } catch (error) {
        console.error('檢查假日失敗:', error);
        return false;
    }
}

/**
 * 獲取指定日期的假日信息（如果有）
 * @param {Date} date 要檢查的日期
 * @returns {Promise<Object|null>} 假日信息或null
 */
export async function getHolidayInfo(date) {
    try {
        const year = date.getFullYear();
        const holidays = await loadHolidayData(year);

        // 格式化日期為 "YYYYMMDD" 格式
        const formattedDate = year.toString() +
            (date.getMonth() + 1).toString().padStart(2, '0') +
            date.getDate().toString().padStart(2, '0');

        // 在假日數據中查找
        return holidays.find(h => h.date === formattedDate) || null;
    } catch (error) {
        console.error('獲取假日信息失敗:', error);
        return null;
    }
}

export class TaiwanHolidayStrategy extends HolidayStrategy{
    async checkHoliday(date) {
        return await isHoliday(date);
    }

    async getHolidayInfo(date) {
        return await getHolidayInfo(date);
    }
}
