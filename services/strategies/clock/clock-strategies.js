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
    // 登入
    async login(page, user) {
        await page.goto('https://portal.nueip.com/login');
        await page.fill('input[name="inputCompany"]', user.company);
        await page.fill('input[name="inputID"]', user.username);
        await page.fill('input[name="inputPassword"]', user.password);
        await page.click('.login-button');
        await page.waitForURL('https://portal.nueip.com/home');
    }

    // 執行打卡
    async performClock(page, isClockIn, buttonIndex) {
        await page.locator('.punch-button').nth(buttonIndex).click();
        await page.waitForTimeout(3000);
    }

    // 驗證打卡是否成功
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
        await page.fill('#account', user.username);
        await page.fill('#password', user.password);
        await page.click('#submit');
        await page.waitForURL('http://zen.tg9.work/zentao/my.html');
    }

    async performClock(page, isClockIn, buttonIndex) {
        // 如果是上班則不做任何動作
        console.log('isClockIn', isClockIn);
        await page.waitForTimeout(3000); // 等待載入渲染

        if (isClockIn) return;
        console.log('執行下班簽退流程');
        // 等待頁面加載完成
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000); // 額外等待 JS 初始化
        // 先用較快的 load
        await page.waitForLoadState('load');
        
        // 再等待關鍵元素出現在html中
        const frame = page.frameLocator('#appIframe-my');

        // 在 iframe 內操作元素
        await frame.locator('#userMenu-toggle').click();

        await page.waitForTimeout(1000); // 等待選單動畫完成

        // 等待ui渲染
        await frame.locator('.popover.show').waitFor({ state: 'visible' });
        // 點擊簽退連結
        await frame.locator('a[href="javascript:$.apps.logout()"]').click();
        // 等待跳轉回登入頁面
        await page.waitForURL('http://zen.tg9.work/zentao/user-login-L3plbnRhby9teS5odG1s.html');
    }

    async verifySuccess(page, isClockIn, buttonIndex) {

        console.log('驗證打卡成功狀態, isClockIn:', isClockIn);
        // 系統是否成功打卡
        if (isClockIn) {
            const currentUrl = page.url();
            return currentUrl === 'http://zen.tg9.work/zentao/my.html'
        }

        // 下班簽退成功回到登入頁面
        const currentUrl = page.url();
        console.log('當前URL:', currentUrl);
        return currentUrl === 'http://zen.tg9.work/zentao/user-login-L3plbnRhby9teS5odG1s.html'

    }
}
