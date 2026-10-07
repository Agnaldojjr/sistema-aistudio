import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_USER_ID = '78d7e8b0-9a7a-4eb3-8ba6-37a5ce401b46';
const SECONDARY_USER_ID = 'c91fd4ab-88ef-4dbd-830f-9e81b42ebae2';
const CLOUDFLARE_PUBLIC_URL = process.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-cabf0ef480a14522ac32d4c2a0451f18.r2.dev';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERRO: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const backupDir = 'C:\\Users\\Agnaldo\\OneDrive\\Área de Trabalho\\backup_completo\\patient_files';
const targetUserDir = path.join(backupDir, TARGET_USER_ID);

// Mapeamentos conhecidos de pastas numéricas para nomes reais
const KNOWN_NAME_MAPPINGS: Record<string, string> = {
  '1309889': 'DANIELA COSTA FERNANDES DA SILVA',
  '1366505': 'ALICE EMANUELE FERREIRA COSTA',
  '1386293': 'AGNALDO',
  '1394056': 'JULIO CESAR BOMFIM CIDREIRA',
  '1403523': 'ALINE BEATRIZ BATISTA LOURENÇO',
  '1554841': 'LUCIMARA DOS SANTOS FIRMINO',
  '1617968': 'LOURDES APARECIDA DE BARROS',
  '1619845': 'VANDERMON DA SILVA LOPES',
  '1624130': 'GIOVANA'
};

