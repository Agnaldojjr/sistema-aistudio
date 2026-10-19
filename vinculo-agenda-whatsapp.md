# Plano de Implementação: Vínculo Inteligente Agenda WhatsApp / Google Calendar → CRM

## Overview
Resolver a criação duplicada de pacientes no CRM originada por eventos exportados do WhatsApp para o Google Calendar (ex.: `Fulano 31999999999 - Avaliação e Limpeza`).
Conforme alinhado no Socratic Gate:
- **1B (Fila de Confirmação / Vínculo Rápido na Agenda):** Eventos do Google Calendar aparecem normalmente na Agenda do Dia, mas **nunca criam novos pacientes no CRM automaticamente**. O vínculo ou cadastro no CRM ocorre mediante confirmação/clique rápido no painel.
- **2 (Extração Completa de Nome + Telefone + Procedimento):** O sistema deve varrer **todos os campos** do evento do Google Calendar (`summary`, `description`, `location`, `attendees`, `extendedProperties`) para encontrar o telefone, separar o **Nome do Paciente** do **Procedimento** (ex.: antes e depois de `-`, `|`, `/`) e limpar o número de telefone de dentro do nome.
- **3B (Escopo Prospectivo):** Aplicar a nova inteligência daqui para frente sem alterar/excluir cadastros antigos automaticamente.

## Project Type
**WEB** (React + TypeScript + Supabase)

## Success Criteria
1. Eventos exportados do WhatsApp para o Google Calendar **não** disparam `crmData.patients.push(...)` automaticamente ao carregar a Agenda do Dia.
2. O parser de eventos extrai o telefone de qualquer campo do agendamento (`summary`, `description`, `location`, links `wa.me`, formatos com ou sem DDD/DDI) e separa `Nome` de `Procedimento` (ex.: `Fulano 31988887777 - Avaliação e Limpeza` → Nome: `FULANO`, Telefone: `31988887777`, Procedimento: `Avaliação e Limpeza`).
3. Se o paciente já existir no CRM (mesmo telefone normalizado + nome compatível, ou já vinculado pelo ID do evento), o agendamento aparece vinculado a ele automaticamente sem criar duplicata.
4. Se o evento não estiver vinculado a um paciente do CRM, ele aparece na Agenda do Dia com indicador visual claro (`Pendente de Vínculo CRM` / sugestões encontradas) e permite com 1 clique:
   - Vincular a um paciente já existente no CRM (mostrando sugestões automáticas por nome/telefone no topo do modal), **ou**
   - Criar o novo paciente no CRM já com o **Nome limpo** (sem `- Procedimento` e sem telefone misturado no nome) e **Telefone extraído**.

## Tech Stack
- React 18 + TypeScript
- Tailwind CSS
- Integração Google Calendar API v3 (`src/lib/calendar.ts`) + Supabase CRM (`src/components/DashboardView.tsx`)

## File Structure
- `src/components/DashboardView.tsx`:
  - Funções `extractPhoneFromCalendarEvent`, `normalizePhoneForMatch`, `parseEventSummaryNameAndService`.
  - Atualização de `fetchAgenda` para remover o auto-cadastro no CRM e identificar sugestões de vínculo.
  - Aprimoramento do Modal de Vínculo Rápido / Confirmação (`isChangePatientOpen`) com sugestões inteligentes (por telefone e nome) e botão de criação rápida com dados higienizados.

## Task Breakdown
| Task ID | Nome | Agent | Skills | Priority | Dependencies | INPUT → OUTPUT → VERIFY |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `T1` | Parser completo de Evento (Nome, Telefone em todos os campos e Procedimento) | `frontend-specialist` | `clean-code` | P0 | - | Evento bruto do Google Calendar → `{ cleanPatientName, extractedPhone, extractedService }` → Testar múltiplos formatos do WhatsApp |
| `T2` | Desativar auto-criação de pacientes no `fetchAgenda` e implementar match inteligente | `frontend-specialist` | `clean-code` | P0 | `T1` | Lista de eventos do Google Calendar → Agendamentos listados sem criar duplicatas em `crmData.patients` → Verificar estado do CRM |
| `T3` | Modal de Confirmação / Vínculo Rápido na Agenda (Vincular Existente ou Criar Novo Limpo) | `frontend-specialist` | `frontend-design`, `clean-code` | P1 | `T2` | Clique em "Vincular / Cadastrar" na Agenda → Modal com sugestões por Nome/Telefone + botão "Criar Novo Paciente" com campos editáveis limpos → `npx tsc --noEmit` & `npm run build` |

## Phase X: Verification
- [x] TypeScript Check (`npx tsc --noEmit`)
- [x] Build Check (`npm run build`)
- [x] Socratic Gate Respected

## ✅ PHASE X COMPLETE
- Lint & TypeScript: ✅ Pass (`npx tsc --noEmit`)
- Build: ✅ Success (`npm run build`)
- Date: 2026-10-19

