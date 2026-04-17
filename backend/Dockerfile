FROM node:20-slim

WORKDIR /app

# ✅ Install OpenSSL FIRST
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "src/index.js"]