FROM node

RUN npm install express request bhttp bluebird yazl archiver rimraf mkdirp multiparty fine-uploader

COPY ./ /web

WORKDIR /web

ENV INBOX_DATA=/inbox_data/ \
    PORT=8080

VOLUME $INBOX_DATA

CMD node run.js $INBOX_DATA
