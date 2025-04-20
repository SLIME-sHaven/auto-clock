import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs/promises';
import path from 'path';
import{ ClockOn, ClockOff } from "./clock-service.js";

// 檔案保存路徑
const CONFIG_FILE = path.join(process.cwd(), 'config.json');
const COMMENDS = ["啟動打卡", "幫我打下班卡", "幫我打上班卡"]
// 載入環境變數
dotenv.config();
// 這裡替換成您的 Telegram Bot API Token
const token = process.env.TELEGRAM_KEY;
// 創建一個新的機器人實例
const bot = new TelegramBot(token, {polling: true});

const useTelegramService = async() => {
    await loadChatId();
// 監聽 /start 命令
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, '歡迎使用 API 機器人！\n首次使用請先輸入啟用打卡。\n您可以使用以下命令：\n/hello - 讓天線寶寶跟你say hello');
    });

    bot.onText(/啟動打卡/, async(msg) => {
        const chatId = msg.chat.id;
        global.chatId = chatId;
        // 保存聊天 ID 到檔案
        await saveChatId(chatId);
        bot.sendMessage(chatId, `已啟動打卡功能！聊天室ID為：${chatId}`);
    });

    bot.onText(/幫我打上班卡/, async(msg) => {
        ClockOn();
        bot.sendMessage(chatId, '已為您打"上班卡"，請稍後');
    });

    bot.onText(/幫我打下班卡/, async(msg) => {
        ClockOff();
        bot.sendMessage(chatId, '已為您打"下班卡"，請稍後');
    });

    bot.onText(/\/hello/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, '天線寶寶跟你say hello！');
    });


    // 處理其他消息
    bot.on('message', (msg) => {
        if (msg.text && !msg.text.startsWith('/') && !COMMENDS.includes(msg.text)) {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, '請使用指令與機器人互動。輸入 /start 查看可用指令。');
        }
    });

    console.log('telegram機器人已啟動');

}

// 保存聊天 ID 到檔案
async function saveChatId(chatId) {
    try {
        const config = { chatId };
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
        await bot.sendPhoto(chatId, photoPath);
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
