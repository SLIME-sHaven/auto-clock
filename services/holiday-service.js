// services/holidayService.js
import fs from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';

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

// 存儲需要跳過打卡的日期
let skipDatesCache = new Set();

// Modified loadSkipDates function to handle the new format
export async function loadSkipDates() {
    try {
        // If cache already has data, return directly
        if (skipDatesCache.size > 0) {
            return skipDatesCache;
        }

        // Read skip dates from local file
        try {
            const filePath = path.resolve(__dirname, '..', 'contants', 'skip-dates.json');
            const data = await fs.readFile(filePath, 'utf8');
            const parsedData = JSON.parse(data);

            if (Array.isArray(parsedData)) {
                skipDatesCache = new Set(parsedData);
                console.log(`從本地文件載入跳過打卡日期: ${skipDatesCache.size} 筆記錄`);
                return skipDatesCache;
            }
        } catch (readError) {
            console.log(`讀取本地跳過日期數據失敗: ${readError.message}, 將使用空集合`);
        }

        // If no data found, return empty set
        return skipDatesCache;
    } catch (error) {
        console.error('載入跳過日期數據失敗:', error);
        return new Set();
    }
}

/**
 * 檢查指定日期和用戶是否為需要跳過打卡的日期
 * @param {Date} date 要檢查的日期
 * @param {string} username 用戶名
 * @returns {Promise<boolean>} 是否需要跳過打卡
 */
export async function isSkipDate(date, username = '') {
    try {
        const skipDates = await loadSkipDates();

        // 格式化日期為 "YYYYMMDD" 格式
        const formattedDate = date.getFullYear().toString() +
            (date.getMonth() + 1).toString().padStart(2, '0') +
            date.getDate().toString().padStart(2, '0');

        // 檢查日期是否在跳過集合中，並且用戶名匹配
        for (const entry of skipDates) {
            if (typeof entry === 'object' &&
                entry.date === formattedDate &&
                entry.username === username) {
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('檢查跳過日期失敗:', error);
        return false;
    }
}

/**
 * 添加一個新的跳過日期
 * @param {string} dateString 日期字符串 (YYYYMMDD)
 * @param {string} username 用戶名
 * @returns {Promise<boolean>} 操作是否成功
 */
export async function addSkipDate(dateString, username = '') {
    try {
        // 驗證日期格式 (YYYYMMDD)
        if (!/^\d{8}$/.test(dateString)) {
            return false;
        }

        const skipDates = await loadSkipDates();

        // 檢查是否已經存在相同的記錄
        for (const entry of skipDates) {
            if (typeof entry === 'object' &&
                entry.date === dateString &&
                entry.username === username) {
                console.log(`跳過打卡日期已存在: ${dateString} 用戶: ${username}`);
                return true; // 已存在，視為成功
            }
        }

        // 添加新記錄
        const newEntry = {
            username: username,
            date: dateString
        };

        skipDates.add(newEntry);
        skipDatesCache = skipDates;

        // 將更新後的集合保存到文件
        const filePath = path.resolve(__dirname, '..', 'contants', 'skip-dates.json');
        await fs.writeFile(filePath, JSON.stringify(Array.from(skipDates)), 'utf8');

        console.log(`已添加跳過打卡日期: ${dateString} 用戶: ${username}`);
        return true;
    } catch (error) {
        console.error('添加跳過日期失敗:', error);
        return false;
    }
}

/**
 * 移除特定的跳過打卡日期
 * @param {string} dateString 日期字符串 (YYYYMMDD)
 * @param {string} username 用戶名
 * @returns {Promise<boolean>} 操作是否成功
 */
export async function removeSkipDate(dateString, username = '') {
    try {
        // 驗證日期格式 (YYYYMMDD)
        if (!/^\d{8}$/.test(dateString)) {
            return false;
        }

        const skipDates = await loadSkipDates();
        let entryToRemove = null;

        // 查找要刪除的記錄
        for (const entry of skipDates) {
            if (typeof entry === 'object' &&
                entry.date === dateString &&
                entry.username === username) {
                entryToRemove = entry;
                break;
            }
        }

        // 檢查記錄是否存在
        if (!entryToRemove) {
            console.log(`日期 ${dateString} 用戶 ${username} 不在跳過打卡列表中`);
            return false;
        }

        // 從集合中移除該記錄
        skipDates.delete(entryToRemove);
        skipDatesCache = skipDates;

        // 將更新後的集合保存到文件
        const filePath = path.resolve(__dirname, '..', 'contants', 'skip-dates.json');
        await fs.writeFile(filePath, JSON.stringify(Array.from(skipDates)), 'utf8');

        console.log(`已移除跳過打卡日期: ${dateString} 用戶: ${username}`);
        return true;
    } catch (error) {
        console.error('移除跳過日期失敗:', error);
        return false;
    }
}

// 更新 isSkipClock 函數以包含 username 參數
export const isSkipClock = async (date, username = '') => {
    const isCurrentSkipDate = await isSkipDate(date, username);
    const isCurrentHoliday = await isHoliday(date);
    return isCurrentSkipDate || isCurrentHoliday;
}
