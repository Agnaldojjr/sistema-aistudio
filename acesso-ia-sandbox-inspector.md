# Plano de Implementação: Acesso Universal para IAs, Sandbox Mock e AI Inspector (`acesso-ia-sandbox-inspector.md`)

## 1. Visão Geral (Overview)
Criar uma infraestrutura completa no site **https://sistema-aistudio.vercel.app/** para que **qualquer Inteligência Artificial** — tanto IAs leitoras de links/texto (ChatGPT, Claude, Gemini, Perplexity, DeepSeek) quanto agentes baseados em navegador (Playwright, Operator, Computer Use) — consiga acessar:
1. **Arquitetura e Regras de Negócio (`/llms.txt`)**: Documento estruturado no padrão `llms.txt` detalhando stack, rotas, fluxos clínicos, esquema de dados e pontos de atenção.
2. **Código-Fonte Completo e Estrutura (`/llms-full.txt` e `/ai-context.json` + `/api/ai-context`)**: Gerados automaticamente no momento do `npm run build` (`scripts/generate_ai_context.ts`), contendo a árvore de arquivos completa e o código-fonte sanitizado (sem chaves ou segredos) de todos os componentes, contextos, serviços e rotas de API.
3. **Modo Sandbox com Dados Fictícios (`?ai=true`, `?sandbox=true` ou botão na tela de Login)**: Acesso imediato a todas as telas do sistema (`Painel`, `Financeiro`, `Pacientes/CRM`, `Odontograma`, `Orçamentos`, `Agenda`, `Ajustes`) com dados clínicos e financeiros 100% fictícios (Mock) isolados em `sessionStorage`, **sem jamais expor ou alterar dados reais do Supabase** e respeitando a regra de segurança (`NUNCA habilitar bypass_auth fora de NODE_ENV=development`).
4. **Central de Inspeção e Diagnóstico para IA (`/ai-inspector` e barra flutuante no Sandbox)**: Página e painel interativo que exibe árvore de arquivos, visualizador de código-fonte com busca, capturador em tempo real de erros de console/runtime/rede (`window.onerror`, `unhandledrejection`, `console.error`), auditoria estática/dinâmica e gerador de prompt pronto para copiar e colar em qualquer IA.

---

## 2. Tipo de Projeto (Project Type)
- **WEB + BACKEND (Full-Stack React 19 + TypeScript + Vite + Express / Vercel Serverless)**

---

## 3. Critérios de Sucesso (Success Criteria)
- [x] `https://sistema-aistudio.vercel.app/llms.txt` retorna em texto puro a arquitetura completa e links para inspeção.
- [x] `https://sistema-aistudio.vercel.app/llms-full.txt` e `/ai-context.json` (e `/api/ai-context`) retornam toda a árvore de arquivos e código-fonte atualizado a cada build.
- [x] `https://sistema-aistudio.vercel.app/ai-inspector` e `https://sistema-aistudio.vercel.app/?ai=true` entram direto sem exigir login Google, operando em **Modo Sandbox Mock** (pacientes, agendamentos, orçamentos, odontograma e financeiro fictícios).
- [x] Nenhuma chamada de escrita ou leitura real ao banco de pacientes do Supabase ocorre no Modo Sandbox.
- [x] Captura de erros runtime/console/fetch ativa e visível em `/ai-inspector` para diagnóstico imediato de bugs.
- [x] Build (`npm run build`) e checagem de tipos (`npm run lint`) passam sem erros.

---

## 4. Tech Stack & Arquitetura
- **Gerador de Contexto (Build-time)**: Script TypeScript (`scripts/generate_ai_context.ts`) executado automaticamente no `prebuild` (`package.json`), gerando `public/llms.txt`, `public/llms-full.txt` e `public/ai-context.json`.
- **Isolamento de Dados (Sandbox)**: Módulo `src/lib/aiSandbox.ts` que gerencia o estado de Sandbox (`?ai=true`, `?sandbox=true` ou rota `/ai-inspector`), fornece dados fictícios ricos (pacientes, consultas, histórico clínico, transações financeiras, eventos de calendário) e intercepta `getSupabaseCRMDatabase`, `saveSupabaseCRMDatabase` e `listCalendarEvents`.
- **Monitor de Erros Runtime + UI Inspector**: Componente `src/components/AIInspectorView.tsx` acessível como aba/rota `/ai-inspector` e via botão rápido na barra superior quando em modo Sandbox ou na tela de Login.

