import React, { useEffect, useState, useMemo } from 'react';
import {
  Terminal,
  FileCode,
  Bug,
  Layers,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldCheck,
  AlertTriangle,
  Database,
  Play,
  Sparkles,
  Download,
  Trash2,
  FolderTree,
  ArrowRight,
  Activity,
} from 'lucide-react';
import {
  getAiRuntimeLogs,
  clearAiRuntimeLogs,
  subscribeAiRuntimeLogs,
  getStaticAuditFindings,
  resetAiSandboxData,
  getAiSandboxCRMDatabase,
  isAiSandboxMode,
  enableAiSandboxMode,
  type AIRuntimeLogEntry,
} from '../lib/aiSandbox';

interface AIContextFile {
  path: string;
  category: string;
  lines: number;
  sizeBytes: number;
  content: string;
}

interface AIContextManifest {
  generatedAt: string;
  projectUrl: string;
  totalFiles: number;
  totalLines: number;
  techStack: string[];
  routes: { path: string; view: string; description: string }[];
  apiEndpoints: { method: string; path: string; description: string }[];
  files: AIContextFile[];
}

interface AIInspectorViewProps {
  onNavigateView?: (view: 'dashboard' | 'calendar' | 'crm' | 'settings' | 'financeiro' | 'ai-inspector', crmTab?: 'registration' | 'editor' | 'negotiation' | 'documents') => void;
}