function normalizeName(name: string): string {
  return (name || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

async function run() {
  console.log('====================================================');
  console.log('🚀 INICIANDO CATALOGAÇÃO E RECADASTRO VIA CLOUDFLARE R2');
  console.log('====================================================\n');

  // 1. Obter base atual do Supabase para os dois usuários
  console.log(`📡 Consultando Supabase para o usuário principal (${TARGET_USER_ID})...`);
  const { data: primaryData, error: err1 } = await supabase
    .from('clinic_data')
    .select('crm_data')
    .eq('user_id', TARGET_USER_ID)
    .single();

  if (err1 && err1.code !== 'PGRST116') {
    console.error('Erro ao buscar dados do usuário principal:', err1);
  }

  const { data: secData } = await supabase
    .from('clinic_data')
    .select('crm_data')
    .eq('user_id', SECONDARY_USER_ID)
    .single();

  const crm_data = primaryData?.crm_data || {
    patients: [],
    appointments: [],
    clinical_history: [],
    communications: [],
    anamnese: [],
    avisos: [],
    documentos: [],
    galeria: [],
    pagamentos: [],
    tratamentos: [],
    odontograma: []
  };

  if (!Array.isArray(crm_data.patients)) crm_data.patients = [];
  if (!Array.isArray(crm_data.galeria)) crm_data.galeria = [];

  const secPatients = secData?.crm_data?.patients || [];
  console.log(`Pacientes existentes no Supabase (Principal): ${crm_data.patients.length}`);
  console.log(`Pacientes no usuário secundário para cruzamento: ${secPatients.length}`);

  // 2. Extrair dados das pastas do Cloudflare R2
  if (!fs.existsSync(targetUserDir)) {
    console.error(`Diretório ${targetUserDir} não encontrado.`);
    process.exit(1);
  }

  const allItems = fs.readdirSync(targetUserDir);
  const patientFolders = allItems.filter(f => fs.statSync(path.join(targetUserDir, f)).isDirectory());
  console.log(`\n📂 Pastas de pacientes encontradas no Cloudflare R2: ${patientFolders.length}`);

  // Ler também os arquivos de telemetria para mapeamentos adicionais
  const telemetryFiles = allItems.filter(f => f.startsWith('telemetry_logs_') && f.endsWith('.json'));
  for (const tFile of telemetryFiles) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(targetUserDir, tFile), 'utf8'));
      if (content.patientId && content.fallbackPatientName) {
        if (!KNOWN_NAME_MAPPINGS[content.patientId]) {
          KNOWN_NAME_MAPPINGS[content.patientId] = content.fallbackPatientName;
        }
      }
    } catch (_) {}
  }

  let totalPhotosLinked = 0;
  let newPatientsAdded = 0;
  let existingUpdated = 0;

  for (const folder of patientFolders) {
    const pPath = path.join(targetUserDir, folder);
    const files = fs.readdirSync(pPath);

    let resolvedName: string | null = KNOWN_NAME_MAPPINGS[folder] || null;
    let budgetProposal: any = null;
    const photos: string[] = [];

    // Vasculhar arquivos na raiz da pasta do paciente
    for (const file of files) {
      const fullFilePath = path.join(pPath, file);
      if (fs.statSync(fullFilePath).isDirectory()) continue;

      const lower = file.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) {
        photos.push(file);
      }

      if (lower.endsWith('.json')) {
        try {
          const jsonContent = JSON.parse(fs.readFileSync(fullFilePath, 'utf8'));
          if (!resolvedName) {
            resolvedName = jsonContent.proposal?.patientName || jsonContent.patientName || jsonContent.patient?.name || null;
          }
          if (jsonContent.proposal && !budgetProposal) {
            budgetProposal = jsonContent.proposal;
          }
        } catch (_) {}
      }
    }

    // Vasculhar subpasta Orcamentos se existir
    const orcDir = path.join(pPath, 'Orcamentos');
    if (fs.existsSync(orcDir)) {
      const orcFiles = fs.readdirSync(orcDir);
      for (const file of orcFiles) {
        const fullFilePath = path.join(orcDir, file);
        if (fs.statSync(fullFilePath).isDirectory()) continue;

        const lower = file.toLowerCase();
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) {
          photos.push(`Orcamentos/${file}`);
        }

        if (lower.endsWith('.json')) {
          try {
            const jsonContent = JSON.parse(fs.readFileSync(fullFilePath, 'utf8'));
            if (!resolvedName) {
              resolvedName = jsonContent.proposal?.patientName || jsonContent.patientName || jsonContent.patient?.name || null;
            }
            if (jsonContent.proposal && !budgetProposal) {
              budgetProposal = jsonContent.proposal;
            }
          } catch (_) {}
        }

        if (!resolvedName && lower.endsWith('.pdf') && lower.startsWith('orcamento_')) {
          const match = file.match(/^orcamento_(.+?)_\d/i);
          if (match && match[1]) {
            resolvedName = match[1].replace(/_/g, ' ');
          }
        }
      }
    }

    // Se ainda não resolveu e a pasta não é numérica, usar o nome da pasta
    if (!resolvedName) {
      if (isNaN(Number(folder))) {
        resolvedName = folder.replace(/_/g, ' ');
      } else {
        resolvedName = `PACIENTE ${folder}`;
      }
    }

    const cleanName = normalizeName(resolvedName);
    const isNumericFolder = !isNaN(Number(folder));
    const patientCode = isNumericFolder ? folder : `COD-${Math.floor(1000 + Math.random() * 9000)}`;

    // Buscar se já existe no crm_data.patients (por ID, código ou nome normalizado)
    let patientRecord = crm_data.patients.find((p: any) =>
      p.id === folder ||
      p.codigo_paciente === folder ||
      normalizeName(p.name) === cleanName
    );

    // Se não encontrou no principal, verificar se existe na conta secundária para herdar CPF/Telefone
    const secRecord = secPatients.find((p: any) =>
      p.id === folder ||
      p.codigo_paciente === folder ||
      normalizeName(p.name) === cleanName
    );

    // Determinar foto de perfil (priorizar 'smile', 'perfil' ou a primeira foto)
    let profilePhotoUrl: string | undefined = undefined;
    if (photos.length > 0) {
      const smilePhoto = photos.find(ph => ph.toLowerCase().includes('smile') || ph.toLowerCase().includes('perfil') || ph.toLowerCase().includes('rosto'));
      const chosenPhoto = smilePhoto || photos[0];
      profilePhotoUrl = `${CLOUDFLARE_PUBLIC_URL.replace(/\/$/, '')}/${encodeURIComponent(folder)}/${encodeURIComponent(chosenPhoto).replace(/%2F/g, '/')}`;
    }

    const patientId = patientRecord?.id || secRecord?.id || (isNumericFolder ? folder : `pat_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

    if (patientRecord) {
      // Atualizar dados existentes enriquecendo
      if (patientRecord.name === folder || patientRecord.name.startsWith('1')) {
        patientRecord.name = cleanName;
      }
      if (!patientRecord.photoUrl && profilePhotoUrl) {
        patientRecord.photoUrl = profilePhotoUrl;
      }
      if (!patientRecord.phone && secRecord?.phone) {
        patientRecord.phone = secRecord.phone;
      }
      if (!patientRecord.mobile && secRecord?.mobile) {
        patientRecord.mobile = secRecord.mobile;
      }
      if (!patientRecord.cpf && secRecord?.cpf) {
        patientRecord.cpf = secRecord.cpf;
      }
      patientRecord.updatedAt = new Date().toISOString();
      existingUpdated++;
    } else {
      // Criar novo cadastro
      patientRecord = {
        id: patientId,
        codigo_paciente: patientCode,
        name: cleanName,
        phone: secRecord?.phone || '',
        mobile: secRecord?.mobile || '',
        cpf: secRecord?.cpf || undefined,
        photoUrl: profilePhotoUrl,
        healthInsurance: secRecord?.healthInsurance || 'PARTICULAR',
        observations: secRecord?.observations || 'Catalogado e importado do Cloudflare R2',
        createdAt: secRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      crm_data.patients.push(patientRecord);
      newPatientsAdded++;
    }

    // Vincular todas as fotos à galeria do paciente no CRM
    for (const photoFile of photos) {
      const photoUrl = `${CLOUDFLARE_PUBLIC_URL.replace(/\/$/, '')}/${encodeURIComponent(folder)}/${encodeURIComponent(photoFile).replace(/%2F/g, '/')}`;
      
      const alreadyInGallery = crm_data.galeria.some((g: any) => g.url === photoUrl || (g.patientId === patientId && g.description === photoFile));
      if (!alreadyInGallery) {
        crm_data.galeria.push({
          id: `gal_${patientId}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          patientId: patientId,
          url: photoUrl,
          description: photoFile,
          date: new Date().toISOString()
        });
        totalPhotosLinked++;
      }
    }
  }

  // Ordenar lista de pacientes por ordem alfabética
  crm_data.patients.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

  console.log('\n----------------------------------------------------');
  console.log(`✅ Pacientes novos criados: ${newPatientsAdded}`);
  console.log(`🔄 Pacientes já existentes atualizados/enriquecidos: ${existingUpdated}`);
  console.log(`📊 Total final de pacientes no CRM: ${crm_data.patients.length}`);
  console.log(`📸 Fotos vinculadas na galeria: ${totalPhotosLinked} (Total na galeria: ${crm_data.galeria.length})`);
  console.log('----------------------------------------------------\n');

  // 3. Salvar no Supabase
  console.log(`💾 Gravando dados consolidados no Supabase para o usuário ${TARGET_USER_ID}...`);
  const { error: saveErr } = await supabase
    .from('clinic_data')
    .upsert({
      user_id: TARGET_USER_ID,
      crm_data: crm_data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (saveErr) {
    console.error('❌ Erro ao salvar no Supabase:', saveErr);
    throw saveErr;
  }
  console.log('✅ Base de dados do Supabase atualizada com sucesso!');

  // 4. Salvar backup consolidado em JSON para versionamento no GitHub
  const backupFilePath = path.join(process.cwd(), 'crm_backup_pacientes_cloudflare.json');
  const backupPayload = {
    exportedAt: new Date().toISOString(),
    userId: TARGET_USER_ID,
    totalPatients: crm_data.patients.length,
    totalGalleryPhotos: crm_data.galeria.length,
    patients: crm_data.patients,
    galeria: crm_data.galeria
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf8');
  console.log(`📁 Backup versionável gerado em: ${backupFilePath}`);

  // 5. Atualizar .env com DEFAULT_USER_ID caso esteja vazio ou placeholder
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('DEFAULT_USER_ID=') && !envContent.includes(`DEFAULT_USER_ID=${TARGET_USER_ID}`)) {
      envContent = envContent.replace(/DEFAULT_USER_ID=.*/, `DEFAULT_USER_ID=${TARGET_USER_ID}`);
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log(`🔧 .env atualizado com DEFAULT_USER_ID=${TARGET_USER_ID}`);
    }
  }

  console.log('\n🎉 PROCESSO CONCLUÍDO COM SUCESSO TOTAL!');
}

run().catch(err => {
  console.error('Falha na execução:', err);
  process.exit(1);
});
