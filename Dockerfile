FROM jrottenberg/ffmpeg:snapshot-alpine

RUN \
    apk add nodejs nodejs-npm && \
    mkdir /f1tv-dl && \
    cp . /f1tv

WORKDIR /f1tv

RUN npm i -g