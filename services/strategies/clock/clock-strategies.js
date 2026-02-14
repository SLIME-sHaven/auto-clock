// 定義打卡模式的介面(interface)
export class ClockStrategy {
    async login(page, user) {
        throw new Error('必須實作 login 方法');
    }

    async performClock(page, isClockIn, buttonIndex, ...args) {
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
// 考勤機制：記錄第一次登入時間為簽到，最後一次登出時間為簽退
// 簽到需要實際訪問考勤頁面（attend-personal），禪道為 SPA 架構，各模組透過 iframe 載入
export class ZenClockStrategy extends ClockStrategy {
    async login(page, user) {
        // 登入 URL 帶 attend-personal redirect，登入後直接跳轉到考勤頁面
        await page.goto('http://zen.tg9.work/zentao/user-login-L3plbnRhby9hdHRlbmQtcGVyc29uYWwuaHRtbA==.html');
        await page.fill('#account', user.username);
        await page.fill('#password', user.password);
        await page.click('#submit');
        // 禪道是 SPA，登入後 URL 不一定會改變，改用等待頁面載入完成
        await page.waitForLoadState('networkidle');
    }

    async performClock(page, isClockIn, buttonIndex, user) {
        console.log('isClockIn', isClockIn);
        await page.waitForTimeout(3000); // 等待 SPA 載入渲染

        if (isClockIn) {
            // 簽到流程：點擊「辦公」選單，觸發考勤頁面載入以記錄簽到
            console.log('執行上班簽到流程');

            // 等待 SPA 主頁面完全載入
            await page.waitForLoadState('networkidle');

            // 點擊左側選單「辦公」按鈕，載入考勤模組
            const oaMenuSelector = 'li[data-app="oa"] > a';
            await page.waitForSelector(oaMenuSelector, { state: 'visible', timeout: 15000 });
            await page.click(oaMenuSelector);
            console.log('已點擊「辦公」選單');

            // 等待考勤頁面 iframe 容器出現（禪道會建立 #app-oa 容器和 #appIframe-oa iframe）
            await page.waitForSelector('#app-oa', { state: 'visible', timeout: 15000 });
            console.log('#app-oa 容器已出現');

            // 等待 iframe 載入完成
            await page.waitForSelector('#appIframe-oa', { timeout: 15000 });
            console.log('#appIframe-oa iframe 已載入');

            // 等待幾秒確保考勤記錄寫入
            await page.waitForTimeout(5000);
            console.log('上班簽到流程完成');
            return;
        }

        // 簽退流程（維持不變）
        console.log('執行下班簽退流程');
        // 等待頁面加載完成
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000); // 額外等待 JS 初始化
        await page.waitForLoadState('load');

        // 等待關鍵元素出現，在 iframe 內操作
        const frame = page.frameLocator('#appIframe-my');

        // 在 iframe 內操作元素
        await frame.locator('#userMenu-toggle').click();

        await page.waitForTimeout(1000); // 等待選單動畫完成

        // 等待 ui 渲染
        await frame.locator('.popover.show').waitFor({ state: 'visible' });
        // 點擊簽退連結
        await frame.locator('a[href="javascript:$.apps.logout()"]').click();
        // 等待跳轉回登入頁面
        await page.waitForURL('http://zen.tg9.work/zentao/user-login-L3plbnRhby9hdHRlbmQtcGVyc29uYWwuaHRtbA==.html');
    }

    async verifySuccess(page, isClockIn, buttonIndex) {
        console.log('驗證打卡成功狀態, isClockIn:', isClockIn);

        if (isClockIn) {
            // 簽到驗證：檢查考勤頁面（辦公模組）是否成功載入
            try {
                const appOaVisible = await page.locator('#app-oa').isVisible();
                console.log('#app-oa 是否可見:', appOaVisible);
                return appOaVisible;
            } catch (error) {
                console.error('驗證簽到狀態時發生錯誤:', error.message);
                return false;
            }
        }

        // 下班簽退成功回到登入頁面
        const currentUrl = page.url();
        console.log('當前URL:', currentUrl);
        return currentUrl.includes('user-login');
    }
}
