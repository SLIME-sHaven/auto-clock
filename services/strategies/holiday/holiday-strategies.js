export class HolidayStrategy {
    async checkHoliday(date) {
        throw new Error('必須實作 checkHoliday 方法');
    }

    async getHolidayInfo(date) {
        throw new Error('必須實作 getHolidayInfo 方法');
    }
}
