import React, { useState, useEffect, useMemo } from 'react';
import { 
  Coins, 
  TrendingUp, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  User, 
  CheckCircle2, 
  CreditCard, 
  ArrowUpRight,
  X,
  FileText,
  AlertCircle
} from 'lucide-react';
import { getSupabaseCRMDatabase, saveSupabaseCRMDatabase } from '../lib/supabaseCrm';

interface Patient {
  id: string;
  name: string;
  mobile?: string;
  phone?: string;
}

interface Payment {
  id: string;
  patientId: string;
  date: string;
  data_pagamento?: string;
  method: 'Dinheiro' | 'PIX' | 'Cartão de Crédito' | 'Cartão de Débito';
  description: string;
  value: number | string;
}

interface Treatment {
  id: string;
  patientId: string;
  date: string;
  proposal: {
    patientName: string;
    status?: string;
    totalValue?: number;
    paymentMethod?: string;
    notes?: string;
  };
}

export default function FinancialView() {
  const [crmData, setCrmData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payments' | 'budgets'>('payments');
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Dinheiro' | 'PIX' | 'Cartão de Crédito' | 'Cartão de Débito'>('PIX');
  const [paymentValue, setPaymentValue] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Load database on mount
  const loadDatabase = async () => {
    setLoading(true);
    try {
      const data = await getSupabaseCRMDatabase();
      setCrmData(data);
    } catch (error) {
      console.error('Error loading CRM database for Financial module:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  // Helper maps
  const patientsMap = useMemo(() => {
    if (!crmData?.patients) return new Map<string, Patient>();
    const map = new Map<string, Patient>();
    crmData.patients.forEach((p: Patient) => {
      map.set(p.id, p);
    });
    return map;
  }, [crmData]);

  // Clean value extractor helper
  const parseValue = (val: any): number => {
    if (typeof val === 'number') return val;
    const clean = String(val || '0').replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  // 1. Process global stats
  const stats = useMemo(() => {
    const paymentsList: Payment[] = crmData?.pagamentos || [];
    const treatmentsList: Treatment[] = crmData?.tratamentos || [];

    // Total Revenue (Sum of all payments)
    const totalRevenue = paymentsList.reduce((sum, p) => sum + parseValue(p.value), 0);

    // Closed/Paid Budgets Count & Value
    const paidBudgets = treatmentsList.filter(t => t.proposal?.status === 'Aprovado (paciente pagou)');
    const totalPaidBudgetsVal = paidBudgets.reduce((sum, t) => sum + (t.proposal?.totalValue || 0), 0);

    // Pending/Open Budgets Count & Value
    const openBudgets = treatmentsList.filter(t => 
      t.proposal?.status === 'Aberto (paciente não pagou)' || 
      t.proposal?.status === 'Aguardando Aprovação' || 
      t.proposal?.status === 'Em Andamento'
    );
    const totalOpenBudgetsVal = openBudgets.reduce((sum, t) => sum + (t.proposal?.totalValue || 0), 0);

    // Distribution by Payment Method (from registered payments)
    const methodSums = {
      'Dinheiro': 0,
      'PIX': 0,
      'Cartão de Crédito': 0,
      'Cartão de Débito': 0
    };
    paymentsList.forEach(p => {
      const m = p.method || 'PIX';
      if (m in methodSums) {
        methodSums[m as keyof typeof methodSums] += parseValue(p.value);
      }
    });

    return {
      totalRevenue,
      paidBudgetsCount: paidBudgets.length,
      totalPaidBudgetsVal,
      openBudgetsCount: openBudgets.length,
      totalOpenBudgetsVal,
      methodSums
    };
  }, [crmData]);

  // 2. Filtered Payments List
  const filteredPayments = useMemo(() => {
    const list: Payment[] = crmData?.pagamentos || [];
    return list.filter(p => {
      const patient = patientsMap.get(p.patientId);
      const patientName = patient?.name || '';
      const matchesSearch = patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesMethod = methodFilter === 'ALL' || p.method === methodFilter;
      
      return matchesSearch && matchesMethod;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [crmData, searchQuery, methodFilter, patientsMap]);

  // 3. Filtered Budgets List
  const filteredBudgets = useMemo(() => {
    const list: Treatment[] = crmData?.tratamentos || [];
    return list.filter(t => {
      const patient = patientsMap.get(t.patientId);
      const patientName = patient?.name || t.proposal?.patientName || '';
      const matchesSearch = patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (t.proposal?.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || t.proposal?.status === statusFilter;
      const matchesMethod = methodFilter === 'ALL' || t.proposal?.paymentMethod === methodFilter;

      return matchesSearch && matchesStatus && matchesMethod;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [crmData, searchQuery, statusFilter, methodFilter, patientsMap]);

  // Handle Manual Payment Registry Form Submission
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !paymentValue || !paymentDescription) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    try {
      const valueNum = parseFloat(paymentValue);
      if (isNaN(valueNum) || valueNum <= 0) {
        alert('Valor do pagamento deve ser um número positivo.');
        setSubmitting(false);
        return;
      }

      const newPayment: Payment = {
        id: `pay-${selectedPatientId}-${Date.now()}`,
        patientId: selectedPatientId,
        date: new Date(paymentDate).toISOString(),
        data_pagamento: new Date(paymentDate).toISOString(),
        method: paymentMethod,
        description: paymentDescription,
        value: valueNum
      };

      const updatedCrmData = {
        ...crmData,
        pagamentos: [...(crmData.pagamentos || []), newPayment]
      };

      await saveSupabaseCRMDatabase(updatedCrmData);
      setCrmData(updatedCrmData);
      
      // Reset state and close modal
      setSelectedPatientId('');
      setPaymentValue('');
      setPaymentDescription('');
      setPaymentMethod('PIX');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setIsModalOpen(false);
      alert('Pagamento registrado com sucesso!');
    } catch (error: any) {
      alert('Erro ao salvar pagamento: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const clean = isoString.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-[#8B0000] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">Carregando painel financeiro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E6DEC9] pb-5">
        <div>
          <span className="text-[10px] font-extrabold text-[#C09553] tracking-widest uppercase block mb-1">
            Módulo Financeiro Geral
          </span>
          <h1 className="text-2xl font-serif text-[#8B0000] font-bold leading-tight flex items-center gap-2">
            <Coins className="w-6 h-6 text-[#C09553]" />
            Controle de Faturamento e Orçamentos
          </h1>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            Acompanhe o faturamento total da clínica, audite as transações de pacientes e verifique orçamentos aprovados de forma centralizada.
          </p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#8B0000] hover:bg-[#6c1b26] text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 shrink-0 self-start sm:self-center"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Registrar Pagamento</span>
        </button>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total revenue card */}
        <div className="bg-emerald-50 border border-emerald-200/60 p-5 rounded-2xl shadow-xs text-left space-y-2">
          <span className="text-[10px] font-extrabold tracking-wider uppercase text-emerald-800 block">Faturamento Total</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-mono font-black text-emerald-950">{formatBRL(stats.totalRevenue)}</span>
          </div>
          <p className="text-[10px] text-emerald-600 font-medium">Soma de todos os pagamentos validados</p>
        </div>

        {/* Paid budgets card */}
        <div className="bg-amber-50 border border-amber-200/60 p-5 rounded-2xl shadow-xs text-left space-y-2">
          <span className="text-[10px] font-extrabold tracking-wider uppercase text-amber-800 block">Orçamentos Fechados</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-mono font-black text-amber-950">{formatBRL(stats.totalPaidBudgetsVal)}</span>
          </div>
          <p className="text-[10px] text-amber-600 font-medium">{stats.paidBudgetsCount} orçamentos aprovados/pagos</p>
        </div>

        {/* Outstanding budgets card */}
        <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl shadow-xs text-left space-y-2">
          <span className="text-[10px] font-extrabold tracking-wider uppercase text-zinc-500 block">Orçamentos em Aberto</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-mono font-black text-zinc-800">{formatBRL(stats.totalOpenBudgetsVal)}</span>
          </div>
          <p className="text-[10px] text-zinc-400 font-medium">{stats.openBudgetsCount} em negociação ou andamento</p>
        </div>

        {/* Payment Methods sum breakdown */}
        <div className="bg-white border border-[#E6DEC9] p-5 rounded-2xl shadow-xs text-left space-y-2">
          <span className="text-[10px] font-extrabold tracking-wider uppercase text-[#B48C4D] block">Faturamento por Método</span>
          <div className="space-y-1 text-[10px] font-mono font-bold text-zinc-600">
            <div className="flex justify-between"><span>PIX:</span><span className="text-zinc-800">{formatBRL(stats.methodSums.PIX)}</span></div>
            <div className="flex justify-between"><span>Cartão:</span><span className="text-zinc-800">{formatBRL(stats.methodSums['Cartão de Crédito'] + stats.methodSums['Cartão de Débito'])}</span></div>
            <div className="flex justify-between"><span>Dinheiro:</span><span className="text-zinc-800">{formatBRL(stats.methodSums.Dinheiro)}</span></div>
          </div>
        </div>
      </div>

      {/* FILTER & TAB BAR PANEL */}
      <div className="bg-white border border-[#E6DEC9] rounded-2xl shadow-xs overflow-hidden">
        <div className="border-b border-[#E6DEC9] bg-[#FAF8F5] px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs switch */}
          <div className="flex bg-zinc-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'payments' 
                  ? 'bg-[#8B0000] text-white shadow-xs' 
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Histórico de Pagamentos ({filteredPayments.length})
            </button>
            <button
              onClick={() => setActiveTab('budgets')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'budgets' 
                  ? 'bg-[#8B0000] text-white shadow-xs' 
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Orçamentos Integrados ({filteredBudgets.length})
            </button>
          </div>

          {/* Filtering inputs */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar paciente ou item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 text-xs bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#8B0000] w-48 font-medium text-zinc-700"
              />
            </div>

            {/* Payment Method filter */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Filter className="w-3.5 h-3.5" />
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="border border-zinc-300 bg-white rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none"
              >
                <option value="ALL">Todos os Métodos</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="PIX">PIX</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
              </select>
            </div>

            {/* Status Filter (Budgets Tab only) */}
            {activeTab === 'budgets' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-zinc-300 bg-white rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none"
              >
                <option value="ALL">Todos os Status</option>
                <option value="Aberto (paciente não pagou)">Aberto</option>
                <option value="Aprovado (paciente pagou)">Aprovado (Pago)</option>
                <option value="Aguardando Aprovação">Aguardando</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluído">Concluído</option>
                <option value="Arquivado">Arquivado</option>
              </select>
            )}
          </div>
        </div>

        {/* TABLES LIST VIEW */}
        <div className="p-0">
          {activeTab === 'payments' ? (
            /* Tab 1: Payments List */
            filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 italic text-xs">
                Nenhum pagamento correspondente aos filtros foi encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-150 text-zinc-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-3 px-5">Data do Movimento</th>
                      <th className="py-3 px-5">Paciente</th>
                      <th className="py-3 px-5">Forma de Pagamento</th>
                      <th className="py-3 px-5">Descrição</th>
                      <th className="py-3 px-5 text-right">Valor Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {filteredPayments.map((pay) => {
                      const patient = patientsMap.get(pay.patientId);
                      return (
                        <tr key={pay.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="py-3 px-5 font-mono">{formatDate(pay.date)}</td>
                          <td className="py-3 px-5 font-bold text-zinc-900">{patient?.name || 'Paciente Indefinido'}</td>
                          <td className="py-3 px-5">
                            <span className="px-2 py-0.5 bg-zinc-100 rounded text-[9px] font-mono font-bold uppercase text-zinc-700">
                              {pay.method || 'PIX'}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-zinc-500">{pay.description}</td>
                          <td className="py-3 px-5 font-mono text-zinc-900 font-bold text-right">
                            {formatBRL(parseValue(pay.value))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* Tab 2: Budgets List */
            filteredBudgets.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 italic text-xs">
                Nenhum orçamento correspondente aos filtros foi encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-150 text-zinc-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-3 px-5">Data Criação</th>
                      <th className="py-3 px-5">Paciente</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5">Forma Pagt. Selecionada</th>
                      <th className="py-3 px-5 text-right">Valor do Orçamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {filteredBudgets.map((t) => {
                      const patient = patientsMap.get(t.patientId);
                      const status = t.proposal?.status || 'Aberto (paciente não pagou)';
                      const isPaid = status === 'Aprovado (paciente pagou)';
                      
                      return (
                        <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="py-3 px-5 font-mono">{formatDate(t.date)}</td>
                          <td className="py-3 px-5 font-bold text-zinc-900">{patient?.name || t.proposal?.patientName || 'Paciente Indefinido'}</td>
                          <td className="py-3 px-5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                              isPaid
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-amber-50 border-amber-200 text-amber-800'
                            }`}>
                              {isPaid ? 'Aprovado / Pago' : 'Pendente / Aberto'}
                            </span>
                          </td>
                          <td className="py-3 px-5">
                            {t.proposal?.paymentMethod ? (
                              <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E6DEC9] rounded text-[9px] font-mono font-bold text-[#8B0000] uppercase">
                                {t.proposal.paymentMethod}
                              </span>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">Não Informado</span>
                            )}
                          </td>
                          <td className="py-3 px-5 font-mono text-[#8B0000] font-bold text-right">
                            {formatBRL(t.proposal?.totalValue || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* REGISTRY MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
          <div className="bg-white border-2 border-[#C09553] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative text-left">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#8B0000] to-[#2D060B] text-white p-5 flex justify-between items-center border-b border-[#C09553]/30">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#C09553]" />
                <h3 className="font-serif font-bold text-sm tracking-wide uppercase text-white">Registrar Pagamento Manual</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              {/* Patient Selection Dropdown */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Paciente *</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  required
                  className="w-full border border-[#D5CBB3] bg-[#FAF8F5] rounded-xl p-2.5 text-xs text-zinc-700 font-semibold focus:outline-none focus:border-[#8B0000]"
                >
                  <option value="">Selecione o Paciente...</option>
                  {(crmData?.patients || []).map((p: Patient) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Description field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Descrição *</label>
                <input
                  type="text"
                  placeholder="Ex: Manutenção de Aparelho, Canal Dente 12..."
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  required
                  className="w-full border border-[#D5CBB3] bg-[#FAF8F5] rounded-xl p-2.5 text-xs text-zinc-800 font-medium focus:outline-none focus:border-[#8B0000]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Value field */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Valor R$ *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={paymentValue}
                    onChange={(e) => setPaymentValue(e.target.value)}
                    required
                    className="w-full border border-[#D5CBB3] bg-[#FAF8F5] rounded-xl p-2.5 text-xs text-zinc-800 font-bold focus:outline-none focus:border-[#8B0000]"
                  />
                </div>

                {/* Date field */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Data do Movimento *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full border border-[#D5CBB3] bg-[#FAF8F5] rounded-xl p-2.5 text-xs text-zinc-800 font-medium focus:outline-none focus:border-[#8B0000]"
                  />
                </div>
              </div>

              {/* Payment Method field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Forma de Pagamento *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  required
                  className="w-full border border-[#D5CBB3] bg-[#FAF8F5] rounded-xl p-2.5 text-xs text-zinc-700 font-semibold focus:outline-none focus:border-[#8B0000]"
                >
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                </select>
              </div>

              {/* Alert Note */}
              <div className="bg-[#FAF8F5] border border-[#E6DEC9] p-3.5 rounded-xl flex items-start gap-2.5 text-[10.5px] text-zinc-500 leading-normal">
                <AlertCircle className="w-4 h-4 text-[#C09553] flex-shrink-0 mt-0.5" />
                <p>
                  Ao confirmar, os dados deste pagamento serão consolidados no banco de dados e sincronizados no CRM integrado do paciente.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-150">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#8B0000] hover:bg-[#6c1b26] disabled:bg-zinc-400 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {submitting ? 'Salvando...' : 'Confirmar Faturamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
