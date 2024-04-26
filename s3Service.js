require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const https = require("https");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");

const maxSockets = 1000;

https.globalAgent.maxSockets = maxSockets;

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({
    httpAgent: new https.Agent({
      keepAlive: true,
      maxSockets: maxSockets,
    }),
    httpsAgent: new https.Agent({
      keepAlive: true,
      maxSockets: maxSockets,
    }),
  }),
});

const imagePutObjectCommand = new PutObjectCommand({});

const jsonPutObjectCommand = new PutObjectCommand({});

exports.s3UploadImage = (file) => {
  imagePutObjectCommand.input = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${file.dir}/images/${file.editionCount}.png`,
    Body: file.buffer,
    ContentType: "image/png",
  };

  return s3Client.send(imagePutObjectCommand);
};

exports.s3UploadJson = (file) => {
  jsonPutObjectCommand.input = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${file.dir}/json/${file.editionCount}.json`,
    Body: file.buffer,
    ContentType: "application/json",
  };

  return s3Client.send(jsonPutObjectCommand);

  // currentJsonPromises.push(s3Client.send(jsonPutObjectCommand));
  // currentJsonCount++;

  // if (currentJsonCount > 10) {
  //   await Promise.all(currentJsonPromises).then(() => {
  //     console.log("uploaded an json batch");
  //     currentJsonCount = 0;
  //   });
  // }

  // s3Client
  //   .send(jsonPutObjectCommand)
  //   .then(() => {
  //     console.log("Json ", file.editionCount, " has been uploaded to s3");
  //   })
  //   .catch((err) => {
  //     console.error(err);
  //   });
};
