# 使用Node.js 22作為基礎映像
FROM node:22-slim

# 設置工作目錄
WORKDIR /app

# 安裝系統依賴（Playwright需要這些庫）
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libgconf-2-4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libnss3 \
    libnspr4 \
    tzdata \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 設置時區為台北
ENV TZ=Asia/Taipei

# 複製package.json和package-lock.json（如果存在）
COPY package*.json ./

# 安裝依賴
RUN npm install

# 安裝Playwright的瀏覽器
RUN npx playwright install chromium

# 複製.env檔案（優先選擇.env.local，若不存在則使用.env）
COPY .env* ./

# 複製程式碼
COPY . .

# 在package.json中添加type: module
RUN if ! grep -q '"type": "module"' package.json; then \
    sed -i 's/"license": "ISC",/"license": "ISC", "type": "module",/' package.json; \
    fi

# 創建一個存放截圖的目錄
RUN mkdir -p /app/screenshots

# 設置環境變數表示生產環境
ENV NODE_ENV=production

# 使用node執行程式
CMD ["node", "main.js"]
