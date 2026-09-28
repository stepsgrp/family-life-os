import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";

// Cloudflare R2 is S3-compatible: files go straight from the client to R2 via
// short-lived presigned URLs, so large uploads never pass through the API server.
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

export function presignUpload(key: string, contentType: string, sizeBytes: number) {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: contentType, ContentLength: sizeBytes }),
    { expiresIn: 300 },
  );
}

export function presignDownload(key: string, fileName: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ResponseContentDisposition: `inline; filename="${fileName.replace(/"/g, "")}"`,
    }),
    { expiresIn: 300 },
  );
}

export function deleteObject(key: string) {
  return s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
}
