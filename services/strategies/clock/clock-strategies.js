// 定義打卡模式的介面(interface)
export class ClockStrategy {
    async login(page, user) {
        throw new Error('必須實作 login 方法');
    }

    async performClock(page, isClockIn, buttonIndex) {
        throw new Error('必須實作 performClock 方法');
    }

    async verifySuccess(page, isClockIn, buttonIndex) {
        throw new Error('必須實作 verifySuccess 方法');
    }
}

// NUEIP的打卡模式
export class NueipClockStrategy extends ClockStrategy {
    async login(page, user) {
        await page.goto('https://portal.nueip.com/login');
        await page.fill('input[name="inputCompany"]', user.company);
        await page.fill('input[name="inputID"]', user.username);
        await page.fill('input[name="inputPassword"]', user.password);
        await page.click('.login-button');
        await page.waitForURL('https://portal.nueip.com/home');
    }

    async performClock(page, isClockIn, buttonIndex) {
        await page.locator('.punch-button').nth(buttonIndex).click();
        await page.waitForTimeout(3000);
    }

    async verifySuccess(page, isClockIn, buttonIndex) {
        const hasClass = await page.locator('.punch-button')
            .nth(buttonIndex)
            .evaluate(el => el.classList.contains('is-punched'));
        return hasClass;
    }
}

// 禪道系統打卡模式
export class ZenClockStrategy extends ClockStrategy {
    async login(page, user) {
        await page.goto('http://zen.tg9.work/zentao/user-login-L3plbnRhby9teS5odG1s.html');
        // B系統的登入邏輯
        await page.fill('#account', user.username);
        await page.fill('#password', user.password);
        await page.click('#submit');
        await page.waitForNavigation();
    }

    async performClock(page, isClockIn, buttonIndex) {
        // B系統的打卡邏輯
        const buttonText = isClockIn ? '上班打卡' : '下班打卡';
        await page.click(`button:has-text("${buttonText}")`);
        await page.waitForTimeout(2000);
    }

    async verifySuccess(page, isClockIn, buttonIndex) {
        // B系統的驗證邏輯
        const successMsg = await page.locator('.success-message').isVisible();
        return successMsg;
    }
}
