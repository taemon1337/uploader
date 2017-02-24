FROM node

RUN npm install express request bhttp bluebird
RUN npm install rimraf mkdirp multiparty
RUN npm install fine-uploader

COPY ./ /work
WORKDIR /work

EXPOSE 8080
ENV PORT=8080

CMD node run.js
