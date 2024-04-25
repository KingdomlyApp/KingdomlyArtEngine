require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const imagePutObjectCommand = new PutObjectCommand({});

const jsonPutObjectCommand = new PutObjectCommand({});

exports.s3UploadImage = async (file) => {
  imagePutObjectCommand.input = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${file.dir}/images/${file.editionCount}.png`,
    Body: file.buffer,
    ContentType: "image/png",
  };

  s3Client.send(imagePutObjectCommand);
};

exports.s3UploadJson = async (file) => {
  jsonPutObjectCommand.input = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${file.dir}/json/${file.editionCount}.json`,
    Body: file.buffer,
    ContentType: "application/json",
  };

  s3Client.send(jsonPutObjectCommand);
};
