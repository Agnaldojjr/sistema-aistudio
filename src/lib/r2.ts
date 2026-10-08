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

export function isR2Configured(): boolean {
  return Boolean(
    accountId &&
    accessKeyId &&
    secretAccessKey &&
    bucketName &&
    accountId !== 'undefined' &&
    typeof accountId === 'string' &&
    accountId.trim().length > 5 &&
    !accountId.includes('placeholder')
  );
}

let _s3Client: S3Client | null = null;
export function getS3Client(): S3Client | null {
  if (!isR2Configured()) return null;
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }
  return _s3Client;
}

export const s3Client = {
  send: (cmd: any) => {
    const client = getS3Client();
    if (!client) throw new Error('Cloudflare R2 não configurado');
    return client.send(cmd);
  }
} as any;

/**
 * Uploads a file to Cloudflare R2
 */
export async function uploadFile(file: File | Blob, path: string, contentType?: string) {
  const client = getS3Client();
  if (!client) {
    throw new Error('Cloudflare R2 não configurado');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: path,
    Body: buffer,
    ContentType: contentType || file.type || 'application/octet-stream',
  });

  await client.send(command);
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

  const client = getS3Client();
  if (!client) return '';

  // Otherwise, generate a presigned URL
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: path,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Deletes a file from Cloudflare R2
 */
export async function deleteFile(path: string) {
  const client = getS3Client();
  if (!client) return;

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: path,
  });

  await client.send(command);
}

/**
 * Renames/Moves a file by copying it and deleting the original
 */
export async function moveFile(oldPath: string, newPath: string) {
  const client = getS3Client();
  if (!client) return;

  const copyCommand = new CopyObjectCommand({
    Bucket: bucketName,
    CopySource: encodeURI(`${bucketName}/${oldPath}`),
    Key: newPath,
  });

  await client.send(copyCommand);

  const deleteCommand = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: oldPath,
  });

  await client.send(deleteCommand);
}

/**
 * Lists files with a specific prefix
 */
export async function listFiles(prefix: string) {
  const client = getS3Client();
  if (!client) return [];

  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
  });

  const response = await client.send(command);
  return response.Contents || [];
}
