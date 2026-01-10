import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs/promises';
import path from 'path';
import {ClockOn, ClockOff, setAssginUserData} from "./clock-service.js";
import {addSkipDate, removeSkipDate, getUserSkipDates} from "./skip-date-service.js";
import {setInTime, setOutTime, setRangeMinutes} from "../main.js";

// 檔案保存路徑
const CONFIG_FILE = path.join(process.cwd(), 'config.json');
const leaveRegex = /我要請假(\d{8}),(.+)/;;
const cancelLeaveRegex = /我要收回請假(\d{8}),(.+)/;
const queryLeaveRegex  = /查詢請假,?(.+)/;
const setUserPosition = /^更改打卡地點,([^,]+),(.+)$/;
const setUserClockOffTime = /^更改下班時間,((?:[01]\d|2[0-3])):([0-5]\d)$/; // 更改下班時間格式，例如 "更改下班時間,18:00"
const setUserClockInTime = /^更改上班時間,((?:[01]\d|2[0-3])):([0-5]\d)$/; // 更改上班時間格式，例如 "更改上班時間,08:50"
const setRandomClockTime = /^更改隨機打卡時間,(\d+)$/; // 更改隨機打卡時間格式，例如 "更改隨機打卡時間,10" (10分鐘範圍)
const positionRegex = /^-?\d+\.?\d*,-?\d+\.?\d*$/; // 緯度格式，例如 "25.0478,121.5319"
const commandRegexes = [
    /^\/\w+$/, // 以 / 开头的命令
    /^啟動打卡$/,
    /^幫我打下班卡$/,
    /^幫我打上班卡$/,
    leaveRegex,
    cancelLeaveRegex,
    queryLeaveRegex,
    /^今日排程$/,
    setUserPosition,
    setUserClockOffTime,
    setUserClockInTime,
    setRandomClockTime
];
// 載入環境變數
dotenv.config();
// 這裡替換成您的 Telegram Bot API Token
const token = process.env.TELEGRAM_KEY;
const envChatId = process.env.CHAT_ID ? Number(JSON.parse(process.env.CHAT_ID)) : null;
// 創建一個新的機器人實例
const bot = new TelegramBot(token, {polling: true});
let scheduleText = "";

export const setScheduleText = (text) => {
    scheduleText = text;
}

