FROM dockerfile/nodejs

ADD . /src/

ENV NODE_ENV production

EXPOSE 3000

WORKDIR /src

CMD ["node", "app.js"]
