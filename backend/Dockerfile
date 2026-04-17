FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

RUN mkdir -p uploads

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"]