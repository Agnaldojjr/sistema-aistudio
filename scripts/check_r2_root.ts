import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";
import dotenv from 'dotenv';
dotenv.config();

const agent = new https.Agent({
  rejectUnauthorized: false
});

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent: agent,
  }),
});

async function run() {
  const command = new ListObjectsV2Command({
    Bucket: process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME,
    MaxKeys: 100
  });
  try {
    const data = await s3Client.send(command);
    console.log("Arquivos no R2:");
    (data.Contents || []).forEach(f => console.log(f.Key));
  } catch(e) {
    console.error("ERRO:", e.message);
  }
}
run();
