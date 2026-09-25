const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Subir archivo a Cloudflare R2
 */
async function uploadToR2(fileBuffer, fileName, mimeType) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await r2Client.send(command);

  const publicUrl = process.env.R2_PUBLIC_DOMAIN 
    ? `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`
    : null;

  return { key: fileName, url: publicUrl };
}

/**
 * Obtener objeto desde R2 (servidor proxy)
 */
async function getObjectFromR2(fileName) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileName,
  });

  return await r2Client.send(command);
}

/**
 * Eliminar archivo de Cloudflare R2
 */
async function deleteFromR2(fileName) {
  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileName,
  });

  return await r2Client.send(command);
}

module.exports = {
  r2Client,
  uploadToR2,
  getObjectFromR2,
  deleteFromR2,
};