export default function AIInspectorView({ onNavigateView }: AIInspectorViewProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'source' | 'diagnostics' | 'prompt'>('overview');
  const [manifest, setManifest] = useState<AIContextManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(true);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('src/App.tsx');
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState<AIRuntimeLogEntry[]>(() => getAiRuntimeLogs());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAiSandboxMode()) {
      enableAiSandboxMode();
    }
    const unsub = subscribeAiRuntimeLogs(() => {
      setLogs(getAiRuntimeLogs());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoadingManifest(true);
    fetch('/ai-context.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: AIContextManifest) => {
        if (!mounted) return;
        setManifest(data);
        if (data.files && data.files.length > 0 && !data.files.some((f) => f.path === selectedFilePath)) {
          setSelectedFilePath(data.files[0].path);
        }
      })
      .catch(() => {
        // Fallback to /api/ai-context if static file not yet built
        fetch('/api/ai-context')
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (mounted && data) setManifest(data);
          })
          .catch(() => {});
      })
      .finally(() => {
        if (mounted) setLoadingManifest(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredFiles = useMemo(() => {
    if (!manifest?.files) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return manifest.files;
    return manifest.files.filter(
      (f) => f.path.toLowerCase().includes(q) || f.content.toLowerCase().includes(q)
    );
  }, [manifest, searchQuery]);

  const selectedFile = useMemo(() => {
    if (!manifest?.files) return null;
    return manifest.files.find((f) => f.path === selectedFilePath) || filteredFiles[0] || null;
  }, [manifest, selectedFilePath, filteredFiles]);

  const staticFindings = useMemo(() => getStaticAuditFindings(), []);
  const sandboxCrm = useMemo(() => getAiSandboxCRMDatabase(), [logs]);

  const storageDiagnostics = useMemo(() => {
    if (typeof window === 'undefined') return { localKeys: 0, localBytes: 0, sessionKeys: 0 };
    let localBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      const v = localStorage.getItem(k) || '';
      localBytes += k.length + v.length;
    }
    return {
      localKeys: localStorage.length,
      localBytes,
      sessionKeys: sessionStorage.length,
    };
  }, [logs]);

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sistema-aistudio.vercel.app';

  const masterAiPrompt = `Você é um Arquiteto de Software Sênior e Especialista em Auditoria de Bugs React + TypeScript + Supabase.
Preciso que você acesse e analise toda a estrutura, código-fonte e fluxos do meu sistema odontológico hospedado em:
${baseUrl}

🔗 LINKS DIRETOS DE ACESSO PARA IA (Sem bloqueio de login):
1. Resumo Arquitetural, Rotas, Banco de Dados e Índice Completo de Arquivos (Leve, ~18 KB):
   ${baseUrl}/llms.txt
2. Leitura de Qualquer Arquivo Individual em Texto Puro (Ideal para ChatGPT/Claude lerem arquivos específicos sem truncar):
   ${baseUrl}/api/ai-context?file=src/App.tsx&raw=true
   (Basta trocar "src/App.tsx" por qualquer caminho listado em /llms.txt)
3. Código-Fonte Completo de Todos os 98 Arquivos de Uma Vez:
   ${baseUrl}/llms-full.txt
4. Manifesto Estruturado em JSON (Árvore de arquivos + código + endpoints):
   ${baseUrl}/ai-context.json
5. Acesso Visual / Navegador em Modo Sandbox (Com dados clínicos fictícios pré-carregados, sem precisar de login):
   ${baseUrl}/?ai=true
6. Painel Técnico de Inspeção e Telemetria:
   ${baseUrl}/ai-inspector

📋 DIAGNÓSTICO ATUAL DA SESSÃO:
- Total de arquivos mapeados: ${manifest?.totalFiles || 45} arquivos (${manifest?.totalLines || 18000}+ linhas de código)
- Erros/Alertas de Runtime capturados na sessão: ${logs.length}
${logs.length > 0 ? logs.slice(0, 5).map((l) => `  • [${l.level.toUpperCase()}] (${l.source}): ${l.message}`).join('\n') : '  • Nenhum erro de runtime registrado até o momento.'}

🎯 SUA TAREFA:
1. Leia ${baseUrl}/llms.txt e ${baseUrl}/llms-full.txt (ou navegue em ${baseUrl}/?ai=true).
2. Identifique bugs ocultos, condições de corrida (race conditions), gargalos de performance e falhas de UX/responsividade.
3. Proponha melhorias concretas indicando o caminho exato do arquivo (ex: src/components/...) e o trecho de código corrigido.`;

  return (
    <div className="space-y-6" data-ai-inspector="root">
      {/* Top Banner — Machine & Human Readable */}
      <section
        className="rounded-2xl border border-[#C09553]/40 bg-gradient-to-r from-[#5C0000] via-[#8B0000] to-[#4A0000] text-white p-6 shadow-lg"
        data-ai-section="header"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-bold uppercase tracking-wider text-[#F3E5AB]">
              <Terminal className="w-3.5 h-3.5" />
              Modo de Inspeção Aberto para IA • Sandbox Seguro (LGPD)
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              Central de Acesso & Auditoria para Inteligência Artificial
            </h1>
            <p className="text-xs sm:text-sm text-white/85 max-w-3xl leading-relaxed">
              Qualquer IA (ChatGPT, Claude, Gemini, Perplexity, Cursor, Playwright) pode ler todo o código-fonte,
              arquitetura e testar todas as telas deste sistema usando os links públicos abaixo ou navegando pelo Modo Sandbox com dados fictícios.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="/llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-semibold text-white transition-all"
            >
              <FileCode className="w-4 h-4 text-[#F3E5AB]" />
              /llms.txt
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
            <a
              href="/llms-full.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-semibold text-white transition-all"
            >
              <Download className="w-4 h-4 text-[#F3E5AB]" />
              /llms-full.txt (Código Completo)
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
            <a
              href="/ai-context.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-semibold text-white transition-all"
            >
              <Database className="w-4 h-4 text-[#F3E5AB]" />
              /ai-context.json
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
            <button
              onClick={() => copyText('header-prompt', masterAiPrompt)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C09553] hover:bg-[#d1a764] text-[#2A0000] text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              {copiedId === 'header-prompt' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedId === 'header-prompt' ? 'Prompt Copiado!' : 'Copiar Prompt para IA'}
            </button>
          </div>
        </div>
      </section>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5" data-ai-section="metrics">
        <div className="bg-white rounded-xl border border-[#E6DEC9] p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Arquivos Mapeados</p>
          <p className="text-2xl font-bold text-[#8B0000] mt-1">{manifest ? manifest.totalFiles : '...'}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {manifest ? `${manifest.totalLines.toLocaleString('pt-BR')} linhas de código` : 'Carregando manifesto...'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#E6DEC9] p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Pacientes no Sandbox</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{sandboxCrm.patients?.length || 0}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {sandboxCrm.appointments?.length || 0} consultas fictícias ativas
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#E6DEC9] p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Erros / Alertas Runtime</p>
          <p className={`text-2xl font-bold mt-1 ${logs.some((l) => l.level === 'error') ? 'text-red-600' : 'text-zinc-800'}`}>
            {logs.length}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Monitorando console, promises e fetch
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#E6DEC9] p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Uso de Storage Local</p>
          <p className="text-2xl font-bold text-zinc-800 mt-1">
            {(storageDiagnostics.localBytes / 1024).toFixed(1)} KB
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {storageDiagnostics.localKeys} chaves local • {storageDiagnostics.sessionKeys} chaves sessão
          </p>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6DEC9] pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSection('overview')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'overview'
                ? 'bg-[#8B0000] text-white shadow-sm'
                : 'bg-white border border-[#E6DEC9] text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            1. Arquitetura, Telas & Fluxos
          </button>

          <button
            onClick={() => setActiveSection('source')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'source'
                ? 'bg-[#8B0000] text-white shadow-sm'
                : 'bg-white border border-[#E6DEC9] text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            2. Código-Fonte Completo ({manifest?.totalFiles || '...'})
          </button>

          <button
            onClick={() => setActiveSection('diagnostics')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'diagnostics'
                ? 'bg-[#8B0000] text-white shadow-sm'
                : 'bg-white border border-[#E6DEC9] text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <Bug className="w-4 h-4" />
            3. Auditoria de Bugs & Logs ({logs.length})
          </button>

          <button
            onClick={() => setActiveSection('prompt')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'prompt'
                ? 'bg-[#8B0000] text-white shadow-sm'
                : 'bg-white border border-[#E6DEC9] text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            4. Como Usar com Qualquer IA
          </button>
        </div>

        <button
          onClick={() => {
            resetAiSandboxData();
            window.location.reload();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-[11px] font-semibold text-zinc-600 cursor-pointer"
          title="Restaura os pacientes, agendamentos e orçamentos fictícios para o estado original"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Resetar Dados Sandbox
        </button>
      </div>

      {/* SECTION 1: OVERVIEW, ROUTES & ARCHITECTURE */}
      {activeSection === 'overview' && (
        <div className="space-y-6" data-ai-section="architecture-overview">
          {/* Interactive Screen Launcher for Browser AIs */}
          <div className="bg-white rounded-2xl border border-[#E6DEC9] p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#8B0000]" />
                  Navegação Rápida pelas Telas do Sistema (Modo Sandbox Ativo)
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Clique em qualquer módulo abaixo para inspecionar a interface real carregada com pacientes e orçamentos fictícios.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  title: 'Painel Geral (Dashboard)',
                  route: '/dashboard?ai=true',
                  view: 'dashboard' as const,
                  desc: 'Agenda do dia, confirmação via WhatsApp, faturamento diário, lembretes de retorno e gaveta de atendimento clínico.',
                  file: 'src/components/DashboardView.tsx',
                },
                {
                  title: 'Pacientes & Prontuário CRM',
                  route: '/crm/registration?ai=true',
                  view: 'crm' as const,
                  crmTab: 'registration' as const,
                  desc: 'Lista de pacientes, ficha cadastral, histórico clínico, odontograma 2D/3D, galeria de fotos, anamnese e receitas.',
                  file: 'src/components/DentalCRMView.tsx',
                },
                {
                  title: 'Mapeamento & Odontograma Visual',
                  route: '/crm/editor?ai=true',
                  view: 'crm' as const,
                  crmTab: 'editor' as const,
                  desc: 'Marcação interativa de procedimentos sobre fotos das arcadas (Superior, Inferior, Sorriso, Panorâmica) e modelo 3D.',
                  file: 'src/components/PhotoEditor.tsx',
                },
                {
                  title: 'Negociação & Orçamentos PDF',
                  route: '/crm/negotiation?ai=true',
                  view: 'crm' as const,
                  crmTab: 'negotiation' as const,
                  desc: 'Simulador financeiro (PIX, Cartão em até 12x), versão de orçamentos, script de vendas IA e apresentação em 2ª tela.',
                  file: 'src/components/NegotiationTab.tsx',
                },
                {
                  title: 'Painel Financeiro',
                  route: '/financeiro?ai=true',
                  view: 'financeiro' as const,
                  desc: 'Controle de receitas pagas e pendentes, deduplicação automática de lançamentos e filtro por método de pagamento.',
                  file: 'src/components/FinancialView.tsx',
                },
                {
                  title: 'Agenda FullCalendar',
                  route: '/calendar?ai=true',
                  view: 'calendar' as const,
                  desc: 'Visualização mensal/semanal/diária sincronizada com Google Calendar (emulada no modo Sandbox) e criação de eventos.',
                  file: 'src/components/CalendarView.tsx',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-4 rounded-xl border border-zinc-200 hover:border-[#8B0000] bg-[#FAF8F5]/50 hover:bg-white transition-all flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-zinc-800">{item.title}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                        {item.route}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <button
                      onClick={() => {
                        setSelectedFilePath(item.file);
                        setActiveSection('source');
                      }}
                      className="text-[11px] font-mono text-zinc-500 hover:text-[#8B0000] underline cursor-pointer"
                    >
                      {item.file}
                    </button>
                    <button
                      onClick={() => onNavigateView && onNavigateView(item.view, item.crmTab)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8B0000] text-white text-[11px] font-semibold hover:bg-[#6B0000] transition-colors cursor-pointer"
                    >
                      Abrir Tela
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture & API Reference */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-[#E6DEC9] p-5 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                <Database className="w-4 h-4 text-[#8B0000]" />
                Arquitetura de Estado & Banco de Dados
              </h3>
              <div className="text-xs text-zinc-600 space-y-2 leading-relaxed">
                <p>
                  <strong>1. Frontend (SPA):</strong> React 19 + TypeScript + Vite + Tailwind CSS v4 + Three.js (<code>@react-three/fiber</code>) + FullCalendar.
                </p>
                <p>
                  <strong>2. Estado Global (<code>PatientContext.tsx</code>):</strong> Gerencia o paciente selecionado, sub-listas clínicas (<code>appointments</code>, <code>clinicalHistory</code>, <code>pagamentosList</code>, <code>tratamentosList</code>, <code>odontogramaList</code>), seções de fotos (<code>activeSections</code>) e proposta ativa (<code>activeProposal</code>). Sincroniza em tempo real com a janela de apresentação do paciente via <code>BroadcastChannel</code>.
                </p>
                <p>
                  <strong>3. Persistência Híbrida (<code>supabaseCrm.ts</code>):</strong> No modo autenticado real, lê e grava na tabela <code>clinic_data</code> (coluna JSONB <code>crm_data</code> por <code>user_id</code>) no Supabase, mantendo espelho de segurança em <code>localStorage['ag_crm_local_backup']</code>. No <strong>Modo Sandbox IA</strong>, utiliza <code>sessionStorage['ai_sandbox_crm_data']</code>.
                </p>
                <p>
                  <strong>4. Armazenamento de Arquivos (<code>r2.ts</code> / <code>api/storage-*.ts</code>):</strong> Imagens clínicas e PDFs são salvos em bucket S3-compatible (Cloudflare R2) via URLs pré-assinadas.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6DEC9] p-5 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#8B0000]" />
                Endpoints de API Backend (Vercel Serverless & Express)
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(manifest?.apiEndpoints || [
                  { method: 'GET', path: '/api/ai-context', description: 'Manifesto JSON completo com estrutura e código-fonte para IAs' },
                  { method: 'POST', path: '/api/suggest-prescription', description: 'Gera receituário odontológico com posologia via Gemini 2.5 Flash' },
                  { method: 'POST', path: '/api/ai/budget-script', description: 'Gera script persuasivo de orçamento para WhatsApp' },
                  { method: 'POST', path: '/api/ai/suggest-plan', description: 'Converte anotações clínicas em plano de tratamento FDI estruturado' },
                  { method: 'POST', path: '/api/extract-budget-vision', description: 'Extrai itens de orçamento a partir de foto/PDF com Gemini Vision' },
                  { method: 'POST', path: '/api/agent/chat', description: 'Chat com o Copiloto IA Hermes integrado às métricas do CRM' },
                  { method: 'POST', path: '/api/auth/google/refresh', description: 'Renova access_token do Google Calendar via OAuth refresh_token' },
                  { method: 'ALL', path: '/api/crm', description: 'Integração externa (Typebot/n8n) protegida por x-api-key' },
                ]).map((ep) => (
                  <div key={ep.path} className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#8B0000]/10 text-[#8B0000] shrink-0">
                      {ep.method}
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-zinc-800">{ep.path}</p>
                      <p className="text-[11px] text-zinc-500">{ep.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: FULL SOURCE CODE EXPLORER */}
      {activeSection === 'source' && (
        <div className="bg-white rounded-2xl border border-[#E6DEC9] shadow-2xs overflow-hidden" data-ai-section="source-explorer">
          <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF8F5]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome do arquivo ou trecho de código (ex: saveContextToSupabase)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs focus:outline-none focus:border-[#8B0000]"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Exibindo {filteredFiles.length} de {manifest?.totalFiles || 0} arquivos</span>
              <a
                href="/llms-full.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#8B0000] text-white font-semibold text-[11px]"
              >
                Abrir Tudo em Texto Puro (/llms-full.txt)
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {loadingManifest ? (
            <div className="p-12 text-center text-sm text-zinc-500">
              Carregando manifesto de código-fonte (<code>/ai-context.json</code>)...
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
              {/* File List Sidebar */}
              <div className="lg:col-span-4 border-r border-zinc-200 max-h-[650px] overflow-y-auto divide-y divide-zinc-100">
                {filteredFiles.map((file) => {
                  const active = selectedFile?.path === file.path;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFilePath(file.path)}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                        active ? 'bg-[#8B0000]/10 border-l-4 border-[#8B0000]' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-xs font-mono truncate ${active ? 'font-bold text-[#8B0000]' : 'text-zinc-800'}`}>
                          {file.path}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {file.category} • {file.lines} linhas • {(file.sizeBytes / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Code Viewer */}
              <div className="lg:col-span-8 flex flex-col max-h-[650px]">
                {selectedFile ? (
                  <>
                    <div className="px-4 py-3 bg-zinc-900 text-zinc-100 flex items-center justify-between border-b border-zinc-800">
                      <div>
                        <p className="text-xs font-mono font-bold text-[#F3E5AB]">{selectedFile.path}</p>
                        <p className="text-[10px] text-zinc-400">
                          {selectedFile.lines} linhas • {(selectedFile.sizeBytes / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => copyText(`file-${selectedFile.path}`, selectedFile.content)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white cursor-pointer"
                      >
                        {copiedId === `file-${selectedFile.path}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copiar Arquivo
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-4 bg-zinc-950 text-zinc-100 text-[11px] font-mono leading-relaxed overflow-auto flex-1 select-all">
                      <code>{selectedFile.content}</code>
                    </pre>
                  </>
                ) : (
                  <div className="p-8 text-center text-xs text-zinc-400">
                    Selecione um arquivo à esquerda para inspecionar o código-fonte.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: BUG DIAGNOSTICS & TELEMETRY */}
      {activeSection === 'diagnostics' && (
        <div className="space-y-6" data-ai-section="diagnostics">
          {/* Runtime Error & Network Logs */}
          <div className="bg-white rounded-2xl border border-[#E6DEC9] p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-[#8B0000]" />
                  Logs de Runtime, Console & Rede Capturados na Sessão ({logs.length})
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Qualquer erro de JavaScript, Promise rejeitada ou falha de API é gravado automaticamente aqui e em <code>window.__AI_INSPECTOR__.getLogs()</code>.
                </p>
              </div>
              {logs.length > 0 && (
                <button
                  onClick={() => clearAiRuntimeLogs()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar Logs
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="p-6 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3 text-emerald-800">
                <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
                <div className="text-xs">
                  <p className="font-bold">Nenhum erro de runtime ou falha de rede detectado até agora!</p>
                  <p className="text-emerald-700 mt-0.5">
                    Navegue pelas abas do sistema (Painel, CRM, Odontograma, Financeiro, Agenda) para testar interações em tempo real.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3.5 rounded-xl border text-xs font-mono ${
                      log.level === 'error'
                        ? 'bg-red-50/70 border-red-200 text-red-900'
                        : log.level === 'network'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold uppercase text-[10px]">
                        [{log.level}] • {log.source} • Rota: {log.route}
                      </span>
                      <span className="text-[10px] opacity-70">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{log.message}</p>
                    {log.stack && (
                      <pre className="mt-2 p-2 rounded bg-black/5 text-[10px] overflow-x-auto">{log.stack}</pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automated Architectural & Code Audit Points */}
          <div className="bg-white rounded-2xl border border-[#E6DEC9] p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Mapa de Pontos de Atenção & Oportunidades de Melhoria para Auditoria de IA
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Pontos arquiteturais mapeados para guiar IAs externas na sugestão de refatorações e prevenção de bugs.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staticFindings.map((finding) => (
                <div key={finding.id} className="p-4 rounded-xl border border-zinc-200 bg-[#FAF8F5]/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#8B0000]/10 text-[#8B0000]">
                      {finding.id} • {finding.category}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">{finding.file}</span>
                  </div>
                  <h3 className="text-xs font-bold text-zinc-800">{finding.title}</h3>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">{finding.description}</p>
                  <div className="p-2.5 rounded-lg bg-white border border-[#E6DEC9] text-[11px] text-zinc-700">
                    <strong className="text-[#8B0000]">Sugestão Técnica:</strong> {finding.suggestion}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: PROMPT GENERATOR & INSTRUCTIONS */}
      {activeSection === 'prompt' && (
        <div className="bg-white rounded-2xl border border-[#E6DEC9] p-6 shadow-2xs space-y-4" data-ai-section="ai-prompt">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-800">
                Prompt Pronto para Colar em Qualquer IA (ChatGPT, Claude, Gemini, Perplexity, DeepSeek)
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Basta copiar o bloco abaixo e colar na sua IA favorita. Ela terá acesso imediato aos arquivos de código e ao Modo Sandbox.
              </p>
            </div>
            <button
              onClick={() => copyText('full-prompt-box', masterAiPrompt)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B0000] hover:bg-[#6B0000] text-white text-xs font-bold shadow-sm cursor-pointer shrink-0"
            >
              {copiedId === 'full-prompt-box' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedId === 'full-prompt-box' ? 'Copiado para a Área de Transferência!' : 'Copiar Prompt Completo'}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-zinc-900 text-zinc-100 text-xs font-mono whitespace-pre-wrap leading-relaxed border border-zinc-800 select-all">
            {masterAiPrompt}
          </pre>
        </div>
      )}
    </div>
  );
}
