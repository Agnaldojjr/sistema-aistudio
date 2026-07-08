import React, { useState } from 'react';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { calculateBudget } from '../services/budgetEngine';
import { usePatientContext } from '../../context/PatientContext';
import { jsPDF } from 'jspdf';
import { Coins, FileText, CheckCircle, Percent, DollarSign, Calendar, Printer } from 'lucide-react';

export function BudgetPanel3D() {
  const { procedures, teeth, getPlanTotal } = usePlanning3D();
  const { activeProposal } = usePatientContext();

  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(5);
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const prices = procedures.map((p) => p.price);
  
  const budget = calculateBudget(
    prices,
    discountType,
    discountValue,
    paymentMethod === 'PIX' ? 1 : installmentsCount,
    paymentMethod
  );

  const handleExportPdf = () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // 1. Cabeçalho Clínico (Papel Timbrado Premium)
      doc.setFillColor(139, 0, 0); // Burgundy (#8B0000)
      doc.rect(0, 0, 210, 30, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('DR. AGNALDO FERREIRA', 15, 12);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(240, 240, 240);
      doc.text('ODONTOLOGIA RESTAURADORA • CRO-SP 123456', 15, 18);
      doc.text('Email: contato@dragnaldo.com.br • WhatsApp: (11) 99999-9999', 15, 23);

      // 2. Dados do Paciente e do Orçamento
      doc.setTextColor(30, 30, 30);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('PROPOSTA COMERCIAL DE TRATAMENTO 3D', 15, 42);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Paciente: ${activeProposal.patientName || 'Paciente de Teste'}`, 15, 49);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 15, 54);
      doc.text(`Status do Plano: ${activeProposal.status || 'Em Planejamento'}`, 15, 59);

      // Linha separadora
      doc.setDrawColor(230, 222, 201);
      doc.setLineWidth(0.5);
      doc.line(15, 64, 195, 64);

      // 3. Captura do Canvas 3D
      const canvas = document.querySelector('canvas');
      if (canvas) {
        try {
          const imgData = canvas.toDataURL('image/png');
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9);
          doc.text('Mapa Anatômico Digital da Arcada:', 15, 71);
          
          // Adiciona a imagem no PDF (x: 15, y: 74, w: 90, h: 60)
          doc.addImage(imgData, 'PNG', 15, 74, 90, 60);
          
          // Notas no lado direito da imagem
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text('Notas de Planejamento:', 115, 76);
          
          const splitNotes = doc.splitTextToSize(
            activeProposal.notes || 'Mapa visual em 3D gerado para ilustrar as patologias indicadas, servindo de base didática para o entendimento clínico dos procedimentos.',
            80
          );
          doc.text(splitNotes, 115, 82);
        } catch (canvasErr) {
          console.error('[BudgetPanel3D:Pdf] Falha ao renderizar imagem do Canvas:', canvasErr);
        }
      }

      // 4. Tabela de Procedimentos e Valores
      let yOffset = 145;
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yOffset, 180, 7, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      doc.text('Dente', 17, yOffset + 5);
      doc.text('Procedimento Realizado', 35, yOffset + 5);
      doc.text('Valor Unitário', 165, yOffset + 5);

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      
      procedures.forEach((p, idx) => {
        const itemY = yOffset + 12 + (idx * 6);
        // Evita estourar a página
        if (itemY < 270) {
          // Busca o dente associado ao ID
          const toothObj = Object.values(teeth).find((t) => t.id === p.tooth_id);
          const toothNum = toothObj ? `Dente ${toothObj.tooth}` : 'Geral';
          
          doc.text(toothNum, 17, itemY);
          doc.text(p.procedure, 35, itemY);
          doc.text(`R$ ${p.price.toFixed(2)}`, 165, itemY);
        }
      });

      // 5. Consolidação Financeira
      const summaryY = yOffset + 18 + (procedures.length * 6);
      doc.setDrawColor(220, 220, 220);
      doc.line(15, summaryY, 195, summaryY);

      doc.setFont('Helvetica', 'normal');
      doc.text('Subtotal Bruto:', 125, summaryY + 8);
      doc.text(`R$ ${budget.subtotal.toFixed(2)}`, 165, summaryY + 8);

      doc.text('Desconto Concedido:', 125, summaryY + 13);
      doc.text(`R$ ${budget.discountAmount.toFixed(2)}`, 165, summaryY + 13);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(139, 0, 0);
      doc.text('Valor Total Líquido:', 125, summaryY + 19);
      doc.text(`R$ ${budget.total.toFixed(2)}`, 165, summaryY + 19);

      // 6. Condições de Pagamento
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(8.5);
      doc.text(`Condição de Pagamento: ${paymentMethod === 'PIX' ? 'PIX (À Vista com Desconto)' : `${installmentsCount}x no Cartão`}`, 15, summaryY + 28);
      
      if (paymentMethod === 'CREDIT_CARD' && installmentsCount > 1) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        doc.text(`Parcelas: ${installmentsCount} parcelas mensais e sucessivas de R$ ${budget.installmentsList[0].amount.toFixed(2)}`, 15, summaryY + 33);
      }

      // Rodapé
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text('Este documento é uma estimativa comercial sujeita a alterações conforme diagnóstico de exames complementares.', 15, 287);

      doc.save(`Proposta_3D_${activeProposal.patientName || 'Paciente'}.pdf`);
    } catch (err) {
      console.error('[BudgetPanel3D:Pdf] Erro na exportação do PDF:', err);
      alert('Ocorreu um erro ao gerar o PDF. Verifique se o navegador suporta exportação.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 text-white">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider text-xs border-b border-slate-800 pb-3">
        <Coins className="w-4 h-4" />
        <span>Motor Financeiro Integrado</span>
      </div>

      {/* Inputs de Configuração Financeira */}
      <div className="flex flex-col gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        {/* Forma de Pagamento */}
        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1.5">Forma de Pagamento</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setPaymentMethod('PIX'); setInstallmentsCount(1); }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                paymentMethod === 'PIX'
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              PIX (5% desc.)
            </button>
            <button
              onClick={() => setPaymentMethod('CREDIT_CARD')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                paymentMethod === 'CREDIT_CARD'
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Cartão de Crédito
            </button>
          </div>
        </div>

        {/* Descontos */}
        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1.5">Desconto Comercial</label>
          <div className="flex gap-2">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'PERCENT' | 'FIXED')}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="PERCENT">% Desc.</option>
              <option value="FIXED">Valor Fixo (R$)</option>
            </select>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
              className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
              min="0"
            />
          </div>
        </div>

        {/* Parcelas (Só se for cartão) */}
        {paymentMethod === 'CREDIT_CARD' && (
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1.5">Número de Parcelas</label>
            <select
              value={installmentsCount}
              onChange={(e) => setInstallmentsCount(parseInt(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n}>{n}x sem juros</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Resumo Financeiro Consolidado */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
        <div className="flex justify-between text-xs text-slate-400 font-semibold">
          <span>Subtotal Bruto:</span>
          <span>R$ {budget.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-400 font-semibold">
          <span>Descontos:</span>
          <span className="text-emerald-400">- R$ {budget.discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="border-t border-slate-800 pt-2 mt-2 flex justify-between text-sm font-bold">
          <span className="text-slate-200">Total Líquido:</span>
          <span className="text-sky-400 text-base">R$ {budget.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

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

      {/* Ação de Exportar */}
      <button
        onClick={handleExportPdf}
        disabled={generatingPdf || procedures.length === 0}
        className="w-full py-3 bg-red-800 hover:bg-red-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed border border-red-700 disabled:border-slate-800 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
      >
        <Printer className="w-4 h-4" />
        <span>{generatingPdf ? 'Gerando Documento...' : 'Gerar Orçamento em PDF'}</span>
      </button>
    </div>
  );
}
