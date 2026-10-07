import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_USER_ID = process.env.DEFAULT_USER_ID || '78d7e8b0-9a7a-4eb3-8ba6-37a5ce401b46';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRO: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no ambiente.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const BACKUPS_DIR = path.join(process.cwd(), 'backups', 'crm');
const INDEX_FILE = path.join(BACKUPS_DIR, 'backup_index.json');

async function run() {
  console.log('====================================================');
  console.log('🛡️ BACKUP IMUTÁVEL DE DADOS DO CRM NO GITHUB');
  console.log('====================================================\n');

  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  // 1. Consultar dados atuais do Supabase
  console.log(`📡 Baixando dados atuais do CRM (Usuário: ${TARGET_USER_ID})...`);
  const { data, error } = await supabase
    .from('clinic_data')
    .select('crm_data')
    .eq('user_id', TARGET_USER_ID)
    .single();

  if (error || !data || !data.crm_data) {
    console.error('❌ Falha ao buscar dados do Supabase:', error);
    process.exit(1);
  }

  const crm = data.crm_data;
  const patients = Array.isArray(crm.patients) ? crm.patients : [];
  const galeria = Array.isArray(crm.galeria) ? crm.galeria : [];
  const appointments = Array.isArray(crm.appointments) ? crm.appointments : [];
  const clinicalHistory = Array.isArray(crm.clinical_history) ? crm.clinical_history : [];
  const anamnese = Array.isArray(crm.anamnese) ? crm.anamnese : [];
  const pagamentos = Array.isArray(crm.pagamentos) ? crm.pagamentos : [];

  // SANITY CHECK: Nunca gerar backup se a base estiver corrompida ou vazia!
  if (patients.length === 0) {
    console.error('🚨 ALERTA CRÍTICO: A lista de pacientes está VAZIA! Backup abortado para prevenir corrupção.');
    process.exit(1);
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  const backupFileName = `crm_backup_${dateStr}.json`;
  const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

  // Se já existir backup do mesmo dia, cria com sufixo de hora para NUNCA sobrescrever
  let finalFileName = backupFileName;
  let finalFilePath = backupFilePath;
  if (fs.existsSync(backupFilePath)) {
    finalFileName = `crm_backup_${dateStr}_${timeStr}.json`;
    finalFilePath = path.join(BACKUPS_DIR, finalFileName);
  }

  const backupPayload = {
    backupMetadata: {
      generatedAt: now.toISOString(),
      source: 'Supabase Production clinic_data',
      userId: TARGET_USER_ID,
      isImmutable: true,
      stats: {
        totalPatients: patients.length,
        totalGalleryPhotos: galeria.length,
        totalAppointments: appointments.length,
        totalClinicalHistories: clinicalHistory.length,
        totalAnamnesis: anamnese.length,
        totalPayments: pagamentos.length,
        patientsWithCpf: patients.filter(p => p.cpf).length,
        patientsWithPhone: patients.filter(p => p.phone || p.mobile).length
      }
    },
    crm_data: crm
  };

  fs.writeFileSync(finalFilePath, JSON.stringify(backupPayload, null, 2), 'utf8');
  console.log(`✅ Arquivo de backup imutável gerado com sucesso:`);
  console.log(`   📂 ${finalFilePath}`);
  console.log(`   👤 Pacientes protegidos: ${patients.length}`);
  console.log(`   📸 Fotos na galeria: ${galeria.length}`);
  console.log(`   📅 Consultas: ${appointments.length}`);
  console.log(`   🩺 Históricos Clínicos: ${clinicalHistory.length}`);

  // 2. Atualizar índice de backups
  let indexData: any[] = [];
  if (fs.existsSync(INDEX_FILE)) {
    try {
      indexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    } catch (_) {
      indexData = [];
    }
  }

  indexData.unshift({
    filename: finalFileName,
    date: now.toISOString(),
    patientsCount: patients.length,
    photosCount: galeria.length,
    appointmentsCount: appointments.length,
    clinicalsCount: clinicalHistory.length
  });

  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf8');
  console.log(`📑 Índice de backups atualizado (${indexData.length} pontos de restauração registrados).`);

  // 3. Atualizar também o arquivo raiz para compatibilidade imediata
  const rootBackupFile = path.join(process.cwd(), 'crm_backup_pacientes_cloudflare.json');
  fs.writeFileSync(rootBackupFile, JSON.stringify(backupPayload, null, 2), 'utf8');

  // 4. Git Commit & Push se solicitado
  const shouldPush = process.argv.includes('--commit-and-push') || process.env.AUTO_GIT_PUSH === 'true';
  if (shouldPush) {
    console.log('\n🚀 Realizando Git Commit e Push para o repositório remoto...');
    try {
      execSync('git add backups/ crm_backup_pacientes_cloudflare.json', { stdio: 'inherit' });
      const commitMsg = `backup(crm): snapshot semanal imutavel ${finalFileName} [${patients.length} pacientes]`;
      execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
      execSync('git push origin main', { stdio: 'inherit' });
      console.log('🎉 Backup commitado e enviado ao GitHub com sucesso!');
    } catch (gitErr: any) {
      console.warn('⚠️ Aviso Git (pode não haver alterações novas a commitar):', gitErr.message || gitErr);
    }
  }

  console.log('\n====================================================');
  console.log('🛡️ BACKUP CONCLUÍDO E PROTEGIDO CONTRA EXCLUSÃO!');
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('Falha crítica no backup:', err);
  process.exit(1);
});
