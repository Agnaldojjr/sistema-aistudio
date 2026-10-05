import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = import.meta.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = import.meta.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY;
export const bucketName = import.meta.env.VITE_CLOUDFLARE_R2_BUCKET_NAME;
const publicUrl = import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_URL;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.warn('Cloudflare R2 credentials are not fully configured in environment variables.');
}

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
});

/**
 * Uploads a file to Cloudflare R2
 */
export async function uploadFile(file: File | Blob, path: string, contentType?: string) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: path,
    Body: file,
    ContentType: contentType || file.type || 'application/octet-stream',
  });

  await s3Client.send(command);
  return { path };
}

/**
 * Gets a public or presigned URL for a file
 */
export async function getFileUrl(path: string, expiresIn = 3600): Promise<string> {
  // If a public custom domain is configured, use it
  if (publicUrl) {
    const baseUrl = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`;
    return `${baseUrl}${path}`;
  }

  // Otherwise, generate a presigned URL
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: path,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Deletes a file from Cloudflare R2
 */
export async function deleteFile(path: string) {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: path,
  });

  await s3Client.send(command);
}

/**
 * Renames/Moves a file by copying it and deleting the original
 */
export async function moveFile(oldPath: string, newPath: string) {
  const copyCommand = new CopyObjectCommand({
    Bucket: bucketName,
    CopySource: encodeURI(`${bucketName}/${oldPath}`),
    Key: newPath,
  });

  await s3Client.send(copyCommand);

  const deleteCommand = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: oldPath,
  });

  await s3Client.send(deleteCommand);
}

/**
 * Lists files with a specific prefix
 */
export async function listFiles(prefix: string) {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  return response.Contents || [];
}
