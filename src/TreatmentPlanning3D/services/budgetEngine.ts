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

export class BudgetEngine {
  /**
   * Helper para evitar imprecisões de ponto flutuante do JavaScript
   */
  private static roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Realiza os cálculos do orçamento com base nos itens, descontos e parcelas
   */
  static calculate(
    itemPrices: number[],
    discountType: 'PERCENT' | 'FIXED',
    discountValue: number,
    installmentsCount: number,
    paymentMethod: 'PIX' | 'CREDIT_CARD'
  ): BudgetCalculationResult {
    const rawSubtotal = itemPrices.reduce((sum, p) => sum + p, 0);
    const subtotal = this.roundToCents(rawSubtotal);
    
    // Cálculo do desconto
    let discountAmount = 0;
    if (discountType === 'PERCENT') {
      discountAmount = this.roundToCents(subtotal * (discountValue / 100));
    } else {
      discountAmount = Math.min(discountValue, subtotal);
    }

    // Se for Pix, aplica um desconto adicional automático de 5% sobre o valor pós-desconto
    let total = this.roundToCents(subtotal - discountAmount);
    if (paymentMethod === 'PIX') {
      const pixDiscount = this.roundToCents(total * 0.05);
      discountAmount = this.roundToCents(discountAmount + pixDiscount);
      total = this.roundToCents(subtotal - discountAmount);
    }

    // Simulação das parcelas
    const installmentsList = [];
    const baseInstallmentAmount = this.roundToCents(total / installmentsCount);
    let accumulated = 0;
    
    for (let i = 1; i <= installmentsCount; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      
      let amount = baseInstallmentAmount;
      if (i === installmentsCount) {
        amount = this.roundToCents(total - accumulated);
      } else {
        accumulated = this.roundToCents(accumulated + amount);
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
}
