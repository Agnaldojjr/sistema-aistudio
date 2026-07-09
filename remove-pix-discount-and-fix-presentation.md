# Plano de Implementação: Ajustes de Pagamento e Correção do Modo Apresentação (Paciente) na Arcada 3D

Este documento detalha o plano de ação para ajustar o motor financeiro e a exibição da tela de apresentação no módulo 3D do sistema.

---

## 1. Objetivos

1. **Remover o desconto automático de 5% no PIX** no motor de cálculo do orçamento 3D.
2. **Adicionar/Manter as formas de pagamento** no painel de orçamento da Arcada 3D:
   - **PIX**
   - **Cartão de Crédito**
   - **Dinheiro/Espécie**
   *(Nota: A opção de Boleto Bancário foi completamente removida).*
3. **Limitação de Parcelamento por Forma de Pagamento**:
   - **PIX ou Dinheiro/Espécie**: parcelamento travado automaticamente em **1x** (À Vista).
   - **Cartão de Crédito**: permitir parcelamento de **1x a 12x**.
4. **Substituição do `WindowPortal`**:
   - Remover a abertura de pop-up via `WindowPortal` (que causava problemas de tela branca devido a CORS, pop-ups bloqueados pelo navegador e falha de renderização do contexto WebGL/Three.js fora da aba principal).
   - Implementar uma sobreposição (*overlay*) moderna, fluida e em tela cheia (`fixed inset-0 z-[9999]`) diretamente na aba do aplicativo atual.

---

## 2. Dependências & Análise de Impacto

- **Sem efeitos colaterais globais**: O motor de cálculo `calculateBudget` é utilizado exclusivamente dentro do módulo `TreatmentPlanning3D` (especificamente no `BudgetPanel3D.tsx`). Modificar sua assinatura não afetará a tela principal de propostas/CRM do consultório, que possui sua própria lógica customizável.
- **Three.js no mesmo documento**: Ao migrar a apresentação para um overlay interno na mesma aba, o canvas 3D do Three.js é montado nativamente na mesma janela. Isso evita a perda de contexto WebGL que ocorria ao tentar transferir a renderização do portal para a nova janela do navegador.

---

## 3. Arquivos a serem Modificados

### 3.1. `src/TreatmentPlanning3D/services/budgetEngine.ts`

Ajustar a assinatura da função `calculateBudget` para aceitar as três formas de pagamento (PIX, CREDIT_CARD, CASH) e remover o desconto automático embutido de 5% quando PIX é selecionado.

```diff
  export function calculateBudget(
    itemPrices: number[],
    discountType: 'PERCENT' | 'FIXED',
    discountValue: number,
    installmentsCount: number,
-   paymentMethod: 'PIX' | 'CREDIT_CARD'
+   paymentMethod: 'PIX' | 'CREDIT_CARD' | 'CASH'
  ): BudgetCalculationResult {
    const rawSubtotal = itemPrices.reduce((sum, p) => sum + p, 0);
    const subtotal = roundToCents(rawSubtotal);
    
    // Cálculo do desconto
    let discountAmount = 0;
    if (discountType === 'PERCENT') {
      discountAmount = roundToCents(subtotal * (discountValue / 100));
    } else {
      discountAmount = Math.min(discountValue, subtotal);
    }
  
-   // Se for Pix, aplica um desconto adicional automático de 5% sobre o valor pós-desconto
-   let total = roundToCents(subtotal - discountAmount);
-   if (paymentMethod === 'PIX') {
-     const pixDiscount = roundToCents(total * 0.05);
-     discountAmount = roundToCents(discountAmount + pixDiscount);
-     total = roundToCents(subtotal - discountAmount);
-   }
+   const total = roundToCents(subtotal - discountAmount);
```

---

### 3.2. `src/TreatmentPlanning3D/components/BudgetPanel3D.tsx`