---

## 5. Estrutura de Arquivos (File Structure)
- `scripts/generate_ai_context.ts` (Novo — gerador automático de `llms.txt`, `llms-full.txt` e `ai-context.json`)
- `src/lib/aiSandbox.ts` (Novo — dados fictícios completos, detector de modo Sandbox e coletor de telemetria/erros de runtime)
- `src/components/AIInspectorView.tsx` (Novo — interface completa de inspeção de código, arquitetura, logs de erro e prompts de auditoria para IA)
- `api/ai-context.ts` (Novo — endpoint Serverless na Vercel com CORS aberto para leitura programática por agentes de IA)
- `src/firebase.ts` (Atualização — suporte seguro ao usuário Sandbox quando `?ai=true` ou `/ai-inspector`, separado de `bypass_auth`)
- `src/lib/supabaseCrm.ts` (Atualização — desvio automático para dados fictícios em `sessionStorage` quando em Modo Sandbox)
- `src/lib/calendar.ts` (Atualização — retorno de eventos fictícios de agenda quando em Modo Sandbox)
- `src/App.tsx` (Atualização — rota `/ai-inspector`, banner/indicador de Modo Sandbox e botão de acesso para IA na tela de Login)
- `index.html` & `vercel.json` (Atualização — metadados `llms.txt`, bloco `<noscript>` semântico para crawlers sem JS e regras de rewrite preservando arquivos de contexto IA)

---

## 6. Quebra de Tarefas (Task Breakdown)

| ID | Tarefa | Agente | Skills | Prioridade | INPUT → OUTPUT → VERIFY |
|----|--------|--------|--------|------------|-------------------------|
| T1 | Criar `src/lib/aiSandbox.ts` com dados Mock realistas e coletor de erros runtime/console/rede | `backend-specialist` | `clean-code` | P0 | Tipos do CRM → Mock completo + interceptador de erros → `tsc --noEmit` |
| T2 | Integrar Modo Sandbox em `src/firebase.ts`, `src/lib/supabaseCrm.ts` e `src/lib/calendar.ts` | `security-auditor` | `clean-code` | P0 | Funções de auth/DB/agenda → Isolamento total do Supabase em modo IA → Testar leitura/escrita mock |
| T3 | Criar `src/components/AIInspectorView.tsx` e integrar rota `/ai-inspector` + acesso na tela de Login em `src/App.tsx` | `frontend-specialist` | `frontend-design` | P1 | Contexto do projeto → Painel de inspeção de código, arquitetura, estado e bugs → Verificar renderização |
| T4 | Criar `scripts/generate_ai_context.ts`, `api/ai-context.ts` e atualizar `package.json`, `vercel.json` e `index.html` | `devops-engineer` | `deployment-procedures` | P1 | Código-fonte em `src/`, `api/`, `server.ts` → `public/llms.txt`, `public/llms-full.txt`, `public/ai-context.json` → `npm run build` |
| T5 | Executar verificações finais (`npm run lint`, `npm run build`, testes e push para GitHub/Vercel) | `test-engineer` | `verify-changes` | P2 | Projeto compilado → Validação completa e deploy → `git push` |

---

## 7. Phase X: Checklist de Verificação
- [x] `npm run lint` (`tsc --noEmit`) sem erros
- [x] `npm run build` gera `public/llms.txt`, `public/llms-full.txt`, `public/ai-context.json` e compila `dist/`
- [x] Segurança verificada: nenhum segredo do `.env` incluído no bundle ou nos arquivos de contexto IA
- [x] `bypass_auth` mantido restrito a desenvolvimento; Modo Sandbox IA usa exclusivamente dados fictícios isolados

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass (`tsc --noEmit`)
- Security: ✅ No critical issues (Sandbox 100% isolated in `sessionStorage`, secrets sanitized)
- Build: ✅ Success (98 files, 46,401 lines indexed in `public/llms.txt`, `public/llms-full.txt`, `public/ai-context.json`)
- Date: 2026-10-21
