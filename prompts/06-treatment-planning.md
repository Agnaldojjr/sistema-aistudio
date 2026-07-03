# Prompt 06: Módulo de Planejamento de Tratamento Clínico

Você é o desenvolvedor encarregado de criar a interface de planejamento clínico. Seu objetivo é permitir que o dentista registre diagnósticos e planeje tratamentos de forma estruturada e em fases com base na seleção 3D.

Siga as instruções de desenvolvimento clínico abaixo:

---

## 1. Vinculação de Diagnósticos e Procedimentos
- Crie um formulário na barra lateral que é acionado quando um dente/superfície é selecionado.
- Apresente uma lista de procedimentos padrão (ex: Restauração Resina, Implante Dentário, Canal Molar, Profilaxia) importados de `src/constants.ts`.
- Permita associar um procedimento à seleção ativa (ex: Dente 16 - Face Oclusal -> Restauração Resina 1 Face).

---

## 2. Divisão em Fases (Timeline do Planejamento)
- Implemente uma seção no prontuário que permite dividir o tratamento em fases cronológicas:
  - *Fase 1 (Urgências e Profilaxia)*: Ex: Raspagem periodontal, extração do dente infeccionado 38.
  - *Fase 2 (Dentística e Endodontia)*: Ex: Canal no dente 22, restaurações diversas.
  - *Fase 3 (Reabilitação e Estética)*: Ex: Implante no dente 36, facetas de porcelana nos dentes 11 e 21.
- Permita arrastar e soltar (drag and drop) procedimentos entre as fases para organizar o fluxo de tratamento facilmente.

---

## 3. Entregável Esperado
Implemente ou atualize o componente `src/components/ClinicalAttendanceManager.tsx` e crie `src/components/TreatmentPlanner.tsx` para conter:
1. Painel lateral para atribuição rápida de procedimentos a dentes e faces.
2. Timeline ou lista de fases do plano de tratamento com possibilidade de alterar o status de cada item (`PENDENTE`, `EM_ANDAMENTO`, `CONCLUÍDO`).
3. Sincronização em tempo real das alterações visuais dos dentes no visualizador 3D.
