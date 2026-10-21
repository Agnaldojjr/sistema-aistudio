import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const INCLUDED_DIRS = ['src', 'api'];
const INCLUDED_ROOT_FILES = ['package.json', 'vercel.json', 'vite.config.ts', 'tsconfig.json', 'index.html', 'server.ts', 'AGENTS.md'];
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md']);
const EXCLUDED_FILES = new Set(['package-lock.json', 'bun.lock', 'sentinel_reports.json']);

interface ContextFileEntry {
  path: string;
  category: string;
  lines: number;
  sizeBytes: number;
  content: string;
}

function categorizeFile(relPath: string): string {
  if (relPath.startsWith('src/components/')) return 'UI Component';
  if (relPath.startsWith('src/TreatmentPlanning3D/')) return '3D Dental Module';
  if (relPath.startsWith('src/context/')) return 'React Context / State';
  if (relPath.startsWith('src/lib/')) return 'Service / Integration';
  if (relPath.startsWith('src/hooks/')) return 'Custom Hook';
  if (relPath.startsWith('api/') || relPath === 'server.ts') return 'Backend / API';
  if (relPath.startsWith('src/')) return 'Frontend Core';
  return 'Configuration';
}

function sanitizeContent(content: string): string {
  return content
    .replace(/(AIza[0-9A-Za-z\-_]{35})/g, '[REDACTED_GOOGLE_API_KEY]')
    .replace(/(sk-[a-zA-Z0-9]{20,})/g, '[REDACTED_SECRET_KEY]')
    .replace(/(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/g, '[REDACTED_JWT_TOKEN]');
}

function walkDir(dirPath: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return fileList;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, fileList);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTENSIONS.has(ext) && !EXCLUDED_FILES.has(entry.name)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

function collectProjectFiles(): ContextFileEntry[] {
  const fullPaths: string[] = [];

  for (const rootFile of INCLUDED_ROOT_FILES) {
    const p = path.join(ROOT_DIR, rootFile);
    if (fs.existsSync(p)) fullPaths.push(p);
  }

  for (const dir of INCLUDED_DIRS) {
    walkDir(path.join(ROOT_DIR, dir), fullPaths);
  }

  const entries: ContextFileEntry[] = [];
  for (const fullPath of fullPaths) {
    const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const content = sanitizeContent(raw);
    const lines = content.split(/\r?\n/).length;
    const sizeBytes = Buffer.byteLength(content, 'utf-8');

    entries.push({
      path: relPath,
      category: categorizeFile(relPath),
      lines,
      sizeBytes,
      content,
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

function generateLlmsTxt(files: ContextFileEntry[], totalLines: number): string {
  const fileTree = files
    .map(
      (f) =>
        `- \`${f.path}\` (${f.category}, ${f.lines} linhas) → Ler código: https://sistema-aistudio.vercel.app/api/ai-context?file=${encodeURIComponent(f.path)}&raw=true`
    )
    .join('\n');

  return `# Sistema Odontológico Dr. Agnaldo Ferreira — Guia de Acesso e Auditoria para IA (llms.txt)

> Este documento segue o padrão \`llms.txt\` e fornece a qualquer Inteligência Artificial (ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Cursor, Agentes Playwright) acesso completo à arquitetura, fluxos, esquema de dados e código-fonte de https://sistema-aistudio.vercel.app/.

## 🔗 Links Diretos para Inspeção de IA
- **Resumo Arquitetural + Índice de Arquivos (este arquivo, ~18 KB)**: https://sistema-aistudio.vercel.app/llms.txt
- **Ler Qualquer Arquivo Individualmente (Ideal para IAs com limite de contexto por requisição)**: \`https://sistema-aistudio.vercel.app/api/ai-context?file=src/App.tsx&raw=true\`
- **Código-Fonte Completo de Todos os Arquivos em Único Link (~2.2 MB)**: https://sistema-aistudio.vercel.app/llms-full.txt
- **Manifesto JSON Estruturado (Árvore + Código + Rotas)**: https://sistema-aistudio.vercel.app/ai-context.json
- **Central Visual de Inspeção & Telemetria (Sem Login)**: https://sistema-aistudio.vercel.app/ai-inspector
- **Acesso Visual Completo ao Sistema em Modo Sandbox (Dados Fictícios)**: https://sistema-aistudio.vercel.app/?ai=true

---

## 🏗️ 1. Visão Geral da Arquitetura & Stack
- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Lucide Icons + Motion.
- **Odontograma 3D & 2D**: Three.js (\`@react-three/fiber\`, \`@react-three/drei\`) com modelos GLB anatômicos por dente + mapeamento fotográfico 2D (\`PhotoEditor.tsx\`).
- **Estado Global e Sincronização**: \`src/context/PatientContext.tsx\` centraliza o paciente ativo, agendamentos, histórico clínico, pagamentos, orçamentos e seções do odontograma, sincronizando em tempo real com a 2ª tela de apresentação (\`?mode=patient\`) via \`BroadcastChannel\`.
- **Banco de Dados & Persistência**:
  - **Produção Autenticada**: Supabase (\`clinic_data.crm_data\` JSONB por \`user_id\`) + espelho preventivo em \`localStorage['ag_crm_local_backup']\` (\`src/lib/supabaseCrm.ts\`).
  - **Armazenamento de Mídia**: Cloudflare R2 (S3-compatible) via URLs pré-assinadas (\`src/lib/r2.ts\`, \`api/storage-*.ts\`).
  - **Modo Sandbox IA (\`?ai=true\` ou \`/ai-inspector\`)**: 100% isolado em \`sessionStorage['ai_sandbox_crm_data']\` (\`src/lib/aiSandbox.ts\`), pré-populado com pacientes, consultas, histórico clínico, orçamentos e financeiro fictícios para proteger os dados reais (LGPD).
- **Integrações Externas**:
  - **Google Calendar OAuth 2.0**: Sincronização bidirecional de consultas (\`src/lib/calendar.ts\`, \`api/auth/google/refresh.ts\`).
  - **Inteligência Artificial Clínica**: Google Gemini 2.5 Flash / DeepSeek / NVIDIA NIM para sugestão de receituários (\`/api/suggest-prescription\`), scripts de vendas de orçamento (\`/api/ai/budget-script\`), leitura de orçamentos por visão computacional (\`/api/extract-budget-vision\`), planejamento clínico FDI (\`/api/ai/suggest-plan\`) e Copiloto Hermes (\`/api/agent/chat\`).

---

## 🧭 2. Mapa de Rotas e Módulos (SPA)
Para navegar sem login usando um agente de navegador (Playwright / Operator), adicione \`?ai=true\` na URL:
1. \`https://sistema-aistudio.vercel.app/dashboard?ai=true\` — **Painel Geral**: Consultas do dia, confirmação de WhatsApp, faturamento diário, controle de retornos (Recall) e gaveta lateral de atendimento clínico (\`DashboardView.tsx\`).
2. \`https://sistema-aistudio.vercel.app/crm/registration?ai=true\` — **Gestão de Pacientes (CRM)**: Busca, cadastro completo, prontuário clínico, anamnese, receitas/atestados, galeria de fotos e histórico (\`DentalCRMView.tsx\`).
3. \`https://sistema-aistudio.vercel.app/crm/editor?ai=true\` — **Mapeamento & Odontograma**: Marcação de procedimentos em fotos clínicas (Arcada Superior, Inferior, Sorriso, Panorâmica) e visualização 3D (\`PhotoEditor.tsx\`, \`TreatmentPlanning3D/\`).
4. \`https://sistema-aistudio.vercel.app/crm/negotiation?ai=true\` — **Negociação & Orçamentos**: Simulação de parcelamento, descontos PIX, versionamento de propostas, contrato odontológico, PDF e script de WhatsApp com IA (\`NegotiationTab.tsx\`).
5. \`https://sistema-aistudio.vercel.app/financeiro?ai=true\` — **Painel Financeiro**: Receitas pagas, orçamentos em aberto, deduplicação de lançamentos e filtros por meio de pagamento (\`FinancialView.tsx\`).
6. \`https://sistema-aistudio.vercel.app/calendar?ai=true\` — **Agenda**: Grade mensal, semanal e diária integrada ao Google Calendar (\`CalendarView.tsx\`).
7. \`https://sistema-aistudio.vercel.app/settings?ai=true\` — **Ajustes**: Dados do profissional (CRO, endereço), temas visuais e tabela de procedimentos (\`SettingsView.tsx\`).
8. \`https://sistema-aistudio.vercel.app/ai-inspector\` — **Central de Inspeção para IA**: Explorador de código-fonte, logs de erro em tempo real e auditoria técnica (\`AIInspectorView.tsx\`).

---

## 📂 3. Árvore de Arquivos do Projeto (${files.length} arquivos | ${totalLines.toLocaleString('pt-BR')} linhas)
${fileTree}

---

## 🔍 4. Instruções para IAs Sugerirem Melhorias e Encontrarem Bugs
1. **Para analisar todo o código-fonte de uma vez**: Solicite ou faça fetch de \`https://sistema-aistudio.vercel.app/llms-full.txt\` ou \`https://sistema-aistudio.vercel.app/ai-context.json\`.
2. **Para inspecionar em navegador (Playwright / DevTools)**: Acesse \`https://sistema-aistudio.vercel.app/?ai=true\` ou execute no console \`window.__AI_INSPECTOR__.getLogs()\` e \`window.__AI_INSPECTOR__.getStaticAuditFindings()\`.
3. **Ao sugerir correções**: Sempre cite o caminho exato do arquivo (ex: \`src/components/DashboardView.tsx\`), a função/estado afetado e forneça o diff ou bloco de código TypeScript tipado.
`;
}

function generateLlmsFullTxt(files: ContextFileEntry[], totalLines: number): string {
  const header = generateLlmsTxt(files, totalLines);
  const codeBlocks = files
    .map(
      (f) =>
        `\n================================================================================\nFILE: ${f.path}\nCATEGORY: ${f.category} | LINES: ${f.lines} | SIZE: ${f.sizeBytes} bytes\n================================================================================\n${f.content}\n`
    )
    .join('\n');

  return `${header}\n\n# 📦 CÓDIGO-FONTE COMPLETO DO PROJETO\n${codeBlocks}`;
}

function main() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const files = collectProjectFiles();
  const totalLines = files.reduce((acc, f) => acc + f.lines, 0);

  const manifest = {
    generatedAt: new Date().toISOString(),
    projectUrl: 'https://sistema-aistudio.vercel.app',
    totalFiles: files.length,
    totalLines,
    techStack: [
      'React 19',
      'TypeScript 5.8',
      'Vite 6',
      'Tailwind CSS v4',
      'Supabase (Auth + JSONB Database)',
      'Cloudflare R2 (S3 Presigned Storage)',
      'Three.js / @react-three/fiber (3D Odontogram)',
      'FullCalendar 6 + Google Calendar API',
      'Google Gemini 2.5 Flash (@google/genai)',
      'Vercel Serverless Functions + Express',
    ],
    routes: [
      { path: '/dashboard?ai=true', view: 'dashboard', description: 'Painel Geral, agenda do dia, confirmações e métricas' },
      { path: '/crm/registration?ai=true', view: 'crm', description: 'Gestão de Pacientes, prontuário, anamnese, documentos e histórico' },
      { path: '/crm/editor?ai=true', view: 'crm', description: 'Mapeamento fotográfico 2D e Odontograma 3D' },
      { path: '/crm/negotiation?ai=true', view: 'crm', description: 'Simulador de orçamento, parcelamento, PDF e script WhatsApp' },
      { path: '/financeiro?ai=true', view: 'financeiro', description: 'Painel Financeiro com receitas pagas e pendentes' },
      { path: '/calendar?ai=true', view: 'calendar', description: 'Agenda completa sincronizada com Google Calendar' },
      { path: '/settings?ai=true', view: 'settings', description: 'Configurações da clínica, temas e tabela de procedimentos' },
      { path: '/ai-inspector', view: 'ai-inspector', description: 'Central de Inspeção de Código, Arquitetura e Logs para IA' },
    ],
    apiEndpoints: [
      { method: 'GET', path: '/api/ai-context', description: 'Manifesto JSON completo com estrutura e código-fonte para IAs' },
      { method: 'POST', path: '/api/suggest-prescription', description: 'Gera receituário odontológico com posologia via Gemini 2.5 Flash' },
      { method: 'POST', path: '/api/ai/budget-script', description: 'Gera script persuasivo de orçamento para WhatsApp' },
      { method: 'POST', path: '/api/ai/suggest-plan', description: 'Converte relato clínico em plano de tratamento FDI estruturado' },
      { method: 'POST', path: '/api/extract-budget-vision', description: 'Extrai itens de orçamento a partir de imagem/PDF via Gemini Vision' },
      { method: 'POST', path: '/api/agent/chat', description: 'Chat com o Copiloto IA Hermes integrado às métricas do CRM' },
      { method: 'POST', path: '/api/auth/google/refresh', description: 'Renova access_token do Google Calendar via OAuth refresh_token' },
      { method: 'ALL', path: '/api/crm', description: 'Endpoints de integração Typebot/n8n protegidos por x-api-key' },
    ],
    files,
  };

  const llmsTxt = generateLlmsTxt(files, totalLines);
  const llmsFullTxt = generateLlmsFullTxt(files, totalLines);

  fs.writeFileSync(path.join(PUBLIC_DIR, 'llms.txt'), llmsTxt, 'utf-8');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'llms-full.txt'), llmsFullTxt, 'utf-8');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'ai-context.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(
    `[AI Context Generator] Gerados com sucesso em public/: llms.txt, llms-full.txt e ai-context.json (${files.length} arquivos, ${totalLines} linhas).`
  );
}

main();
