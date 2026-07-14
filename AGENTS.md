## Contexto do Projeto
Sistema odontológico (CRM, Orçamentos, Agenda) — React + TS + Supabase.

## Regras
- NUNCA habilitar `bypass_auth` fora de `NODE_ENV=development`.
- NUNCA commitar chaves de API (Gemini, Supabase, GitHub token). Usar variáveis de ambiente (.env, não versionado).

## Limites de arquivo por agente (evitar conflitos em execução paralela)
- Agente "auth-mock": só edita `src/firebase.ts` e `.env.example`.
- Agente "ui-central": só edita `src/App.tsx`, `src/components/SentinelDashboard.tsx`.
- Agente "backend-chat": só edita `server.ts` e arquivos em `src/api/`.
- Agente "e2e-tests": só edita/cria arquivos em `tests/`.
- Agente "vps-loop": só edita/cria arquivos em `scripts/`.