const useTelegramService = async () => {
    await loadChatId();
    // 監聽 /start 命令
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, `歡迎使用 API 機器人！
首次使用請先輸入「啟動打卡」。
您可以使用以下命令：
> /hello - 讓天線寶寶跟你say hello
> 啟動打卡 - 啟動打卡功能
> 幫我打上班卡 - 打上班卡
> 幫我打下班卡 - 打下班卡
> 今日排程 - 查看今日排程
> 我要請假YYYYMMDD,用戶名 - 請假
> 我要收回請假YYYYMMDD,用戶名 - 收回請假
> 查詢請假,用戶名 - 查詢請假紀錄
> 更改上/下班時間,HH:MM - 更改打卡時間 example: 更改下班時間,18:00
> 更改打卡地點,用戶名,緯度,經度 - 更改打卡位置
> 更改打卡地點,用戶名,["緯度,經度","緯度,經度"] - 按照星期更改打卡位置
請使用指令與機器人互動。`);
    });

    bot.onText(/啟動打卡/, async (msg) => {
        const chatId = msg.chat.id;
        const originId = await loadChatId();
        if(originId) {
            bot.sendMessage(chatId, `打卡功能已啟動，當前聊天室ID為：${originId}，若要更改發送聊天室請先關閉打卡功能\n 您的聊天室ID為：${chatId}`);
            return
        }
        global.chatId = chatId;
        // 保存聊天 ID 到檔案
        await saveChatId(chatId);
        bot.sendMessage(chatId, `已啟動打卡功能！聊天室ID為：${chatId}`);
    });

    bot.onText(/幫我打上班卡/, async (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, '已為您打"上班卡"，請稍後');
        await ClockOn();
    });

    bot.onText(/幫我打下班卡/, async (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, '已為您打"下班卡"，請稍後');
        await ClockOff();
    });

    bot.onText(/今日排程/, async (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, scheduleText || '今日排程尚未設置');
    });

    bot.onText(/\/hello/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, '天線寶寶跟你say hello！');
    });

    // 請假指令
    bot.onText(leaveRegex, (msg) => {
        const chatId = msg.chat.id;
        console.log(msg.text.match(leaveRegex), ' msg.text.match')
        const date = msg.text.match(leaveRegex)[1]; // 取得日期部分
        const username = msg.text.match(leaveRegex)[2]; // 取得用戶名部分
        bot.sendMessage(chatId, `已收到您 ${date} 的請假申請，正在處理中...`);
        addSkipDate(date, username).then((isSuccess) => {
            if (isSuccess) {
                bot.sendMessage(chatId, `已成功添加 ${date} 為請假日期`);
            } else {
                bot.sendMessage(chatId, `添加 ${date} 為請假日期失敗`);
            }
        }).catch(() => {
            bot.sendMessage(chatId, `添加 ${date} 為請假日期失敗`);
        })
    });

    // 收回請假指令
    bot.onText(cancelLeaveRegex, (msg) => {
        const chatId = msg.chat.id;
        const date = msg.text.match(cancelLeaveRegex)[1]; // 取得日期部分
        const username = msg.text.match(cancelLeaveRegex)[2]; // 取得用戶名部分
        // 处理收回请假逻辑
        bot.sendMessage(chatId, `已收到您收回 ${date} 請假的申請，正在處理中...`);
        removeSkipDate(date, username).then((isSuccess) => {
            if (isSuccess) {
                bot.sendMessage(chatId, `已成功移除 ${date} 為請假日期`);
            } else {
                bot.sendMessage(chatId, `移除 ${date} 為請假日期失敗`);
            }
        }).catch(() => {
            bot.sendMessage(chatId, `移除 ${date} 為請假日期失敗`);
        })
        // 这里添加你的收回请假处理逻辑
    });

    // 查詢請假指令
    bot.onText(queryLeaveRegex, async (msg) => {
        const chatId   = msg.chat.id;                  // 取得聊天室 ID
        const username = msg.text.match(queryLeaveRegex)[1].trim(); // 擷取使用者名稱

        // 先回覆「已收到」訊息，避免使用者等待
        bot.sendMessage(chatId, `已收到查詢 ${username} 請假日期的請求，正在處理中...`);

        try {
            const dates = await getUserSkipDates(username);        // 讀取該使用者請假
            if (dates.length === 0) {
                bot.sendMessage(chatId, `${username} 目前沒有任何請假紀錄`);
            } else {
                // 將日期用換行排版，易讀
                const list = dates.map(d => `• ${d}`).join('\n');
                bot.sendMessage(chatId, `${username} 的請假日期如下：\n${list}`);
            }
        } catch (err) {
            console.error('查詢請假失敗：', err);
            bot.sendMessage(chatId, `查詢 ${username} 的請假資料時發生錯誤，請稍後再試`);
        }
    });

    bot.onText(setUserPosition, (msg) => {
        const chatId = msg.chat.id;
        const match = msg.text.match(setUserPosition);

        if (match && match.length === 3) {
            const username = match[1].trim(); // 擷取使用者名稱
            const positionStr = match[2].trim(); // 擷取位置字串

            let position;

            // 解析位置資料
            try {
                // 檢查是否為 JSON 陣列格式
                if (/^\[.*\]$/.test(positionStr)) {
                    position = JSON.parse(positionStr);

                    // 驗證是否為陣列
                    if (!Array.isArray(position)) {
                        bot.sendMessage(chatId, '陣列格式錯誤，請使用正確的JSON陣列格式');
                        return;
                    }

                    // 驗證陣列中的每個位置格式
                    for (let i = 0; i < position.length; i++) {
                        if (!positionRegex.test(position[i])) {
                            bot.sendMessage(chatId, `陣列中第 ${i + 1} 個位置格式錯誤，請使用格式：25.0478,121.5319`);
                            return;
                        }
                    }

                    // 檢查陣列是否為空
                    if (position.length === 0) {
                        bot.sendMessage(chatId, '位置陣列不能為空');
                        return;
                    }

                } else {
                    // 單一座標格式
                    position = positionStr;

                    // 驗證單一座標格式
                    if (!positionRegex.test(position)) {
                        bot.sendMessage(chatId, '請輸入有效的緯度和經度格式\n單一位置：25.0478,121.5319\n多個位置：["25.0478,121.5319","25.0479,121.5320"]');
                        return;
                    }
                }

            } catch (error) {
                bot.sendMessage(chatId, 'JSON格式錯誤，請檢查陣列格式是否正確\n範例：["25.0478,121.5319","25.0479,121.5320"]');
                return;
            }

            // 保存用戶打卡位置邏輯
            const isSuccess = setAssginUserData(username, 'gpsPosition', position);
            if (!isSuccess) {
                bot.sendMessage(chatId, `無法設置 ${username} 的打卡位置，請檢查用戶名是否正確`);
                return;
            }

            // 成功訊息，根據類型顯示不同格式
            const positionDisplay = Array.isArray(position)
                ? `${position.length}個位置: ${position.join(', ')}`
                : position;

            bot.sendMessage(chatId, `已為 ${username} 設置打卡位置：${positionDisplay}`);

        } else {
            bot.sendMessage(chatId, '請使用正確的格式：\n單一位置：更改打卡地點,用戶名,緯度,經度\n多個位置：更改打卡地點,用戶名,["緯度,經度","緯度,經度"]');
        }
    });

    // 更改下班時間指令
    bot.onText(setUserClockOffTime, (msg) => {
        const chatId = msg.chat.id;
        const match = msg.text.match(setUserClockOffTime);

        if (match && match.length === 3) {
            const clockOffTime = `${match[1]}:${match[2]}`; // 擷取下班時間
            console.log(`收到更改下班時間請求: ${clockOffTime}`);

            // 驗證時間格式
            if (!/^(\d{2}):(\d{2})$/.test(clockOffTime)) {
                bot.sendMessage(chatId, '請輸入有效的下班時間格式，例如：18:00');
                return;
            }

            bot.sendMessage(chatId, `下班設置為時間：${clockOffTime}`);
            setOutTime(clockOffTime); // 更新下班時間
        } else {
            bot.sendMessage(chatId, '請使用正確的格式：更改下班時間,用戶名,HH:MM');
        }
    });

    bot.onText(setUserClockInTime, (msg) => {
        const chatId = msg.chat.id;
        const match = msg.text.match(setUserClockInTime);
        console.log(match, ' match')
        console.log(match[1], match[2], ' match[1] match[2]', match.length)
        if (match && match.length === 3) {
            const clockInTime = `${match[1]}:${match[2]}`; // 擷取下班時間
            console.log(`收到更改上班時間請求: ${clockInTime}`);
            // 驗證時間格式
            if (!/^(\d{2}):(\d{2})$/.test(clockInTime)) {
                bot.sendMessage(chatId, '請輸入有效的上班時間格式，例如：08:50');
                return;
            }

            bot.sendMessage(chatId, `上班設置為時間：${clockInTime}`);
            setInTime(clockInTime); // 更新上班時間
        } else {
            bot.sendMessage(chatId, '請使用正確的格式：更改上班時間,用戶名,HH:MM');
        }
    })

    // 更改隨機打卡時間指令
    bot.onText(setRandomClockTime, (msg) => {
        const chatId = msg.chat.id;
        const match = msg.text.match(setRandomClockTime);

        if (match && match.length === 2) {
            const rangeMinutes = parseInt(match[1].trim(), 10); // 擷取隨機打卡時間範圍
            console.log(`收到更改隨機打卡時間請求: ${rangeMinutes} 分鐘`);

            // 驗證範圍是否為正整數
            if (isNaN(rangeMinutes) || rangeMinutes <= 0) {
                bot.sendMessage(chatId, '請輸入有效的隨機打卡時間範圍，例如：10');
                return;
            }

            bot.sendMessage(chatId, `已設置隨機打卡時間範圍為 ${rangeMinutes} 分鐘`);
            setRangeMinutes(rangeMinutes); // 更新隨機打卡時間範圍
        } else {
            bot.sendMessage(chatId, '請使用正確的格式：更改隨機打卡時間,分鐘數');
        }
    })


    // 處理其他消息
    bot.on('message', (msg) => {
        if (msg.text && !commandRegexes.some(regex => regex.test(msg.text))) {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, '請使用指令與機器人互動。首次使用請先輸入「啟動打卡」。\n輸入 /start 查看可用指令。');
        }
    });

    console.log('telegram機器人已啟動');

}

