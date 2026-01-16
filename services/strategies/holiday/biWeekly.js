import { HolidayStrategy } from "./holiday-strategies.js";

let globalStartDate = '2026-01-10';
/**
 * 雙週六假日策略
 * - 每週日都是假日
 * - 從指定的起始週六開始，每隔一週的週六是假日
 */
export class BiWeeklySaturdayStrategy extends HolidayStrategy {
    /**
     * @param {Date|string} startDate 起始週六日期
     */
    constructor(startDate) {
        super();

        if (!startDate) {
            throw new Error('必須提供起始日期');
        }

        // 轉換為 Date 物件
        const date = startDate instanceof Date
            ? startDate
            : new Date(startDate);

        // 驗證是否為週六 (getDay() === 6)
        if (date.getDay() !== 6) {
            throw new Error('起始日期必須是週六');
        }

        // 儲存起始日期（設為當天的00:00:00以便比較）
        this.startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        globalStartDate = this._formatDate(this.startDate);
        console.log(`雙週六假日策略起始日期設定為: ${this.startDate}`);
        console.log(globalStartDate, 'globalStartDate');
    }

    /**
     * 檢查指定日期是否為假日
     * @param {Date} date 要檢查的日期
     * @returns {Promise<boolean>} 是否為假日
     */
    async checkHoliday(date) {
        const dayOfWeek = date.getDay();
        console.log(`檢查日期: ${date.toDateString()}，星期: ${dayOfWeek}`);

        // 週日永遠是假日
        if (dayOfWeek === 0) {
            return true;
        }

        // 檢查週六是否為假日
        if (dayOfWeek === 6) {
            console.log('是否為假日',this._isSaturdayHoliday(date));
            return this._isSaturdayHoliday(date);
        }

        return false;
    }

    /**
     * 檢查指定的週六是否為假日
     * @param {Date} date 週六日期
     * @returns {boolean} 是否為假日
     * @private
     */
    _isSaturdayHoliday(date) {
        // 計算與起始日期相差的天數
        console.log(this._formatDate(date), '_formatDate(date) in func');
        // 如果起始日期是當天，則為假日
        if(globalStartDate === this._formatDate(date)) return true;
        const startDate = new Date(globalStartDate);
        console.log(startDate, 'startDate in func');
        const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffTime = checkDate.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // 計算相差幾週
        const diffWeeks = Math.floor(diffDays / 7);
        console.log(diffWeeks, 'diffWeeks');
        console.log('_isSaturdayHoliday 為true則為假日', diffWeeks % 2 === 0)
        console.log(diffWeeks % 2, 'diffWeeks % 2');

        // 如果相差的週數是偶數，則為假日
        return diffWeeks % 2 === 0;
    }

    /**
     * 獲取假日信息
     * @param {Date} date 要檢查的日期
     * @returns {Promise<Object|null>} 假日信息或null
     */
    async getHolidayInfo(date) {
        const isHoliday = await this.checkHoliday(date);

        if (!isHoliday) {
            return null;
        }

        const dayOfWeek = date.getDay();

        if (dayOfWeek === 0) {
            return {
                date: this._formatDate(date),
                name: '週日',
                isHoliday: true,
                description: '每週日固定假日'
            };
        }

        if (dayOfWeek === 6) {
            return {
                date: this._formatDate(date),
                name: '雙週週六',
                isHoliday: true,
                description: '雙週週六假日'
            };
        }

        return null;
    }

    /**
     * 格式化日期為 YYYY-MM-DD
     * @param {Date} date 日期
     * @returns {string} 格式化的日期字串
     * @private
     */
    _formatDate(date) {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }

    changeStartDate(newStartDate) {
        const date = newStartDate instanceof Date
            ? newStartDate
            : new Date(newStartDate);

        if (date.getDay() !== 6) {
            throw new Error('起始日期必須是週六');
        }

        this.startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
}
