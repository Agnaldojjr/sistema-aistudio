const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Carregar variáveis de ambiente (supondo que o usuário rode com dotenv ou já tenha no ambiente)
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local') }); // fallback

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não definidos no .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = 'patient_files'; // Conforme supabaseStorage.ts

function getSafePatientPath(patientName) {
  return (patientName || 'Anonimo').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
}

// Levenshtein distance fallback
function levenshtein(a, b) {
    if(a.length === 0) return b.length;
    if(b.length === 0) return a.length;
    var matrix = [];
    for(let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for(let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for(let i = 1; i <= b.length; i++) {
        for(let j = 1; j <= a.length; j++) {
            if(b.charAt(i-1) == a.charAt(j-1)) {
                matrix[i][j] = matrix[i-1][j-1];
            } else {
                matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

async function listAllFilesRecursively(bucket, currentPath = '') {
  let allFiles = [];
  const { data, error } = await supabase.storage.from(bucket).list(currentPath);
  if (error) {
    console.error(`Erro listando ${currentPath}:`, error);
    return allFiles;
  }
  for (const item of data) {
    if (item.name === '.emptyFolderPlaceholder') continue;
    const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
    if (!item.id) {
      // Pasta
      const subFiles = await listAllFilesRecursively(bucket, itemPath);
      allFiles = allFiles.concat(subFiles);
    } else {
      // Arquivo
      allFiles.push({
        path: itemPath,
        size: item.metadata?.size || 0,
        updated_at: item.updated_at,
        metadata: item.metadata
      });
    }
  }
  return allFiles;
}

async function runFase0() {
  console.log("=== Fase 0: Snapshot de Segurança ===");
  console.log("Listando todos os arquivos do bucket...");
  const files = await listAllFilesRecursively(BUCKET_NAME);
  fs.writeFileSync('snapshot-pre-migracao.json', JSON.stringify(files, null, 2));
  console.log(`Snapshot criado: snapshot-pre-migracao.json com ${files.length} arquivos.`);
}

async function runFase2() {
  console.log("=== Fase 2: Script de Mapeamento (Dry-Run) ===");
  
  // 1. Obter pacientes do CRM
  const { data: clinicDataRows, error: dbError } = await supabase.from('clinic_data').select('user_id, crm_data');
  if (dbError) {
      console.error("Erro ao buscar pacientes:", dbError);
      return;
  }
  let patients = [];
  for (const row of clinicDataRows) {
      if (row.crm_data && row.crm_data.patients) {
          patients = patients.concat(row.crm_data.patients.map(p => ({ id: p.id, name: p.name, user_id: row.user_id })));
      }
  }
  console.log(`Encontrados ${patients.length} pacientes no CRM.`);

  // 2. Obter pastas raízes (que são os UserIDs, depois as pastas de pacientes)
  const { data: users, error: listError } = await supabase.storage.from(BUCKET_NAME).list('');
  if (listError) return console.error("Erro ao listar raízes", listError);

  const report = [];
  
  for (const user of users) {
      if (!user.id) { // É uma pasta de usuário
          const userId = user.name;
          const { data: userFolders } = await supabase.storage.from(BUCKET_NAME).list(userId);
          if (!userFolders) continue;

          for (const folder of userFolders) {
              if (folder.id) continue; // Pula arquivos soltos na raiz do usuário
              const folderName = folder.name; // Nome antigo

              // Acha correspondência
              let bestMatch = null;
              let bestScore = 0;

              for (const p of patients) {
                  const safeName = getSafePatientPath(p.name);
                  if (safeName === folderName || p.id === folderName) {
                      bestScore = 100;
                      bestMatch = p;
                      break;
                  }
                  // Score baseado em distância (simples)
                  const dist = levenshtein(safeName.toLowerCase(), folderName.toLowerCase());
                  const maxLen = Math.max(safeName.length, folderName.length);
                  const score = ((maxLen - dist) / maxLen) * 100;
                  if (score > bestScore) {
                      bestScore = score;
                      bestMatch = p;
                  }
              }

              let classification = 'órfã';
              if (bestScore === 100) classification = 'exato';
              else if (bestScore > 90) classification = 'alta-confianca';
              else if (bestScore > 0) classification = 'ambiguo';

              report.push({
                  userId,
                  pasta_antiga: folderName,
                  paciente_sugerido_id: bestMatch?.id || 'NENHUM',
                  paciente_sugerido_nome: bestMatch?.name || 'NENHUM',
                  confianca: bestScore.toFixed(2),
                  classificacao: classification
              });
          }
      }
  }

  const csvLines = ["userId,pasta_antiga,paciente_sugerido_id,paciente_sugerido_nome,confianca,classificacao"];
  report.forEach(r => csvLines.push(`${r.userId},${r.pasta_antiga},${r.paciente_sugerido_id},${r.paciente_sugerido_nome},${r.confianca},${r.classificacao}`));
  fs.writeFileSync('dry-run-report.csv', csvLines.join('\n'));
  console.log(`Relatório salvo em dry-run-report.csv com ${report.length} pastas mapeadas.`);
  console.log("ATENÇÃO: Revise o dry-run-report.csv antes de rodar a Fase 3!");
}

async function runFase3a() {
    console.log("=== Fase 3a: Cópia Segura ===");
    if (!fs.existsSync('dry-run-report.csv')) {
        return console.error("Rode a Fase 2 primeiro e verifique dry-run-report.csv");
    }

    const lines = fs.readFileSync('dry-run-report.csv', 'utf-8').split('\n').slice(1);
    const log = [];

    for (const line of lines) {
        if (!line.trim()) continue;
        const [userId, pastaAntiga, pacienteId, nome, confianca, classificacao] = line.split(',');

        if (classificacao === 'ambiguo' || classificacao === 'órfã') {
            console.log(`Ignorando ${pastaAntiga} devido à classificação ${classificacao}`);
            continue;
        }

        if (pastaAntiga === pacienteId) {
            // Já está no formato correto
            continue;
        }

        console.log(`Copiando arquivos de ${pastaAntiga} para ${pacienteId}...`);
        const files = await listAllFilesRecursively(BUCKET_NAME, `${userId}/${pastaAntiga}`);
        
        for (const f of files) {
            const relativePath = f.path.substring(`${userId}/${pastaAntiga}/`.length);
            const targetPath = `${userId}/${pacienteId}/${relativePath}`;

            const { error } = await supabase.storage.from(BUCKET_NAME).copy(f.path, targetPath);
            if (error) {
                console.error(`Falha ao copiar ${f.path}:`, error);
                log.push({ status: 'pendente', source: f.path, dest: targetPath, error: error.message });
            } else {
                console.log(`  -> Copiado: ${targetPath}`);
                log.push({ status: 'copiado', source: f.path, dest: targetPath });
            }
        }
    }

    fs.writeFileSync('migration-log.json', JSON.stringify(log, null, 2));
    console.log("Fase 3a concluída. Verifique migration-log.json.");
}

const args = process.argv.slice(2);
const fase = args[args.indexOf('--fase') + 1];

if (fase === '0') runFase0();
else if (fase === '2') runFase2();
else if (fase === '3a') runFase3a();
else {
    console.log("Uso: node scripts/migracao-storage.js --fase [0|2|3a]");
}
