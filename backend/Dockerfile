FROM node:20-slim

WORKDIR /app

# Install Chromium + dependencies for Puppeteer
RUN apt-get update -y && apt-get install -y \
  openssl \
  chromium \
  fonts-freefont-ttf \
  fonts-dejavu \
  ca-certificates \
  libglib2.0-0 \
  libnss3 \
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
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN mkdir -p uploads

EXPOSE 8080

CMD ["node", "src/index.js"]