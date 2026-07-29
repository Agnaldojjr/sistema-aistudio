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

## 2026-07-29T12:58:21Z

Refactor the CRM's budget and cloud drive modules to support multiple independent and versioned budgets, significantly improve the UX and performance of the planning/budget tabs, fix a photo upload bug, and transform the cloud drive into a versatile photo and document gallery.

Working directory: c:\Users\Agnaldo\OneDrive\Área de Trabalho\sistema-aistudio-main
Integrity mode: development

## Requirements

### R1. Non-Overwriting & Versioned Budgets
The system must allow the existence of multiple individual budgets per patient without overwriting each other. It must support both creating completely independent budgets (e.g., different procedures at different times) AND versioning of the same budget (e.g., Orçamento V1, V2).

### R2. Planning and Budget Integration (UX & Bugs)
Redesign the integration between the "Planejamento" (Planning) and "Orçamentos" (Budgets) tabs for a fluid UX. Specifically:
- Fix performance issues (UI freezing or lagging when switching tabs).
- Ensure data correctly copies from planning to the new budget.
- Make navigation intuitive and seamless.

### R3. Cloud Drive File Segregation
Budgets saved in the Cloud Drive must be exclusively routed to and displayed within a dedicated "Orçamentos" folder.

### R4. Cloud Drive as Photo Gallery
The main view of the Cloud Drive must display patient photos in a visual grid format. It must also allow the visualization of other file types (like documents or PDFs) using representative icons alongside the photos.

### R5. Fix Patient Screen Photo Upload Bug
Fix a specific bug in the patient screen ("tela do paciente") where uploading 3 photos results in only 2 photos being displayed to the patient.

### R6. STRICT CRM DATA PRESERVATION (Ponytail Mode: Full)
CRITICAL REGULATION: It is strictly forbidden to delete, overwrite, or alter patient registration data and records present in the CRM database. All modifications must only add new budget records or read existing data safely.
Apply "ponytail" principles (laziest solution that actually works, simplest, shortest, most minimal). Do not over-engineer the UI redesign or data structures.

## Acceptance Criteria

### Budgets
- [ ] Users can create two independent budgets for a patient, and they appear as distinct records.
- [ ] Users can create a new version of an existing budget, preserving the previous version.
- [ ] Creating or editing a budget does not overwrite unrelated budgets.

### UI Integration & Bug Fixes
- [ ] Switching between Planning and Budgets tabs has zero noticeable lag or freezing.
- [ ] Planning data automatically and correctly populates the budget fields upon creation.
- [ ] Uploading N photos on the patient screen results in exactly N photos being displayed to the patient.

### Cloud Drive
- [ ] Saving a budget PDF places it inside the "Orçamentos" folder automatically.
- [ ] The root of the Cloud Drive displays image files in a grid and PDF/Doc files with distinct icons.

### Data Safety
- [ ] Running operations (creating budgets, uploading files) leaves the core patient registration data completely untouched and unmodified.

