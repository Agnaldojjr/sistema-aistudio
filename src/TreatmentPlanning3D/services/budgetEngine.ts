export interface BudgetCalculationResult {
  subtotal: number;
  discountAmount: number;
  total: number;
  installmentsList: {
    number: number;
    amount: number;
    dueDate: string;
  }[];
}

/**
 * Helper para evitar imprecisões de ponto flutuante do JavaScript
 */
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Realiza os cálculos do orçamento com base nos itens, descontos e parcelas
 */
export function calculateBudget(
  itemPrices: number[],
  discountType: 'PERCENT' | 'FIXED',
  discountValue: number,
  installmentsCount: number,
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'CASH'
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

  const total = roundToCents(subtotal - discountAmount);

  // Simulação das parcelas
  const installmentsList = [];
  const baseInstallmentAmount = roundToCents(total / installmentsCount);
  let accumulated = 0;
  
  for (let i = 1; i <= installmentsCount; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    
    let amount = baseInstallmentAmount;
    if (i === installmentsCount) {
      amount = roundToCents(total - accumulated);
    } else {
      accumulated = roundToCents(accumulated + amount);
    }
    
    installmentsList.push({
      number: i,
      amount,
      dueDate: date.toLocaleDateString('pt-BR'),
    });
  }

  return {
    subtotal,
    discountAmount,
    total,
    installmentsList,
  };
}
