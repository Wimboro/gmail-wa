# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY config ./config
COPY src ./src
COPY utils ./utils
COPY run.js setup.js README.md ./

RUN mkdir -p /app/tokens

CMD ["node", "run.js"]
