# Reformulação UX/UI de Orçamentos e Odontograma por Fases

## Overview
Reformular o fluxo de **Mapeamento Clínico e Emissão de Orçamento** (`DentalCRMView.tsx`, `NegotiationTab.tsx`, `types.ts`, `server.ts`) para substituir o mapeamento lento por fotos+bolinhas por um **Odontograma Anatômico 2D Interativo em Arco**, introduzir **Divisão Dinâmica por Etapas/Fases Clínicas** (sem necessidade de criar múltiplas versões de orçamento) com **Divisão Parcial de Valores/Procedimentos**, manter uma **Galeria de Anexos Opcional**, e integrar **Maquininha Ton + InfinitePay (InfiniteTap)** com sincronização inteligente de taxas via IA com cache determinístico anti-bugs.

## Project Type
**WEB** (React + TypeScript + Tailwind CSS + Express/Gemini Backend + Supabase)

## Success Criteria
1. **Odontograma 2D em Arco Rápido**: Selecionar dentes (18–28, 48–38, + "Boca Toda / Geral") com 1 clique e atribuir procedimentos + fase clínica em um Popover imediato (< 3 segundos por dente).
2. **Orçamento Único Multi-Etapas (Zero Versões Extras)**: Agrupar procedimentos em Fases (ex: *Fase 1: Urgência & Saúde*, *Fase 2: Reabilitação & Função*, *Fase 3: Estética*, ou fases customizadas) e permitir ligar/desligar fases ou procedimentos individuais com checkboxes em tempo real na frente do paciente.
3. **Flexibilidade Financeira por Etapa ou Procedimento**: Permitir alterar valores unitários, aplicar desconto pontual, ou simular pagamento apenas das etapas marcadas como "Ativas Agora", mantendo as demais visíveis como "Próximas Etapas Planejadas" no PDF e na tela.
4. **Taxas Ton & InfinitePay (InfiniteTap) via IA sem Bugs**: Seletor de operadora (`Ton` vs `InfinitePay / InfiniteTap`), busca de taxas atualizadas via Gemini com Google Search Grounding + validação estrita de schema (Zod) + fallback seguro em cache local para nunca travar ou gerar NaN.
5. **Anexos Fotográficos Desacoplados**: Galeria rápida no rodapé/lateral para anexar fotos clínicas ou radiografias ao orçamento sem obrigar a posicionar bolinhas.

## Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, jsPDF
- **Backend / IA**: Express (`server.ts`), `@google/genai` (Grounded Search + JSON Schema validation) para atualização segura das taxas Ton e InfiniteTap

## File Structure
```plaintext
src/
├── types.ts                                  # Novos tipos: TreatmentStage, PaymentProvider ('ton' | 'infinitepay'), RateTable, instância com stageId e activeInBudget
├── constants.ts                              # Fases padrão, taxas fallback validadas (Ton + InfinitePay/InfiniteTap)
├── components/
│   ├── ArchOdontogram2D.tsx                  # [NOVO] Desenho de Arcada 2D (Arco Anatômico Superior/Inferior + Popover de Dente/Fase)
│   ├── BudgetStageManager.tsx                # [NOVO] Painel de Etapas/Fases interativo (ligar/desligar fases e procedimentos, mover entre fases, subtotais)
│   ├── BudgetAttachmentsGallery.tsx          # [NOVO] Galeria enxuta de fotos/Raio-X anexados ao orçamento (sem bolinhas obrigatórias)
│   ├── NegotiationTab.tsx                    # [MODIFICADO] Integração com Fases Ativas, seletor Ton vs InfiniteTap, botão Atualizar Taxas via IA e PDF por Etapas
│   └── DentalCRMView.tsx                     # [MODIFICADO] Substituição do fluxo padrão de fotos pelo Odontograma 2D + Etapas na aba Planejamento
server.ts                                     # [MODIFICADO] Endpoint POST /api/ai/fetch-machine-rates com validação estrita e fallback anti-bug
```

## Task Breakdown

- [ ] **Task 1: Modelagem de Dados de Etapas e Operadoras (`src/types.ts` & `src/constants.ts`)**
  - **Agent**: `frontend-specialist` | **Skill**: `clean-code`
  - **INPUT**: `src/types.ts`, `src/constants.ts`
  - **OUTPUT**: Interfaces `TreatmentStage` (`id`, `name`, `color`, `order`, `isEnabled`), extensão de `procedureInstances` com `stageId`, `includedInCurrentSplit` (boolean), e tabelas fallback de taxas `TON_RATES` e `INFINITEPAY_RATES`.
  - **VERIFY**: `npx tsc --noEmit` passa sem erros e preserva retrocompatibilidade com orçamentos antigos salvos no Supabase.

