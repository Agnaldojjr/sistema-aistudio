import React, { useState } from 'react';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { Sparkles, Send, Brain, RefreshCw, AlertCircle } from 'lucide-react';

export function AIAssistancePanel() {
  const { updateToothCondition, updateToothSurfaceCondition, addProcedure } = usePlanning3D();

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const PRESETS = [
    "Paciente tem cárie oclusal no 16 e fratura na distal do dente 23",
    "Precisa de implante no dente 46 por ausência coronária e tratamento de canal no 11",
    "Realizar faceta de porcelana no dente 21 e restauração vestibular no dente 12",
  ];

  const handleProcessIA = async () => {
    if (!notes.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessCount(null);

    try {
      const response = await fetch('/api/ai/suggest-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error('Falha ao processar sugestão clínica da IA.');
      }

      const data = await response.json();

      if (data && data.teeth && Array.isArray(data.teeth)) {
        data.teeth.forEach((t: any) => {
          // 1. Atualiza condição básica do dente
          updateToothCondition(t.tooth, t.condition, t.notes || '');

          // 2. Atualiza superfícies específicas, se informadas
          if (t.surfaces && t.surfaces.length > 0) {
            t.surfaces.forEach((s: any) => {
              updateToothSurfaceCondition(t.tooth, s, t.condition);
            });
          }

          // 3. Adiciona os procedimentos sugeridos
          if (t.procedures && Array.isArray(t.procedures)) {
            t.procedures.forEach((p: any) => {
              addProcedure(t.tooth, p.name, p.price);
            });
          }
        });

        setSuccessCount(data.teeth.length);
        setNotes('');
      } else {
        throw new Error('Nenhum dente ou tratamento identificado no texto.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro de rede ou faturamento excedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-white">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider text-xs border-b border-slate-800 pb-3">
        <Brain className="w-4 h-4" />
        <span>Assistente de IA Integrado</span>
      </div>

      {/* Caixa de Texto */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-slate-400 font-bold uppercase block">Relato Clínico em Texto Livre:</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Descreva as patologias, dentes e tratamentos sugeridos..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
          rows={4}
          disabled={loading}
        />
      </div>

      {/* Sugestões/Presets rápidos */}
      <div>
        <p className="text-[9px] text-slate-500 font-bold uppercase mb-2">Exemplos de Sugestões:</p>
        <div className="flex flex-col gap-1.5">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => setNotes(preset)}
              disabled={loading}
              className="w-full text-left p-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-300 text-[10px] rounded-lg transition-colors truncate"
            >
              "{preset}"
            </button>
          ))}
        </div>
      </div>

      {/* Alertas / Mensagens de Status */}
      {error && (
        <div className="p-3 bg-red-950/40 border border-red-900 text-red-400 text-xs rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successCount !== null && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-900 text-emerald-400 text-xs rounded-xl flex items-start gap-2">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Sucesso! O odontograma foi atualizado com {successCount} diagnóstico(s) pela IA.</span>
        </div>
      )}

      {/* Botão de Envio */}
      <button
        onClick={handleProcessIA}
        disabled={loading || !notes.trim()}
        className="w-full py-3 bg-sky-600 border border-sky-500 hover:bg-sky-500 disabled:bg-slate-800 disabled:border-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Processando Plano...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>Analisar Prontuário com IA</span>
          </>
        )}
      </button>
    </div>
  );
}
