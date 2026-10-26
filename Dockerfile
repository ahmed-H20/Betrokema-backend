FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tzdata

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "server.js"]
