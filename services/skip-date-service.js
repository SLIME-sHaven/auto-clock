// services/holidayService.js
import fs from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';

// 獲取當前文件的目錄路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 存儲需要跳過打卡的日期
let skipDatesCache = new Set();

/**
 * 將日期範圍字串展開為個別日期陣列
 * 支援單一日期 "20260216" 或日期範圍 "20260216-20260221"
 * @param {string} dateStr 日期字串（YYYYMMDD 或 YYYYMMDD-YYYYMMDD）
 * @returns {string[]} 展開後的日期陣列
 */
function expandDateRange(dateStr) {
    // 檢查是否為日期範圍格式（YYYYMMDD-YYYYMMDD）
    const rangeMatch = dateStr.match(/^(\d{8})-(\d{8})$/);
    if (!rangeMatch) {
        // 單一日期，直接回傳
        return [dateStr];
    }

    const startStr = rangeMatch[1];
    const endStr = rangeMatch[2];
    const startDate = new Date(
        parseInt(startStr.slice(0, 4)),
        parseInt(startStr.slice(4, 6)) - 1,
        parseInt(startStr.slice(6, 8))
    );
    const endDate = new Date(
        parseInt(endStr.slice(0, 4)),
        parseInt(endStr.slice(4, 6)) - 1,
        parseInt(endStr.slice(6, 8))
    );

    const dates = [];
    const current = new Date(startDate);
    while (current <= endDate) {
        const y = current.getFullYear().toString();
        const m = (current.getMonth() + 1).toString().padStart(2, '0');
        const d = current.getDate().toString().padStart(2, '0');
        dates.push(`${y}${m}${d}`);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

/**
 * 解析環境變數 SKIP_DATES，回傳跳過日期的物件陣列
 * 格式：username:YYYYMMDD 或 username:YYYYMMDD-YYYYMMDD，多筆以逗號分隔
 * username 為 * 時代表所有使用者皆適用
 * @returns {{date: string, username: string}[]}
 */
function parseEnvSkipDates() {
    const envValue = process.env.SKIP_DATES;
    if (!envValue || envValue.trim() === '') {
        return [];
    }

    const entries = [];
    const parts = envValue.split(',').map(s => s.trim()).filter(Boolean);

    for (const part of parts) {
        const colonIndex = part.indexOf(':');
        if (colonIndex === -1) {
            console.warn(`SKIP_DATES 格式錯誤，忽略: "${part}"（正確格式: username:YYYYMMDD）`);
            continue;
        }

        const username = part.slice(0, colonIndex).trim();
        const dateStr = part.slice(colonIndex + 1).trim();

        if (!username || !dateStr) {
            console.warn(`SKIP_DATES 格式錯誤，忽略: "${part}"`);
            continue;
        }

        // 展開日期範圍
        const expandedDates = expandDateRange(dateStr);
        for (const date of expandedDates) {
            if (!/^\d{8}$/.test(date)) {
                console.warn(`SKIP_DATES 日期格式錯誤，忽略: "${date}"`);
                continue;
            }
            entries.push({ date, username });
        }
    }

    return entries;
}

// 載入跳過打卡日期（合併 JSON 檔案與環境變數 SKIP_DATES）
export async function loadSkipDates() {
    try {
        // 若快取已有資料，直接回傳
        if (skipDatesCache.size > 0) {
            return skipDatesCache;
        }

        // 從 JSON 檔案讀取
        try {
            const filePath = path.resolve(__dirname, '..', 'contants', 'skip-dates.json');
            const data = await fs.readFile(filePath, 'utf8');
            const parsedData = JSON.parse(data);

            if (Array.isArray(parsedData)) {
                skipDatesCache = new Set(parsedData);
                console.log(`從本地文件載入跳過打卡日期: ${skipDatesCache.size} 筆記錄`);
            }
        } catch (readError) {
            console.log(`讀取本地跳過日期數據失敗: ${readError.message}, 將使用空集合`);
        }

        // 從環境變數 SKIP_DATES 讀取並合併
        const envEntries = parseEnvSkipDates();
        if (envEntries.length > 0) {
            for (const entry of envEntries) {
                skipDatesCache.add(entry);
            }
            console.log(`從環境變數 SKIP_DATES 載入跳過打卡日期: ${envEntries.length} 筆記錄`);
        }

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

        // 檢查日期是否在跳過集合中，並且用戶名匹配（username 為 * 代表所有使用者）
        for (const entry of skipDates) {
            if (typeof entry === 'object' &&
                entry.date === formattedDate &&
                (entry.username === username || entry.username === '*')) {
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
