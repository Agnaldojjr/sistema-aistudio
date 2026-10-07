import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: Credenciais do Supabase não encontradas no .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const backupDir = "C:\\Users\\Agnaldo\\OneDrive\\Área de Trabalho\\backup_completo\\patient_files";

async function run() {
  console.log("Iniciando restauração de pacientes perdidos...");
  
  if (!fs.existsSync(backupDir)) {
    console.error("Pasta de backup não encontrada.");
    process.exit(1);
  }

  // Pegar as pastas de userId
  const userFolders = fs.readdirSync(backupDir).filter(f => fs.statSync(path.join(backupDir, f)).isDirectory());
  
  for (const userId of userFolders) {
    console.log(`Processando dados para o dentista (User ID): ${userId}`);
    
    // Pegar o crm_data atual do Supabase
    const { data: clinicData, error: fetchErr } = await supabase
      .from('clinic_data')
      .select('crm_data')
      .eq('user_id', userId)
      .single();
      
    if (fetchErr && fetchErr.code !== 'PGRST116') {
      console.error(`Erro ao buscar dados do dentista ${userId}:`, fetchErr);
      continue;
    }
    
    let crm_data = clinicData?.crm_data || { patients: [], avisos: [], galeria: [], anamnese: [] };
    if (!crm_data.patients) crm_data.patients = [];
    
    // Ler as pastas de pacientes locais
    const userPath = path.join(backupDir, userId);
    const patientFolders = fs.readdirSync(userPath).filter(f => fs.statSync(path.join(userPath, f)).isDirectory());
    
    console.log(`Encontradas ${patientFolders.length} pastas de pacientes no backup.`);
    
    let addedCount = 0;
    
    for (const pFolder of patientFolders) {
      // pFolder é o patientId usado no Cloudflare!
      // Verificar se o paciente já existe no crm_data (pelo id ou pelo safe name)
      const exists = crm_data.patients.find(p => p.id === pFolder || p.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() === pFolder.toUpperCase());
      
      if (!exists) {
        // Tentar ler o orcamento_salvo.json para extrair o nome real
        let realName = pFolder.replace(/_/g, ' '); // Fallback
        const jsonPath = path.join(userPath, pFolder, 'orcamento_salvo.json');
        
        if (fs.existsSync(jsonPath)) {
          try {
            const orc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            if (orc.proposal && orc.proposal.patientName) {
              realName = orc.proposal.patientName;
            }
          } catch(e) {}
        }
        
        // Adicionar o paciente
        crm_data.patients.push({
          id: pFolder,
          name: realName.toUpperCase(),
          phone: "",
          mobile: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          observations: "Restaurado do backup do Cloudflare",
          healthInsurance: "PARTICULAR"
        });
        addedCount++;
        console.log(`+ Restaurado: ${realName} (ID: ${pFolder})`);
      }
    }
    
    if (addedCount > 0) {
      console.log(`Salvando ${addedCount} novos pacientes no banco de dados para o dentista ${userId}...`);
      
      if (clinicData) {
        const { error: updateErr } = await supabase
          .from('clinic_data')
          .update({ crm_data, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        if (updateErr) console.error("Erro ao atualizar banco:", updateErr);
        else console.log("✅ Atualizado com sucesso!");
      } else {
        const { error: insertErr } = await supabase
          .from('clinic_data')
          .insert({ user_id: userId, crm_data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        if (insertErr) console.error("Erro ao inserir no banco:", insertErr);
        else console.log("✅ Inserido com sucesso!");
      }
    } else {
      console.log("Nenhum paciente novo para adicionar (todos já estavam no banco).");
    }
  }
  
  console.log("Restauração finalizada!");
}

run();
