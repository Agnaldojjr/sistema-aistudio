import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const accountId = process.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error("ERRO: Credenciais do R2 não encontradas no arquivo .env");
    process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true
});

const uploadDir = "C:\\Users\\Agnaldo\\OneDrive\\Área de Trabalho\\backup_completo\\patient_files";

async function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.resolve(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(await walk(filePath));
        } else {
            results.push(filePath);
        }
    }
    return results;
}

async function run() {
    console.log("=======================================");
    console.log("🚀 Iniciando migração para o Cloudflare R2...");
    console.log(`📂 Lendo pasta: ${uploadDir}`);
    console.log("=======================================\n");

    if (!fs.existsSync(uploadDir)) {
        console.error("ERRO: A pasta patient_files não foi encontrada dentro do backup_completo.");
        process.exit(1);
    }

    const files = await walk(uploadDir);
    console.log(`✅ Encontrados ${files.length} arquivos para upload. O processo começará agora...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const relativePath = path.relative(uploadDir, filePath).replace(/\\/g, '/');
        
        let contentType = 'application/octet-stream';
        if (relativePath.endsWith('.pdf')) contentType = 'application/pdf';
        else if (relativePath.endsWith('.json')) contentType = 'application/json';
        else if (relativePath.endsWith('.png')) contentType = 'image/png';
        else if (relativePath.endsWith('.jpg') || relativePath.endsWith('.jpeg')) contentType = 'image/jpeg';

        try {
            const fileStream = fs.createReadStream(filePath);
            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: relativePath,
                Body: fileStream,
                ContentType: contentType
            });
            await s3Client.send(command);
            console.log(`[${i+1}/${files.length}] 🟢 SUCESSO: ${relativePath}`);
            successCount++;
        } catch (err) {
            console.error(`[${i+1}/${files.length}] 🔴 ERRO ao enviar ${relativePath}:`, err.message);
            errorCount++;
        }
    }
    
    console.log("\n=======================================");
    console.log("🎉 MIGRAÇÃO CONCLUÍDA!");
    console.log(`🟢 Sucessos: ${successCount}`);
    console.log(`🔴 Erros: ${errorCount}`);
    console.log("=======================================");
}

run();
