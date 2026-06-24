import React, { useState, useEffect } from 'react';
import { Phone, MessageCircle, Loader2, Zap } from 'lucide-react';

interface AIAssistedWhatsAppProps {
  patientName: string;
  patientPhone: string;
}

export function AIAssistedWhatsApp({ patientName, patientPhone }: AIAssistedWhatsAppProps) {
  const [whatsappNumber, setWhatsappNumber] = useState(patientPhone || '');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('lembrete');
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);

  useEffect(() => {
    if (patientPhone) setWhatsappNumber(patientPhone);
  }, [patientPhone]);

  useEffect(() => {
    let base = `Olá ${patientName.split(' ')[0]}, tudo bem? Aqui é do consultório do Dr. Agnaldo. `;
    if (selectedTemplate === 'lembrete') {
      setWhatsappMessage(base + `Passando para lembrar da sua consulta amanhã. Podemos confirmar?`);
    } else if (selectedTemplate === 'aniversario') {
      setWhatsappMessage(`Parabéns ${patientName.split(' ')[0]}! 🎉 Que o seu dia seja cheio de sorrisos. Um abraço de toda a equipe do Dr. Agnaldo!`);
    } else if (selectedTemplate === 'profilaxia') {
      setWhatsappMessage(base + `Já faz um tempinho desde sua última limpeza (profilaxia). Que tal agendarmos uma revisão para manter seu sorriso sempre saudável?`);
    } else if (selectedTemplate === 'feriado') {
      setWhatsappMessage(base + `Desejamos a você e sua família excelentes festas e um próspero ano novo! ✨`);
    }
  }, [selectedTemplate, patientName]);

  const handleGenerateMessageWithAI = async () => {
    try {
      setIsGeneratingMessage(true);
      const response = await fetch('/api/ai/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: patientName,
          doctorName: 'Dr. Agnaldo',
          lastProcedure: 'Avaliação/Profilaxia',
          lastVisitDate: 'há 6 meses'
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.message) {
          setWhatsappMessage(data.message);
        }
      } else {
        alert("Erro na API da IA. Verifique as configurações de chave no backend.");
      }
    } catch (err: any) {
      alert("Falha ao contatar servidor de IA: " + err.message);
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const handleSend = () => {
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const finalNum = (cleanNumber.length === 10 || cleanNumber.length === 11) ? '55' + cleanNumber : cleanNumber;
    const encodedMessage = encodeURIComponent(whatsappMessage);
    const url = finalNum ? `https://wa.me/${finalNum}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white border rounded-xl p-5 border-[#E6DEC9] shadow-2xs space-y-5">
      <div className="border-b border-zinc-100 pb-3">
        <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">COMUNICAÇÃO E WHATSAPP</span>
        <h4 className="font-serif font-bold text-lg text-[#8B0000]">Envio Rápido de Mensagens</h4>
        <p className="text-xs text-zinc-500 mt-1">Utilize a Inteligência Artificial para redigir lembretes amigáveis ou use os templates rápidos abaixo.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setSelectedTemplate('lembrete')}
          className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
            selectedTemplate === 'lembrete'
              ? 'bg-[#8B0000] text-white border-[#8B0000]'
              : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          📅 Lembrete de Consulta
        </button>
        <button
          type="button"
          onClick={() => setSelectedTemplate('aniversario')}
          className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
            selectedTemplate === 'aniversario'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          🎂 Parabéns/Aniversário
        </button>
        <button
          type="button"
          onClick={() => setSelectedTemplate('profilaxia')}
          className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
            selectedTemplate === 'profilaxia'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          🦷 Lembrete de Profilaxia (6 meses)
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase">Número do Celular</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Ex: 5511999999999"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 focus:border-green-500 focus:ring focus:ring-green-500/20 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase">Mensagem</label>
        <textarea
          value={whatsappMessage}
          onChange={(e) => setWhatsappMessage(e.target.value)}
          className="w-full p-3 rounded-xl border border-zinc-300 focus:border-green-500 focus:ring focus:ring-green-500/20 text-xs min-h-[100px] resize-y"
        />
      </div>

      <div className="flex justify-between items-center flex-wrap gap-3">
        <button
          type="button"
          onClick={handleGenerateMessageWithAI}
          disabled={isGeneratingMessage}
          className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 cursor-pointer text-xs disabled:opacity-50 shadow-sm"
        >
          {isGeneratingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          ✨ Gerar Mensagem de Retorno com IA
        </button>

        <button
          type="button"
          onClick={handleSend}
          className="w-full sm:w-auto px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm"
        >
          <MessageCircle className="w-4 h-4" />
          Enviar via WhatsApp Web
        </button>
      </div>
    </div>
  );
}
