// services/holidayService.js
import fs from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';

// 獲取當前文件的目錄路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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


/**
 * 取得指定使用者的所有請假日期（YYYYMMDD 陣列，已排序）
 * @param {string} username 使用者名稱，必填
 * @returns {Promise<string[]>} e.g. ['20250610', '20250701', ...]
 */
export async function getUserSkipDates(username) {
    if (!username) throw new Error('username 不能為空');

    const skipDates = await loadSkipDates();         // 讀取／快取 skip 集合
    return Array.from(skipDates)                     // Set → Array
        .filter(
            (entry) => typeof entry === 'object' && entry.username === username
        )                                              // 只保留該使用者
        .map((entry) => entry.date)                    // 取出 date 欄位
        .sort();                                       // 依字典序 (= 日期先後) 排序
}
