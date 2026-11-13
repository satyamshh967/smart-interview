# Node.js API Gateway
FROM node:20-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --chown=node:node . .
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 5000

CMD ["node", "src/server.js"]
