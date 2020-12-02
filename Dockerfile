FROM jrottenberg/ffmpeg:snapshot-alpine

RUN apk add nodejs nodejs-npm

WORKDIR /f1tv

COPY . /f1tv

RUN npm i -g

ENTRYPOINT [ "/bin/sh", "run.sh" ]