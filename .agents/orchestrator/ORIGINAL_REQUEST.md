# Original User Request

## 2026-07-22T15:09:00-03:00

Equipe especialista em depuração sistemática (`/systematic-debugging`) para mapear, isolar e resolver a desincronização entre a Agenda do Dia (`DashboardView.tsx`), o CRM (`DentalCRMView.tsx`) e a Agenda (`CalendarView.tsx`), além da vinculação de lançamentos financeiros entre orçamentos e agendamentos, aplicando estritamente as regras de minimalismo `/ponytail` (nível Full), finalizando com build/testes e envio para o GitHub.

Working directory: `c:\Users\Agnaldo\OneDrive\Área de Trabalho\sistema-aistudio-main`
Integrity mode: development

## Requirements

### R1. Sincronização Tridirecional em Tempo Real
Garantir que atualizações de status de consulta, reagendamentos, adições ou deleções na Agenda do Dia (`DashboardView.tsx`), na Agenda Principal (`CalendarView.tsx`) e no CRM (`DentalCRMView.tsx`) reflitam instantaneamente em todos os módulos sem necessidade de recarregar a página (F5).

### R2. Unificação de Lançamentos Financeiros (Orçamento vs Procedimentos da Agenda)
Vincular os procedimentos agendados aos procedimentos do orçamento correspondente para evitar a duplicação de lançamentos financeiros (ex: evitar que R$ 200 lançados na agenda e R$ 200 do procedimento de profilaxia no orçamento fiquem como 2 lançamentos separados quando a entrada financeira for única).

### R3. Reconciliação dos Indicadores e Contagem de Cards
Corrigir a contagem dos cards de resumo do dia (Total de consultas, Confirmadas, Faltas, Pendentes) na Agenda do Dia para que permaneçam sempre em sincronia com o estado real do CRM e da Agenda após qualquer remoção ou alteração.

### R4. Solução Enxuta (Princípios Ponytail - Nível Full) e Deploy no Git
Resolver as causas raízes na camada de estado unificado / contexto sem criar abstrações complexas, sem adicionar dependências externas desnecessárias, testar/validar o projeto (`npm run build`) e enviar as alterações para o repositório remoto do GitHub.

## Acceptance Criteria

### Sincronização de Estado
- [ ] Alterar o status de uma consulta na Agenda do Dia atualiza imediatamente os módulos de Agenda e CRM.
- [ ] Criar ou alterar consulta/orçamento no CRM faz surgir ou atualizar a entrada na Agenda e na Agenda do Dia sem dar F5.
- [ ] Remoção ou alteração de horário recalcula e atualiza instantaneamente a contagem de cards na Agenda do Dia.

### Lançamentos Financeiros e Procedimentos
- [ ] Procedimentos agendados vinculados a um orçamento existente não duplicam o valor a receber nos lançamentos do módulo financeiro.

### Qualidade e Deploy
- [ ] Causa raiz corrigida no ponto central do fluxo de dados.
- [ ] Projeto testado e validado (`npm run build`).
- [ ] Alterações commitadas e enviadas para o repositório GitHub.
