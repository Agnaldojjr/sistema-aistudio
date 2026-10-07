import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_USER_ID = '78d7e8b0-9a7a-4eb3-8ba6-37a5ce401b46';
const SECONDARY_USER_ID = 'c91fd4ab-88ef-4dbd-830f-9e81b42ebae2';
const GIT_COMMIT = 'c0578e25a68bff65d5b628a56cd3ddf76c0fef59';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERRO: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function normalizeName(name: string): string {
  return (name || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

async function run() {
  console.log('================================================================');
  console.log('🚀 RESTAURAÇÃO TOTAL: HISTÓRICO GITHUB (BLUEDENTAL) + CLOUDFLARE');
  console.log('================================================================\n');

  // 1. Resgatar arquivo histórico do commit do GitHub
  console.log(`📦 Extraindo src/data/bluedental_backup_parsed.json do commit ${GIT_COMMIT}...`);
  let blueData: any;
  try {
    const rawContent = execSync(`git show ${GIT_COMMIT}:src/data/bluedental_backup_parsed.json`, {
      maxBuffer: 60 * 1024 * 1024,
      encoding: 'utf8'
    });
    blueData = JSON.parse(rawContent);
    console.log('✅ Arquivo histórico do GitHub extraído com sucesso!');
  } catch (err: any) {
    console.error('❌ Erro ao extrair arquivo do histórico do Git:', err.message);
    process.exit(1);
  }

  const bluePatients = blueData.patients || [];
  const blueAppointments = blueData.appointments || [];
  const blueClinicals = blueData.clinical_history || [];
  const blueAnamnese = blueData.anamnese || [];
  const bluePayments = blueData.pagamentos || [];

  console.log(`Dados encontrados no backup do GitHub:`);
  console.log(` - Pacientes: ${bluePatients.length}`);
  console.log(` - Consultas/Agendamentos: ${blueAppointments.length}`);
  console.log(` - Histórico Clínico / Procedimentos: ${blueClinicals.length}`);
  console.log(` - Anamneses: ${blueAnamnese.length}`);
  console.log(` - Pagamentos / Financeiro: ${bluePayments.length}\n`);

  // 2. Buscar base atual do Supabase
  console.log(`📡 Buscando base atual do CRM no Supabase para o usuário ${TARGET_USER_ID}...`);
  const { data: currentData, error: fetchErr } = await supabase
    .from('clinic_data')
    .select('crm_data')
    .eq('user_id', TARGET_USER_ID)
    .single();

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    console.error('Erro ao buscar dados do Supabase:', fetchErr);
    process.exit(1);
  }

  const crm_data = currentData?.crm_data || {
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
  if (!Array.isArray(crm_data.appointments)) crm_data.appointments = [];
  if (!Array.isArray(crm_data.clinical_history)) crm_data.clinical_history = [];
  if (!Array.isArray(crm_data.anamnese)) crm_data.anamnese = [];
  if (!Array.isArray(crm_data.galeria)) crm_data.galeria = [];
  if (!Array.isArray(crm_data.pagamentos)) crm_data.pagamentos = [];

  console.log(`Pacientes atuais no Supabase: ${crm_data.patients.length}`);
  console.log(`Fotos atuais na galeria: ${crm_data.galeria.length}\n`);

  // 3. Mesclar pacientes com inteligência e prevenção de duplicidade
  console.log('🔄 Mesclando e enriquecendo cadastros de pacientes...');

  // Mapear pacientes existentes por nome normalizado e por ID/código
  const patientByName = new Map<string, any>();
  const patientById = new Map<string, any>();

  for (const p of crm_data.patients) {
    if (p.name) patientByName.set(normalizeName(p.name), p);
    if (p.id) patientById.set(String(p.id), p);
    if (p.codigo_paciente) patientById.set(String(p.codigo_paciente), p);
  }

  let enrichedCount = 0;
  let addedCount = 0;

  for (const bp of bluePatients) {
    const norm = normalizeName(bp.name);
    const existing = patientByName.get(norm) || patientById.get(String(bp.id));

    if (existing) {
      // Enriquecer dados faltantes no paciente existente
      if (!existing.cpf && bp.cpf) existing.cpf = bp.cpf;
      if (!existing.rg && bp.rg) existing.rg = bp.rg;
      if (!existing.phone && bp.phone) existing.phone = bp.phone;
      if (!existing.mobile && bp.mobile) existing.mobile = bp.mobile;
      if (!existing.email && bp.email) existing.email = bp.email;
      if (!existing.birthDate && bp.birthDate) existing.birthDate = bp.birthDate;
      if (!existing.gender && bp.gender) existing.gender = bp.gender;
      if (!existing.maritalStatus && bp.maritalStatus) existing.maritalStatus = bp.maritalStatus;
      if (!existing.healthInsurance && bp.healthInsurance) existing.healthInsurance = bp.healthInsurance;
      if (!existing.photoUrl && bp.photoUrl) existing.photoUrl = bp.photoUrl;
      if (!existing.codigo_paciente && bp.id) existing.codigo_paciente = String(bp.id);
      existing.updatedAt = new Date().toISOString();
      enrichedCount++;
    } else {
      // Inserir novo paciente vindo do BlueDental
      const newPatient = {
        id: String(bp.id),
        codigo_paciente: String(bp.id),
        name: bp.name.trim().toUpperCase(),
        cpf: bp.cpf || undefined,
        rg: bp.rg || undefined,
        phone: bp.phone || '',
        mobile: bp.mobile || '',
        email: bp.email || '',
        birthDate: bp.birthDate || undefined,
        gender: bp.gender || undefined,
        maritalStatus: bp.maritalStatus || undefined,
        healthInsurance: bp.healthInsurance || 'PARTICULAR',
        photoUrl: bp.photoUrl || undefined,
        status: bp.status || 'ATIVO',
        observations: bp.observations || 'Restaurado do backup BlueDental (GitHub)',
        createdAt: bp.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      crm_data.patients.push(newPatient);
      patientByName.set(norm, newPatient);
      patientById.set(String(bp.id), newPatient);
      addedCount++;
    }
  }

  // Ordenar lista de pacientes por nome
  crm_data.patients.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

  console.log(`✅ Pacientes adicionados do histórico: ${addedCount}`);
  console.log(`✅ Pacientes existentes enriquecidos (com CPF, Telefone, etc.): ${enrichedCount}`);
  console.log(`📊 TOTAL CONSOLIDADO DE PACIENTES NO CRM: ${crm_data.patients.length}\n`);

  // 4. Mesclar Consultas / Agendamentos
  console.log('📅 Mesclando agendamentos e consultas históricas...');
  const existingAppIds = new Set(crm_data.appointments.map((a: any) => String(a.id)));
  let appsAdded = 0;

  for (const app of blueAppointments) {
    if (!existingAppIds.has(String(app.id))) {
      crm_data.appointments.push({
        id: String(app.id),
        patientId: String(app.patientId),
        patientName: app.patientName || '',
        date: app.date || '',
        time: app.time ? app.time.slice(0, 5) : '08:00',
        dentist: app.dentist || 'Dr. Agnaldo Ferreira',
        status: app.status || 'Atendido',
        observations: app.notes || '',
        createdAt: new Date().toISOString()
      });
      existingAppIds.add(String(app.id));
      appsAdded++;
    }
  }
  console.log(`✅ Consultas incorporadas: ${appsAdded} (Total: ${crm_data.appointments.length})\n`);

  // 5. Mesclar Históricos Clínicos / Procedimentos
  console.log('🩺 Mesclando procedimentos e evolução clínica...');
  const existingClinIds = new Set(crm_data.clinical_history.map((c: any) => String(c.id)));
  let clinAdded = 0;

  for (const clin of blueClinicals) {
    if (!existingClinIds.has(String(clin.id))) {
      const toothDesc = clin.tooth ? `Dente ${clin.tooth} - ` : '';
      const procDesc = `${toothDesc}${clin.procedure || ''}`.trim();
      const dateOnly = clin.date ? clin.date.split(' ')[0] : new Date().toISOString().split('T')[0];

      crm_data.clinical_history.push({
        id: String(clin.id),
        patientId: String(clin.patientId),
        date: dateOnly,
        proceduresPerformed: procDesc,
        treatmentEvolution: clin.status || 'Realizado',
        observations: clin.notes || '',
        createdAt: clin.date || new Date().toISOString()
      });
      existingClinIds.add(String(clin.id));
      clinAdded++;
    }
  }
  console.log(`✅ Procedimentos clínicos incorporados: ${clinAdded} (Total: ${crm_data.clinical_history.length})\n`);

  // 6. Mesclar Anamneses Médicas
  console.log('📋 Mesclando fichas de anamnese...');
  const existingAnamIds = new Set(crm_data.anamnese.map((a: any) => String(a.id)));
  let anamAdded = 0;

  for (const an of blueAnamnese) {
    if (!existingAnamIds.has(String(an.id))) {
      crm_data.anamnese.push({
        id: String(an.id),
        patientId: String(an.patientId),
        pergunta: an.question || '',
        resposta: an.answer || '',
        data: an.date || new Date().toISOString()
      });
      existingAnamIds.add(String(an.id));
      anamAdded++;
    }
  }
  console.log(`✅ Registros de anamnese incorporados: ${anamAdded} (Total: ${crm_data.anamnese.length})\n`);

  // 7. Mesclar Pagamentos / Financeiro
  console.log('💳 Mesclando histórico financeiro e pagamentos...');
  const existingPayIds = new Set(crm_data.pagamentos.map((p: any) => String(p.id)));
  let payAdded = 0;

  for (const pay of bluePayments) {
    if (!existingPayIds.has(String(pay.id))) {
      crm_data.pagamentos.push({
        id: String(pay.id),
        patientId: String(pay.patientId),
        patientName: pay.patientName || '',
        valor: pay.value || pay.amount || 0,
        metodo: pay.method || pay.paymentMethod || 'PIX',
        descricao: pay.description || '',
        status: pay.status || 'Pago',
        data: pay.date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
      existingPayIds.add(String(pay.id));
      payAdded++;
    }
  }
  console.log(`✅ Pagamentos incorporados: ${payAdded} (Total: ${crm_data.pagamentos.length})\n`);

  // 8. Salvar no Supabase para as duas contas
  console.log(`💾 Gravando base completa consolidada no Supabase para a conta principal (${TARGET_USER_ID})...`);
  const { error: savePrimaryErr } = await supabase
    .from('clinic_data')
    .upsert({
      user_id: TARGET_USER_ID,
      crm_data: crm_data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (savePrimaryErr) {
    console.error('❌ Erro ao salvar no Supabase (Principal):', savePrimaryErr);
    throw savePrimaryErr;
  }

  console.log(`💾 Sincronizando também na conta secundária (${SECONDARY_USER_ID})...`);
  await supabase
    .from('clinic_data')
    .upsert({
      user_id: SECONDARY_USER_ID,
      crm_data: crm_data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  console.log('✅ Ambas as contas no Supabase atualizadas com sucesso!\n');

  // 9. Atualizar backup consolidado em JSON
  const backupFilePath = path.join(process.cwd(), 'crm_backup_pacientes_cloudflare.json');
  const backupPayload = {
    exportedAt: new Date().toISOString(),
    userId: TARGET_USER_ID,
    totalPatients: crm_data.patients.length,
    totalGalleryPhotos: crm_data.galeria.length,
    totalAppointments: crm_data.appointments.length,
    totalClinicalHistories: crm_data.clinical_history.length,
    totalAnamnesis: crm_data.anamnese.length,
    totalPayments: crm_data.pagamentos.length,
    patients: crm_data.patients,
    galeria: crm_data.galeria,
    appointments: crm_data.appointments,
    clinical_history: crm_data.clinical_history,
    anamnese: crm_data.anamnese,
    pagamentos: crm_data.pagamentos
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf8');
  console.log(`📁 Backup consolidado salvo em: ${backupFilePath}`);

  console.log('\n================================================================');
  console.log('🎉 RESTAURAÇÃO COMPLETA FINALIZADA COM SUCESSO TOTAL!');
  console.log(`👤 Pacientes no CRM: ${crm_data.patients.length}`);
  console.log(`📸 Fotos no CRM: ${crm_data.galeria.length}`);
  console.log(`📅 Consultas no CRM: ${crm_data.appointments.length}`);
  console.log(`🩺 Históricos Clínicos: ${crm_data.clinical_history.length}`);
  console.log(`📋 Anamneses: ${crm_data.anamnese.length}`);
  console.log(`💳 Pagamentos: ${crm_data.pagamentos.length}`);
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('Falha crítica na restauração:', err);
  process.exit(1);
});
