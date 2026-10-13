/**
 * Parser nativo e determinístico para orçamentos gerados pelo sistema.
 * Permite reimportar PDFs emitidos pelo próprio sistema sem necessidade de IA externa,
 * garantindo velocidade instantânea, zero custo e zero falhas de rede.
 */

export interface ParsedBudgetItem {
  toothNumber: number | null;
  toothRaw: string;
  procedureName: string;
  price: number;
}

export interface InternalBudgetParseResult {
  isInternal: boolean;
  source: 'metadata' | 'text_table' | 'none';
  patientName: string;
  items: ParsedBudgetItem[];
  total?: number;
}

export function parseInternalBudgetPdf(rawText: string): InternalBudgetParseResult | null {
  if (!rawText) return null;

  const isInternal =
    rawText.includes('Planejador Odontológico Integrado') ||
    rawText.includes('Planejador Odontologico Integrado') ||
    rawText.includes('PLANO DE TRATAMENTO E ORÇAMENTO') ||
    rawText.includes('PLANO DE TRATAMENTO E ORCAMENTO') ||
    rawText.includes('CLÍNICA ODONTOLÓGICA DIGITAL') ||
    rawText.includes('CLINICA ODONTOLOGICA DIGITAL') ||
    rawText.includes('AG_ODONTO_BUDGET');

  if (!isInternal) {
    return null;
  }

  // 1. Tentar ler metadados JSON embutidos (/Keywords)
  try {
    const kwMatch =
      rawText.match(/\/Keywords\s*\(([\s\S]*?)\)\s*\/[A-Z]/i) ||
      rawText.match(/\/Keywords\s*\(([\s\S]*?)\)/i);

    if (kwMatch && kwMatch[1]) {
      const cleanJson = kwMatch[1].trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && (parsed.type === 'AG_ODONTO_BUDGET' || parsed.system) && Array.isArray(parsed.items)) {
        return {
          isInternal: true,
          source: 'metadata',
          patientName: parsed.patientName || '',
          items: parsed.items.map((it: any) => ({
            toothNumber: typeof it.toothNumber === 'number' ? it.toothNumber : (parseInt(String(it.tooth || it.toothNumber), 10) || null),
            toothRaw: String(it.toothRaw || it.tooth || ''),
            procedureName: it.procedureName || it.name || 'Procedimento',
            price: Number(it.price) || 0
          })),
          total: Number(parsed.total) || undefined
        };
      }
    }
  } catch (e) {
    console.warn('Falha ao processar metadados JSON do PDF, tentando leitura vetorial:', e);
  }

  // 2. Extração determinística via operadores de texto Tj do jsPDF
  try {
    const textMatches = [...rawText.matchAll(/\(([^)]+)\)\s*Tj/g)]
      .map(m => m[1].trim())
      .filter(Boolean);

    if (textMatches.length === 0) {
      return { isInternal: true, source: 'none', patientName: '', items: [] };
    }

    // Extrair Nome do Paciente
    let patientName = '';
    const pacIdx = textMatches.findIndex(t => t.toUpperCase() === 'PACIENTE:');
    if (pacIdx !== -1 && textMatches[pacIdx + 1]) {
      patientName = textMatches[pacIdx + 1];
    }

    // Delimitar a tabela de procedimentos
    const startIdx = textMatches.findIndex(
      t => t.toUpperCase().includes('VALOR UNIT') || t.toUpperCase().includes('DENTE/REGI')
    );

    let endIdx = textMatches.findIndex(
      (t, idx) =>
        idx > startIdx &&
        (t.toUpperCase().includes('PLANO FINANCEIRO') ||
          t.toUpperCase().includes('INVESTIMENTO TOTAL') ||
          t.toUpperCase().includes('ASSINATURA') ||
          t.toUpperCase().includes('PLANEJADOR ODONTOL'))
    );

    if (startIdx === -1) {
      return { isInternal: true, source: 'none', patientName, items: [] };
    }

    const slice = endIdx !== -1 ? textMatches.slice(startIdx + 1, endIdx) : textMatches.slice(startIdx + 1);

    const items: ParsedBudgetItem[] = [];
    let i = 0;

    while (i < slice.length) {
      const toothCandidate = slice[i];
      const procCandidate = slice[i + 1];
      const priceCandidate = slice[i + 2];

      // Formato padrão: [Dente, Procedimento, Valor]
      const isMoney3 =
        priceCandidate &&
        (priceCandidate.includes('R$') || /^\d+[.,]\d{2}$/.test(priceCandidate.replace('R$', '').trim()));

      if (procCandidate && isMoney3) {
        const toothNum = parseInt(toothCandidate, 10);
        const cleanPrice = parseFloat(priceCandidate.replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0;
        items.push({
          toothNumber: isNaN(toothNum) ? null : toothNum,
          toothRaw: toothCandidate,
          procedureName: procCandidate,
          price: cleanPrice
        });
        i += 3;
        continue;
      }

      // Formato sem dente especificado: [Procedimento, Valor]
      const isMoney2 =
        procCandidate &&
        (procCandidate.includes('R$') || /^\d+[.,]\d{2}$/.test(procCandidate.replace('R$', '').trim()));

      if (isMoney2) {
        const cleanPrice = parseFloat(procCandidate.replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0;
        items.push({
          toothNumber: null,
          toothRaw: '',
          procedureName: toothCandidate,
          price: cleanPrice
        });
        i += 2;
        continue;
      }

      i++;
    }

    return {
      isInternal: true,
      source: 'text_table',
      patientName,
      items
    };
  } catch (err) {
    console.error('Erro na extração de texto do PDF:', err);
    return { isInternal: true, source: 'none', patientName: '', items: [] };
  }
}
