import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_USER_ID = process.env.DEFAULT_USER_ID || '78d7e8b0-9a7a-4eb3-8ba6-37a5ce401b46';
const SECONDARY_USER_ID = 'c91fd4ab-88ef-4dbd-830f-9e81b42ebae2';

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
  console.log('🔄 RESTAURADOR DE BACKUP IMUTÁVEL DO GITHUB');
  console.log('====================================================\n');

  if (!fs.existsSync(BACKUPS_DIR)) {
    console.error('❌ Diretório de backups não encontrado:', BACKUPS_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('crm_backup_') && f.endsWith('.json'));

  if (files.length === 0) {
    console.error('❌ Nenhum arquivo de backup encontrado na pasta backups/crm/');
    process.exit(1);
  }

  // Ordenar decrescente (mais recente primeiro)
  files.sort().reverse();

  console.log(`Pontos de restauração disponíveis (${files.length} backups):`);
  files.slice(0, 5).forEach((f, idx) => {
    console.log(` [${idx + 1}] ${f}`);
  });

  // O arquivo a restaurar pode ser passado por argumento ou o mais recente por padrão
  const targetFile = process.argv[2] || files[0];
  const targetFilePath = path.join(BACKUPS_DIR, targetFile);

  if (!fs.existsSync(targetFilePath)) {
    console.error(`❌ Arquivo de backup selecionado não existe: ${targetFilePath}`);
    process.exit(1);
  }

  console.log(`\n📦 Lendo backup selecionado: ${targetFile}...`);
  const raw = JSON.parse(fs.readFileSync(targetFilePath, 'utf8'));
  const crm_data = raw.crm_data || raw;

  const patients = crm_data.patients || [];
  const galeria = crm_data.galeria || [];
  const appointments = crm_data.appointments || [];

  console.log(`Conteúdo do snapshot:`);
  console.log(` - Pacientes: ${patients.length}`);
  console.log(` - Fotos na galeria: ${galeria.length}`);
  console.log(` - Consultas: ${appointments.length}`);

  if (patients.length === 0) {
    console.error('🚨 ALERTA: O backup selecionado não contém pacientes. Restauração cancelada por segurança.');
    process.exit(1);
  }

  console.log(`\n💾 Gravando dados no Supabase para a conta principal (${TARGET_USER_ID})...`);
  const { error: err1 } = await supabase
    .from('clinic_data')
    .upsert({
      user_id: TARGET_USER_ID,
      crm_data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (err1) {
    console.error('❌ Erro ao salvar na conta principal:', err1);
    process.exit(1);
  }

  console.log(`💾 Sincronizando também na conta secundária (${SECONDARY_USER_ID})...`);
  await supabase
    .from('clinic_data')
    .upsert({
      user_id: SECONDARY_USER_ID,
      crm_data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  console.log('\n====================================================');
  console.log('🎉 RESTAURAÇÃO EXECUTADA COM SUCESSO!');
  console.log(`   ${patients.length} pacientes e seus históricos foram restaurados no Supabase.`);
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('Erro na restauração:', err);
  process.exit(1);
});
