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
// 注意：SPA 會根據當前 URL 決定載入哪個模組 iframe，不同使用者的 iframe ID 可能不同
export class ZenClockStrategy extends ClockStrategy {
    async login(page, user) {
        // 登入禪道系統
        console.log('[登入] 開始導航到登入頁面...');
        await page.goto('http://zen.tg9.work/zentao/user-login.html');
        console.log(`[登入] 頁面已載入, URL: ${page.url()}`);

        await page.fill('#account', user.username);
        await page.fill('#password', user.password);
        console.log(`[登入] 已填入帳號密碼, 帳號: ${user.username}`);

        await page.click('#submit');
        console.log('[登入] 已點擊登入按鈕, 等待 networkidle...');

        await page.waitForLoadState('networkidle');
        console.log(`[登入] networkidle 完成, URL: ${page.url()}`);

        // 檢查是否仍在登入頁面，如果是則主動導航到 SPA 主頁
        if (page.url().includes('user-login')) {
            console.log('[登入] 仍在登入頁面，檢查是否有錯誤訊息...');

            // 偵測登入頁面上的錯誤訊息
            const errorText = await page.evaluate(() => {
                const tips = document.querySelectorAll('[class*="error"], [class*="tip"], [class*="alert"], [class*="danger"]');
                return Array.from(tips)
                    .filter(el => el.offsetHeight > 0 && el.textContent.trim().length > 0)
                    .map(el => el.textContent.trim());
            });

            if (errorText.length > 0) {
                console.log(`[登入] 登入頁面錯誤訊息: ${JSON.stringify(errorText)}`);
                throw new Error(`登入失敗 - 錯誤訊息: ${errorText.join(', ')}`);
            }

            // 沒有錯誤訊息，可能登入成功但頁面未自動跳轉，主動導航到 SPA 主頁
            console.log('[登入] 無錯誤訊息，主動導航到 SPA 主頁...');
            await page.goto('http://zen.tg9.work/zentao/');
            await page.waitForLoadState('networkidle');
            console.log(`[登入] 導航後 URL: ${page.url()}`);
        }

        // 驗證登入是否成功
        const bodyClass = await page.evaluate(() => document.body.className);
        const title = await page.title();
        console.log(`[登入] body class: "${bodyClass}", 頁面標題: "${title}"`);

        if (!bodyClass.includes('show-menu')) {
            throw new Error(`登入失敗 - 未進入 SPA 主頁。URL: ${page.url()}, 標題: "${title}"`);
        }
        console.log('[登入] 登入成功，SPA 已載入');
    }

