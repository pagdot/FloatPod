FROM node:20-alpine as build

WORKDIR /work
COPY . .

RUN apk add --no-cache git
RUN npm install --save-dev
RUN npx tsc

FROM lscr.io/linuxserver/baseimage-alpine:3.18

WORKDIR /app

COPY --from=build /work/out /work/package.json /app/
COPY config.yaml /defaults/

RUN \
  echo "**** install deps ****" && \
  apk add --no-cache \
    ffmpeg \
    nodejs \
    npm \
    git && \
  npm install && \
  echo "**** cleanup ****" && \
  rm -rf \
    /tmp/*

WORKDIR /config

VOLUME /config
VOLUME /data