- [ ] **Task 2: Endpoint Seguro de Taxas com IA Anti-Bugs (`server.ts`)**
  - **Agent**: `backend-specialist` | **Skill**: `api-patterns`
  - **INPUT**: `server.ts`
  - **OUTPUT**: Rota `POST /api/ai/payment-rates` que consulta taxas atualizadas da **Ton** e **InfinitePay (InfiniteTap)** via Gemini com Schema JSON estruturado, valida limites matemáticos (0% < taxa < 35%, array de 12 posições crescentes), e retorna `{ provider, rates, updatedAt, source }`. Em caso de falha de rede ou resposta atípica, retorna tabela fallback validada com edição manual liberada.
  - **VERIFY**: Chamada à rota retorna JSON tipado com arrays completos de 1x a 12x e débito para Ton e InfiniteTap sem valores `null` ou `NaN`.

- [ ] **Task 3: Componente de Desenho da Arcada 2D (`src/components/ArchOdontogram2D.tsx`)**
  - **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
  - **INPUT**: Especificação FDI (18–28, 48–38) e lista de `procedures` + `stages`.
  - **OUTPUT**: Odontograma vetorial SVG anatômico (Visão em Arco Superior/Inferior + atalho "Arcada Completa / Geral"), destaque cromático por Fase Clínica ou status, seleção múltipla de dentes (ex: selecionar 13 a 23 de uma vez para facetas/clareamento) e Popover instantâneo para adicionar procedimentos já escolhendo a Etapa (Urgência, Função, Estética).
  - **VERIFY**: Clicar em um ou mais dentes adiciona procedimentos com 2 cliques e reflete imediatamente no resumo lateral.

- [ ] **Task 4: Painel Interativo de Divisão por Etapas e Autonomia de Valores (`src/components/BudgetStageManager.tsx`)**
  - **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
  - **INPUT**: Procedimentos mapeados e lista de fases do orçamento.
  - **OUTPUT**: Painel estilo "Mesa de Negociação Ao Vivo" onde o dentista, sentado com o paciente, pode:
    1. Ligar/desligar uma **Etapa inteira** (ex: manter *Etapa 1: Urgência* e *Etapa 2: Reabilitação* ativas e desmarcar *Etapa 3: Estética* para fazer depois) com recálculo instantâneo do total.
    2. Ligar/desligar ou alterar a etapa/preço de **qualquer dente/procedimento individualmente** sem apagar do planejamento e sem criar nova versão de orçamento.
    3. Criar novas etapas personalizadas (ex: "Etapa 1 - Mês Atual", "Etapa 2 - Próximo Mês").
  - **VERIFY**: Alternar checkboxes recalcula em 0ms o "Total do Tratamento Completo" vs "Total Selecionado para Fechar Agora".

- [ ] **Task 5: Galeria Opcional de Fotos Anexas (`src/components/BudgetAttachmentsGallery.tsx`)**
  - **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
  - **INPUT**: Funções de upload/galeria do Supabase já existentes.
  - **OUTPUT**: Seção recolhível/compacta para anexar fotos clínicas ou radiografias (upload direto ou escolha da galeria do paciente) com título/observação opcional, sem exigir marcação de bolinhas (mantendo o modo legado de bolinhas apenas como opção secundária se o usuário desejar abrir).
  - **VERIFY**: Upload de foto anexa a imagem ao orçamento e exibe no PDF de forma limpa.

- [ ] **Task 6: Integração na Calculadora de Negociação e PDF por Etapas (`src/components/NegotiationTab.tsx` e `src/components/DentalCRMView.tsx`)**
  - **Agent**: `frontend-specialist` | **Skill**: `nextjs-react-expert`
  - **INPUT**: `NegotiationTab.tsx`, `DentalCRMView.tsx`
  - **OUTPUT**:
    - Seletor rápido de Maquininha: **Ton** vs **InfinitePay (InfiniteTap)** + botão **"🔄 Atualizar Taxas (IA)"** + modal de conferência/ajuste fino de taxas.
    - Simulador calculando sobre o **Valor das Etapas Ativas** (ou Total Completo, com toggle de 1 clique).
    - PDF reformulado exibindo os procedimentos agrupados por Etapa (destacando o que está sendo fechado agora e listando opcionalmente as "Próximas Etapas Planejadas").
  - **VERIFY**: `npm run build` compila sem erros; simulação calcula parcelas exatas na Ton e no InfiniteTap; PDF é gerado agrupado por fases.

## Phase X: Final Verification
- [ ] `npx tsc --noEmit` (Zero erros de tipagem)
- [ ] `npm run build` (Build de produção limpo)
- [ ] Teste visual no navegador (Odontograma 2D, divisão por etapas ao vivo, alternância Ton/InfiniteTap e geração de PDF)