    async performClock(page, isClockIn, buttonIndex, user) {
        console.log(`[打卡] === 開始打卡流程 === isClockIn: ${isClockIn}`);
        console.log(`[打卡] 當前 URL: ${page.url()}`);
        console.log(`[打卡] viewport: ${JSON.stringify(page.viewportSize())}`);

        // 等待 SPA 載入渲染
        console.log('[打卡] 等待 3 秒讓 SPA 渲染...');
        await page.waitForTimeout(3000);
        console.log(`[打卡] 3 秒後 URL: ${page.url()}`);

        if (isClockIn) {
            // 簽到流程：點擊左側「辦公」選單，進入考勤頁面觸發簽到記錄
            console.log('[簽到] === 執行上班簽到流程 ===');
            await page.waitForLoadState('networkidle');
            console.log('[簽到] networkidle 完成');

            // 偵測選單狀態
            const menuDebugInfo = await page.evaluate(() => {
                const menuNav = document.querySelector('#menuMainNav');
                const oaItem = document.querySelector('li[data-app="oa"]');
                const oaLink = document.querySelector('li[data-app="oa"] > a');
                const menuMoreNav = document.querySelector('#menuMoreNav');
                const body = document.body;

                // 取得所有選單項目及其可見性
                const allItems = Array.from(menuNav?.querySelectorAll('li[data-app]') || []).map(li => ({
                    app: li.getAttribute('data-app'),
                    hidden: li.classList.contains('hidden'),
                    classes: li.className
                }));

                return {
                    bodyClass: body.className,
                    menuNavExists: !!menuNav,
                    menuNavHeight: menuNav?.offsetHeight || 0,
                    oaItemExists: !!oaItem,
                    oaItemHidden: oaItem?.classList.contains('hidden') || false,
                    oaItemClasses: oaItem?.className || '',
                    oaItemOffsetHeight: oaItem?.offsetHeight || 0,
                    oaLinkExists: !!oaLink,
                    oaLinkVisible: oaLink ? (oaLink.offsetWidth > 0 && oaLink.offsetHeight > 0) : false,
                    showMoreNav: menuMoreNav?.style.display || 'unknown',
                    hasShowMoreNavClass: body.closest('html')?.querySelector('.show-more-nav') !== null,
                    allMenuItems: allItems,
                    windowHeight: window.innerHeight
                };
            });
            console.log('[簽到] 選單偵測結果:', JSON.stringify(menuDebugInfo, null, 2));

            // 點擊左側「辦公」選單項目
            const oaMenuSelector = 'li[data-app="oa"] > a';
            console.log(`[簽到] 等待 "${oaMenuSelector}" 可見...`);
            await page.waitForSelector(oaMenuSelector, { state: 'visible', timeout: 50000 });
            console.log('[簽到] 選單項目已可見，準備點擊');

            await page.click(oaMenuSelector);
            console.log('[簽到] 已點擊「辦公」選單');

            // 等待考勤頁面 iframe 容器出現
            console.log('[簽到] 等待 #app-oa 容器出現...');
            await page.waitForSelector('#app-oa', { state: 'visible', timeout: 50000 });
            console.log('[簽到] #app-oa 容器已出現');

            // 等待 iframe 載入完成
            console.log('[簽到] 等待 #appIframe-oa iframe 載入...');
            await page.waitForSelector('#appIframe-oa', { timeout: 50000 });
            console.log('[簽到] #appIframe-oa iframe 已載入');

            // 等待確保考勤記錄寫入
            console.log('[簽到] 等待 5 秒確保考勤記錄寫入...');
            await page.waitForTimeout(5000);
            console.log(`[簽到] 完成, 最終 URL: ${page.url()}`);
            return;
        }

        // 簽退流程：動態找到當前活動的 iframe 進行登出操作
        console.log('[簽退] === 執行下班簽退流程 ===');
        await page.waitForLoadState('networkidle');
        console.log('[簽退] networkidle 完成');
        await page.waitForTimeout(1000);

        // 動態找到當前活動的 app iframe（依 z-index 判斷最上層的容器）
        // 禪道 SPA 會根據初次載入的頁面決定 iframe ID，不能寫死特定 ID
        console.log('[簽退] 偵測活動的 iframe...');
        const iframeDebugInfo = await page.evaluate(() => {
            const containers = document.querySelectorAll('.app-container');
            const info = [];
            containers.forEach(c => {
                const iframe = c.querySelector('iframe');
                info.push({
                    id: c.id,
                    zIndex: c.style.zIndex,
                    display: c.style.display,
                    iframeId: iframe?.id || null
                });
            });
            return info;
        });
        console.log('[簽退] 所有 app-container:', JSON.stringify(iframeDebugInfo, null, 2));

        const activeIframeId = await page.evaluate(() => {
            const containers = document.querySelectorAll('.app-container');
            let maxZ = 0;
            let activeId = null;
            containers.forEach(c => {
                const z = parseInt(c.style.zIndex) || 0;
                if (z > maxZ) {
                    maxZ = z;
                    const iframe = c.querySelector('iframe');
                    if (iframe) activeId = iframe.id;
                }
            });
            return activeId;
        });

        if (!activeIframeId) {
            throw new Error('找不到活動的 app iframe');
        }
        console.log(`[簽退] 當前活動的 iframe: ${activeIframeId}`);

        // 在活動的 iframe 內操作登出元素
        const frame = page.frameLocator(`#${activeIframeId}`);

        console.log('[簽退] 點擊使用者選單...');
        await frame.locator('#userMenu-toggle').click();
        await page.waitForTimeout(1000); // 等待選單動畫完成
        console.log('[簽退] 已點擊使用者選單，等待 popover 出現...');

        // 等待 ui 渲染
        await frame.locator('.popover.show').waitFor({ state: 'visible' });
        console.log('[簽退] popover 已出現，點擊登出連結...');

        // 點擊簽退連結
        await frame.locator('a[href="javascript:$.apps.logout()"]').click();
        console.log('[簽退] 已點擊登出連結，等待跳轉到登入頁面...');

        // 等待跳轉到登入頁面（不指定完整 URL，避免 base64 參數變動導致失敗）
        await page.waitForURL('**/user-login*.html');
        console.log(`[簽退] 完成, 最終 URL: ${page.url()}`);
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
