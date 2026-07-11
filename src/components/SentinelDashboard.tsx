import React, { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, RefreshCw, Code, Terminal, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface SentinelReport {
  id: string;
  timestamp: string;
  message: string;
  stack: string;
  url: string;
  userAgent: string;
  file?: string;
  line?: number;
  diagnosis?: string;
  proposedFix?: string;
  status: 'pending' | 'applied' | 'rejected';
}

export default function SentinelDashboard() {
  const [reports, setReports] = useState<SentinelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'applied'>('all');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sentinel/reports');
      const data = await res.json();
      setReports(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleApplyFix = async (reportId: string) => {
    if (!window.confirm("Deseja realmente aplicar esta correção automática e enviar para o GitHub? O arquivo original será modificado e um backup (.bak) será criado.")) return;
    setApplyingId(reportId);
    try {
      const res = await fetch('/api/sentinel/apply-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId })
      });
      const data = await res.json();
      if (data.success) {
        alert("Correção aplicada com sucesso! O código foi atualizado e enviado ao GitHub.");
        fetchReports();
      } else {
        alert("Erro ao aplicar correção: " + data.error);
      }
    } catch (e: any) {
      alert("Erro de rede ao aplicar correção: " + e.message);
    } finally {
      setApplyingId(null);
    }
  };

  const filteredReports = reports.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-zinc-800 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C09553]/20 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#8B0000] text-white rounded-xl shadow-lg">
              <Shield className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#8B0000]">Agente Sentinela 24h</h1>
              <p className="text-xs text-zinc-500">Monitoramento ativo, diagnósticos de IA e correções 1-click</p>
            </div>
          </div>

          <button 
            onClick={fetchReports}
            className="p-2 bg-white border-2 border-[#C09553]/20 text-[#8B0000] rounded-lg hover:border-[#C09553] transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Recarregar
          </button>
        </div>

        {/* Filters and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-400">Total Detectado</p>
              <h3 className="text-2xl font-bold mt-1 text-zinc-700">{reports.length}</h3>
            </div>
            <AlertTriangle className="w-8 h-8 text-amber-500 opacity-80" />
          </div>

          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-400">Pendentes</p>
              <h3 className="text-2xl font-bold mt-1 text-[#8B0000]">{reports.filter(r => r.status === 'pending').length}</h3>
            </div>
            <Clock className="w-8 h-8 text-[#8B0000] opacity-80" />
          </div>

          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-400">Corrigidos</p>
              <h3 className="text-2xl font-bold mt-1 text-green-600">{reports.filter(r => r.status === 'applied').length}</h3>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600 opacity-80" />
          </div>

          {/* Filter buttons */}
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex items-center gap-2">
            <button 
              onClick={() => setFilterStatus('all')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filterStatus === 'all' ? 'bg-[#8B0000] text-white shadow' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilterStatus('pending')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filterStatus === 'pending' ? 'bg-[#8B0000] text-white shadow' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
            >
              Pendente
            </button>
            <button 
              onClick={() => setFilterStatus('applied')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filterStatus === 'applied' ? 'bg-[#8B0000] text-white shadow' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
            >
              Aplicados
            </button>
          </div>
        </div>

        {/* Reports List */}
        {loading && reports.length === 0 ? (
          <div className="text-center py-16 bg-white border rounded-2xl shadow-sm">
            <RefreshCw className="w-8 h-8 animate-spin text-[#C09553] mx-auto mb-2" />
            <p className="text-xs text-zinc-500 font-mono">Buscando logs de erros da Sentinela...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-16 bg-white border rounded-2xl shadow-sm">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 font-bold">Nenhum erro encontrado.</p>
            <p className="text-[10px] text-zinc-400 mt-1">O Sentinela está ativo de prontidão para registrar falhas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const isExpanded = expandedId === report.id;
              return (
                <div 
                  key={report.id}
                  className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${isExpanded ? 'ring-2 ring-[#C09553]/30 border-[#C09553]/50' : 'hover:border-zinc-300'}`}
                >
                  {/* Card Header Info */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : report.id)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${report.status === 'applied' ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600'}`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-800 break-all">{report.message}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-zinc-500 font-mono">
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(report.timestamp).toLocaleString()}
                          </span>
                          {report.file && (
                            <span className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                              {report.file}:{report.line}
                            </span>
                          )}
                          <span className="capitalize">{report.status}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                    </div>
                  </div>

                  {/* Expanded Body Details */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 bg-[#FAF8F5]/50 p-4 space-y-4 text-xs">
                      
                      {/* Stack Trace */}
                      <div className="space-y-1.5">
                        <h5 className="font-bold text-zinc-700 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                          Pilha do Erro (Stack Trace)
                        </h5>
                        <pre className="p-3 bg-zinc-900 text-zinc-300 rounded-xl font-mono text-[10px] overflow-x-auto max-h-48 whitespace-pre-wrap">
                          {report.stack || "Nenhum rastreamento de pilha disponível."}
                        </pre>
                      </div>

                      {/* Gemini Diagnosis */}
                      {report.diagnosis && (
                        <div className="bg-white border p-4 rounded-xl space-y-2">
                          <h5 className="font-bold text-[#8B0000] flex items-center gap-1.5">
                            <Code className="w-3.5 h-3.5" />
                            Diagnóstico do Gemini AI
                          </h5>
                          <p className="text-zinc-600 whitespace-pre-wrap leading-relaxed">{report.diagnosis}</p>
                        </div>
                      )}

                      {/* Action proposal panel */}
                      {report.proposedFix && report.status === 'pending' && (
                        <div className="bg-amber-50/50 border border-amber-200/50 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div>
                            <h5 className="font-bold text-amber-800 flex items-center gap-1.5">
                              <Code className="w-3.5 h-3.5" />
                              Correção Proposta Disponível
                            </h5>
                            <p className="text-[10px] text-amber-700 mt-1">A IA reescreveu o arquivo de forma inteligente para sanar a causa raiz.</p>
                          </div>
                          
                          <button
                            disabled={applyingId !== null}
                            onClick={() => handleApplyFix(report.id)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {applyingId === report.id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Aplicando...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Aplicar Correção (1-Click)
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {report.status === 'applied' && (
                        <div className="bg-green-50 border border-green-200 p-3.5 rounded-xl flex items-center gap-2 text-green-800 font-bold">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Esta correção já foi aplicada e o patch enviado ao GitHub.</span>
                        </div>
                      )}

                      {/* Request Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-zinc-500 font-mono pt-2">
                        <div><strong>URL:</strong> {report.url}</div>
                        <div><strong>Browser:</strong> {report.userAgent}</div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