1. **Atualizar o Estado e Adicionar Helpers**:
   Ajustar a tipagem do estado de `paymentMethod` e criar rotinas de limite de parcelamento (PIX e CASH travados em 1x, CREDIT_CARD até 12x).

```typescript
  // Alterar a tipagem do state para suportar PIX, CREDIT_CARD e CASH
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | 'CASH'>('PIX');

  // Helper para determinar limite de parcelas
  const getMaxInstallments = (method: 'PIX' | 'CREDIT_CARD' | 'CASH') => {
    if (method === 'CREDIT_CARD') return 12;
    return 1;
  };

  // Handler para troca de meio de pagamento
  const handlePaymentMethodChange = (method: 'PIX' | 'CREDIT_CARD' | 'CASH') => {
    setPaymentMethod(method);
    const max = getMaxInstallments(method);
    if (installmentsCount > max || method === 'PIX' || method === 'CASH') {
      setInstallmentsCount(max);
    }
  };
```

2. **Interface Gráfica das Formas de Pagamento**:
   Substituir o grid de botões para exibir as 3 opções de pagamento (PIX, Cartão de Crédito, Dinheiro/Espécie).

```tsx
        {/* Forma de Pagamento */}
        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1.5">Forma de Pagamento</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handlePaymentMethodChange('PIX')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                paymentMethod === 'PIX'
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              PIX
            </button>
            <button
              onClick={() => handlePaymentMethodChange('CREDIT_CARD')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                paymentMethod === 'CREDIT_CARD'
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Cartão de Crédito
            </button>
            <button
              onClick={() => handlePaymentMethodChange('CASH')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                paymentMethod === 'CASH'
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Dinheiro/Espécie
            </button>
          </div>
        </div>
```

3. **Interface do Seletor e Simulador de Parcelas**:
   Ajustar a exibição para ser habilitada apenas para `CREDIT_CARD`.

```tsx
        {/* Parcelas (Só se for cartão de crédito) */}
        {paymentMethod === 'CREDIT_CARD' && (
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1.5">Número de Parcelas</label>
            <select
              value={installmentsCount}
              onChange={(e) => setInstallmentsCount(parseInt(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {Array.from({ length: getMaxInstallments(paymentMethod) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}x sem juros</option>
              ))}
            </select>
          </div>
        )}
```

```tsx
      {/* Simulação de Parcelamento */}
      {paymentMethod === 'CREDIT_CARD' && installmentsCount > 1 && (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Escalonamento de Parcelas</span>
          </p>
          <div className="max-h-24 overflow-y-auto space-y-1 text-slate-300 text-[11px] pr-1">
            {budget.installmentsList.map((inst) => (
              <div key={inst.number} className="flex justify-between p-1 bg-slate-950/40 rounded border border-slate-800/40">
                <span>Parcela {inst.number}/{installmentsCount}</span>
                <span>R$ {inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
```

4. **Impressão do PDF**:
   Ajustar a exibição da modalidade de pagamento selecionada e parcelamento no PDF exportado, removendo qualquer referência a boleto.

```typescript
      // 6. Condições de Pagamento
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(8.5);
      
      let paymentMethodLabel = '';
      if (paymentMethod === 'PIX') {
        paymentMethodLabel = 'PIX (À Vista)';
      } else if (paymentMethod === 'CASH') {
        paymentMethodLabel = 'Dinheiro/Espécie (À Vista)';
      } else if (paymentMethod === 'CREDIT_CARD') {
        paymentMethodLabel = `${installmentsCount}x no Cartão de Crédito`;
      }
      
      doc.text(`Condição de Pagamento: ${paymentMethodLabel}`, 15, summaryY + 28);
      
      if (paymentMethod === 'CREDIT_CARD' && installmentsCount > 1) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        doc.text(`Parcelas: ${installmentsCount} parcelas mensais e sucessivas de R$ ${budget.installmentsList[0].amount.toFixed(2)}`, 15, summaryY + 33);
      }
```

---

