# Diretrizes de Testes e Controle de Qualidade

Este guia define a estratégia de testes para assegurar que as regras de negócio clínicas, o motor de orçamentos e as interações 3D permaneçam livres de bugs a cada atualização.

---

## 1. Testes Unitários (Vitest / Jest)
- **Foco Principal**: Lógicas de cálculo financeiro no `BudgetEngine` (descontos, parcelamento, conversão de moedas) e lógica de conversão de notações de dentes (FDI).
- **Isolamento de Regras**: As funções de precificação devem ser puras e fáceis de testar sem depender de banco de dados ativo.

```typescript
// Exemplo de teste unitário para o motor de orçamentos
import { calculateBudget } from '../lib/budgetEngine';

test('deve aplicar desconto percentual corretamente', () => {
  const items = [{ price: 100 }, { price: 200 }];
  const result = calculateBudget(items, { discountPercent: 10 });
  expect(result.total).toBe(270);
});
```

---

## 2. Testes de Componentes (React Testing Library)
- Teste interações básicas de formulário como a ficha de anamnese e cadastro de procedimentos.
- Garanta que cliques em botões abram gavetas (drawers) e modais como esperado.
- Use mocks para o contexto do paciente (`PatientContext`) para testar o comportamento visual de componentes isoladamente.

---

## 3. Testes End-to-End (Playwright / Cypress)
- **Cenário de Teste Crítico**: Fluxo completo de atendimento:
  1. Acessar tela do paciente.
  2. Selecionar um dente e marcar um diagnóstico.
  3. Gerar orçamento baseado no dente selecionado.
  4. Modificar parcelamento e salvar.
- **Teste de Canvas 3D**: Como o Playwright não consegue inspecionar elementos internos do canvas WebGL facilmente, teste simulando cliques de mouse em coordenadas específicas do canvas e verifique se a gaveta lateral de dente foi aberta com o ID correto na DOM.
- **Limpeza de Dados**: Garanta que as rodadas de testes E2E usem um banco de dados de teste (Supabase local/Docker) e limpem todos os dados criados após a execução.
