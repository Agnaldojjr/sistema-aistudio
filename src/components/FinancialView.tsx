import React, { useState, useMemo } from 'react';
import { useReactiveLocalStorage } from '../hooks/useReactiveLocalStorage';
import { PaymentRecord } from '../types';
import { DollarSign, FileText, CheckCircle, Clock, Search, Filter } from 'lucide-react';

interface FinancialViewProps {
  onOpenPatient?: (patientName: string) => void;
}

export default function FinancialView({ onOpenPatient }: FinancialViewProps) {
  const [payments, setPayments] = useReactiveLocalStorage<PaymentRecord[]>('agnaldo_dent_financeiro', []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('Todos');

  const parseSafeDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    
    // Parse pt-BR formats like "14/07/2026, 14:10:30"
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      
      const timeMatch = dateStr.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1], 10);
        const min = parseInt(timeMatch[2], 10);
        const sec = parseInt(timeMatch[3], 10);
        return new Date(year, month, day, hour, min, sec);
      }
      return new Date(year, month, day);
    }
    return new Date();
  };

  const deduplicatedPayments = useMemo(() => {
    const map = new Map<string, PaymentRecord>();
    payments.forEach(p => {
      const procId = p.procedureId && p.procedureId !== 'custom' ? p.procedureId : null;
      const apptId = p.appointmentId && p.appointmentId !== 'custom' ? p.appointmentId : null;
      
      const rawDate = (p.date || '').trim();
      const datePart = rawDate ? (rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.split(',')[0].trim()) : '';
      const namePart = (p.patientName || p.patientId || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const descPart = (p.description || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      
      const key = procId
        ? `proc:${procId}`
        : apptId
        ? `appt:${apptId}`
        : `${p.id || ''}_${namePart}_${descPart}_${p.amount}_${datePart}`;

      if (!map.has(key) || p.status === 'Pago') {
        map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [payments]);

  const totalRevenue = useMemo(() => {
    return deduplicatedPayments
      .filter(p => p.status === 'Pago')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [deduplicatedPayments]);

  const closedBudgetsCount = useMemo(() => {
    return deduplicatedPayments.filter(p => p.status === 'Pago').length;
  }, [deduplicatedPayments]);

  const openBudgetsCount = useMemo(() => {
    return deduplicatedPayments.filter(p => p.status === 'Pendente').length;
  }, [deduplicatedPayments]);

  const filteredPayments = useMemo(() => {
    return deduplicatedPayments.filter(p => {
      const matchSearch = p.patientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMethod = filterMethod === 'Todos' || p.paymentMethod === filterMethod;
      return matchSearch && matchMethod;
    }).sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
  }, [deduplicatedPayments, searchTerm, filterMethod]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-500 uppercase">Receita Total</p>
            <p className="text-2xl font-bold text-zinc-800">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-500 uppercase">Orçamentos Fechados</p>
            <p className="text-2xl font-bold text-zinc-800">{closedBudgetsCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-500 uppercase">Orçamentos Pendentes</p>
            <p className="text-2xl font-bold text-zinc-800">{openBudgetsCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-5 border-b border-zinc-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-50/50">
          <h3 className="font-bold text-zinc-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-zinc-400" />
            Histórico de Pagamentos
          </h3>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none"
              />
            </div>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="px-4 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none"
            >
              <option value="Todos">Todos os Métodos</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-xs uppercase font-semibold text-zinc-500">
              <tr>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Procedimento</th>
                <th className="px-6 py-4">Forma de Pagamento</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Valor</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-400">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-mono">
                      {parseSafeDate(payment.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-800">
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenPatient) {
                            localStorage.setItem('ag_crm_initial_tab', 'plan_negotiation');
                            onOpenPatient(payment.patientName);
                          }
                        }}
                        className="text-[#8B0000] hover:text-[#A97E3B] hover:underline font-bold text-left cursor-pointer transition-colors font-sans"
                      >
                        {payment.patientName}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-zinc-700 font-semibold max-w-xs truncate">
                      {payment.description || 'Orçamento Aprovado'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800">
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        payment.status === 'Pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${payment.status === 'Pago' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-zinc-800 font-mono">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Deseja realmente excluir este lançamento financeiro?')) {
                            const updated = payments.filter(p => p.id !== payment.id);
                            setPayments(updated);
                          }
                        }}
                        className="text-rose-600 hover:text-rose-800 font-bold transition-colors cursor-pointer text-xs uppercase tracking-wider"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