### 3.3. `src/TreatmentPlanning3D/components/PresentationPanel3D.tsx`

Substituir o componente `WindowPortal` por um container de sobreposição de tela inteira (`fixed inset-0 z-[9999]`) local, e remover sua importação.

```diff
-import { WindowPortal } from '../../components/WindowPortal';
 
  export function PresentationPanel3D() {
    ...
  
    return (
-    <WindowPortal onClose={() => setPresentationMode(false)} title="Modo Paciente - Apresentação">
-      <div className="w-full h-full bg-slate-950 text-slate-200 flex flex-col p-6 animate-in slide-in-from-bottom-10 fade-in duration-500 overflow-hidden">
+    <div className="fixed inset-0 z-[9999] bg-slate-950 text-slate-200 flex flex-col p-6 animate-in slide-in-from-bottom-10 fade-in duration-500 overflow-hidden">
         {/* Cabeçalho */}
         ...
         <button
           onClick={() => setPresentationMode(false)}
           className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all"
         >
           Sair da Apresentação
         </button>
         ...
-      </div>
-    </WindowPortal>
+    </div>
    );
  }
```

---

### 3.4. `src/components/WindowPortal.tsx`

Como esta é a única funcionalidade que utilizava o componente `WindowPortal.tsx` e o mesmo causava erros, o arquivo se tornará obsoleto e poderá ser removido do projeto para manter a base de código limpa (*Clean Code*).

---

## 4. Plano de Validação

Para garantir que as modificações funcionam perfeitamente sem regredir a experiência do usuário, execute o seguinte roteiro de testes visuais e manuais:

### Cenário de Teste 1: Regras Financeiras no Painel de Orçamento
1. Abra o módulo de **Treatment Planning 3D** da Arcada 3D.
2. Com um paciente carregado, adicione alguns procedimentos e selecione a forma de pagamento **PIX**:
   - Verifique que o desconto automático de 5% **não** é aplicado.
   - Verifique que o campo de número de parcelas é ocultado/travado em 1.
3. Altere a forma de pagamento para **Dinheiro/Espécie**:
   - Confirme que o comportamento é idêntico ao do PIX (travado em 1x e sem desconto automático).
4. Altere a forma de pagamento para **Cartão de Crédito**:
   - O seletor de parcelas deve aparecer de 1x a 12x.
   - Mude para 12x e verifique se a simulação detalhada da lista de parcelas na base do painel aparece correta.
5. Verifique visualmente que a opção de **Boleto Bancário** não é exibida e não está disponível para seleção.

### Cenário de Teste 2: Geração de PDF do Orçamento
1. Para cada meio de pagamento testado no cenário anterior (PIX, Dinheiro/Espécie e Cartão de Crédito), clique em **Gerar Orçamento em PDF**.
2. Verifique se o PDF gerado exibe:
   - A descrição correta da condição de pagamento (Ex: `Cartão de Crédito (12x)` ou `PIX (À Vista)`).
   - O valor individual das parcelas simuladas no rodapé da seção financeira (se for Cartão parcelado).
   - Sem desconto automático indevido do PIX no sumário final.
   - Sem qualquer menção a "Boleto Bancário".

### Cenário de Teste 3: Modo Apresentação (Paciente)
1. Na tela principal do módulo 3D, clique em **Apresentar ao Paciente**.
2. **Resultado esperado**:
   - A tela inteira do navegador deve ser preenchida de forma instantânea e fluida pelo painel de apresentação (Modo Paciente).
   - O canvas 3D (arcada dentária) deve carregar sem qualquer tela branca, com interação 3D de rotação/zoom activa.
   - Não devem ocorrer alertas de pop-up bloqueado na barra de endereços do navegador.
3. Teste o aceite do tratamento clicando em **Aprovar Tratamento**, insira uma assinatura digital de exemplo e confirme.
4. Clique em **Sair da Apresentação** e confirme que o overlay desaparece e você retorna imediatamente para o modo de edição do planejamento clínico.
