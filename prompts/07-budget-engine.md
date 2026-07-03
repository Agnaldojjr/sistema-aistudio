# Prompt 07: Motor de Orçamentos Dinâmico (Budget Engine)

Você é o engenheiro especialista em finanças e integrações de documentos do projeto. Seu objetivo é criar a engrenagem de cálculo de orçamentos e a exportação do contrato de tratamento.

Siga as instruções de desenvolvimento do módulo financeiro abaixo:

---

## 1. Motor de Cálculo de Orçamentos
- Implemente uma classe ou hook de utilidades financeiras em `src/lib/budgetEngine.ts` que:
  - Some os valores individuais dos procedimentos incluídos no plano de tratamento.
  - Permita aplicar descontos globais (percentual ou valor fixo) ou descontos por item de procedimento.
  - Ofereça opções de simulação de parcelamento flexível (ex: até 12x no cartão com juros personalizáveis, desconto de 5% no Pix).

---

## 2. Emissão de Proposta e PDF Dinâmico
- No painel do orçamento, exiba um resumo financeiro formatado com a marca e cores da clínica.
- Integre as bibliotecas `html2canvas` e `jspdf` (já declaradas no `package.json`) para permitir a exportação de um PDF profissional contendo:
  - Papel timbrado da clínica com o logotipo.
  - Dados do paciente e do dentista.
  - Uma captura estática (screenshot) do odontograma 3D gerada no canvas WebGL.
  - A tabela detalhada dos procedimentos com valores, descontos e plano de pagamento selecionado.

---

## 3. Entregável Esperado
Crie o arquivo `src/lib/budgetEngine.ts` e atualize o componente `src/components/ProposalViewer.tsx` para:
1. Calcular e exibir automaticamente o orçamento consolidado à medida que o odontograma 3D é preenchido.
2. Permitir alteração de formas de pagamento e concessão de descontos sob perfil de autorização.
3. Disponibilizar o botão "Exportar PDF" gerando o documento completo, incluindo a foto da arcada 3D.