// 保存聊天 ID 到檔案
async function saveChatId(chatId) {
    try {
        const config = {chatId};
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log(`聊天ID ${chatId} 已保存到檔案`);
        return true;
    } catch (error) {
        console.error('保存聊天ID失敗:', error);
        return false;
    }
}

// 從檔案加載聊天 ID
async function loadChatId() {
    try {
        if (envChatId) {
            global.chatId = envChatId;
            console.log(`從環境變數加載聊天ID: ${global.chatId}`);
            return envChatId;
        }
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        const config = JSON.parse(data);
        global.chatId = config.chatId;
        console.log(`已從檔案加載聊天ID: ${global.chatId}`);
        return config.chatId;
    } catch (error) {
        console.error('加載聊天ID失敗 (這可能是首次運行):', error);
        return null;
    }
}

export const sendPhoto = async (photoPath) => {
    try {
        if (!global.chatId) {
            await loadChatId();
        }

        if (!global.chatId) {
            throw new Error('未設定聊天ID，請先發送「啟動打卡」訊息給機器人');
        }

        const chatId = global.chatId;
        await bot.sendPhoto(chatId, photoPath,{
            contentType: 'image/png'
        });
        console.log('圖片發送成功');
        return true;
    } catch (error) {
        console.error('發送圖片失敗:', error);
        return false;
    }
};

export const sendMessage = async (message) => {
    try {
        if (!global.chatId) {
            await loadChatId();
        }

        if (!global.chatId) {
            throw new Error('未設定聊天ID，請先發送「啟動打卡」訊息給機器人');
        }

        const chatId = global.chatId;
        await bot.sendMessage(chatId, message);
        console.log('消息發送成功');
        return true;
    } catch (error) {
        console.error('發送消息失敗:', error);
        return false;
    }
};

export default useTelegramService;
