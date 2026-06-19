import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { CheckCircle2, AlertCircle, RefreshCw, Sparkles, Send } from 'lucide-react';

const AFLogoSVG = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 28 88 L 48 30" stroke="#8B0000" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 48 30 L 68 88" stroke="#8B0000" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 36 62 L 60 62" stroke="#8B0000" strokeWidth="7" strokeLinecap="round" />
    <path d="M 48 30 L 82 30" stroke="#8B0000" strokeWidth="7" strokeLinecap="round" />
    <path d="M 58 50 L 76 50" stroke="#8B0000" strokeWidth="7" strokeLinecap="round" />
    <path d="M 26 72 Q 48 98 70 72" stroke="#C09553" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export default function PatientAnamnesisForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('patientId') || '';
  const patientName = urlParams.get('patientName') || '';

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Questions state
  const [q1, setQ1] = useState({ active: false, details: '' });
  const [q2, setQ2] = useState({ active: false, details: '' });
  const [q3, setQ3] = useState({ active: false, details: '' });
  const [q4, setQ4] = useState({ active: false, details: '' });
  const [q5, setQ5] = useState({ active: false, details: '' });
  const [q6, setQ6] = useState({ active: false, details: '' });
  const [q7, setQ7] = useState({ active: false, details: '' });
  const [q8, setQ8] = useState(''); // Textarea for general observations

  // Signature Canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set fixed resolution inside canvas
      canvas.width = canvas.offsetWidth || 500;
      canvas.height = 150;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [formSubmitted]);

  // Touch & Mouse Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2C0A0E'; // Dark burgundy ink

    const rect = canvas.getBoundingClientRect();
    let x = 0; let y = 0;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x = 0; let y = 0;
    if ('touches' in e) {
      if (e.cancelable) e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      setErrorMessage("Identificação do paciente ausente na URL. Por favor, solicite um novo link.");
      return;
    }

    if (!hasSigned) {
      setErrorMessage("Por favor, assine a ficha no campo de assinatura eletrônica antes de enviar.");
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      // Ensure anonymous authentication for public access
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (authErr: any) {
          console.warn('Anonymous auth failed, attempting direct write:', authErr);
          // Continue anyway — Firestore rules may allow unauthenticated writes
        }
      }

      const canvas = canvasRef.current;
      const signatureBase64 = canvas ? canvas.toDataURL('image/png') : '';

      // Structure answers
      const questions = [
        { question: "Está sob tratamento médico no momento?", answer: q1.active ? `Sim (${q1.details})` : "Não" },
        { question: "Toma algum medicamento de uso contínuo?", answer: q2.active ? `Sim (${q2.details})` : "Não" },
        { question: "Tem alguma alergia (penicilina, anestésicos, látex, alimentos, etc.)?", answer: q3.active ? `Sim (${q3.details})` : "Não" },
        { question: "Sofre de pressão alta, diabetes, asma ou problemas no coração/rins?", answer: q4.active ? `Sim (${q4.details})` : "Não" },
        { question: "Tem sangramentos excessivos ou dificuldade de cicatrização?", answer: q5.active ? `Sim (${q5.details})` : "Não" },
        { question: "Se for mulher: Está grávida ou amamentando?", answer: q6.active ? `Sim (${q6.details})` : "Não" },
        { question: "Já teve alguma complicação com anestesia dentária anterior?", answer: q7.active ? `Sim (${q7.details})` : "Não" },
        { question: "Outras observações importantes sobre sua saúde?", answer: q8.trim() !== '' ? q8 : "Nenhuma" }
      ];

      // Save document to public collection
      await addDoc(collection(db, "public_anamnesis"), {
        patientId,
        patientName,
        date: new Date().toISOString().split('T')[0],
        questions,
        signature: signatureBase64,
        synced: false,
        submittedAt: new Date().toISOString()
      });

      setFormSubmitted(true);
    } catch (err: any) {
      console.error('Anamnesis submit error:', err);
      const code = err?.code || '';
      if (code.includes('permission-denied') || code.includes('PERMISSION_DENIED')) {
        setErrorMessage('Erro de permissão: As regras de segurança do Firestore precisam permitir escrita na coleção "public_anamnesis". Entre em contato com a clínica.');
      } else if (code.includes('unavailable') || code.includes('network')) {
        setErrorMessage('Sem conexão com a internet. Verifique sua rede e tente novamente.');
      } else {
        setErrorMessage(`Falha ao enviar dados de anamnese: ${err.message || err}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (formSubmitted) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] py-12 px-4 flex items-center justify-center font-sans">
        <div className="max-w-md w-full bg-white border border-[#E6DEC9] rounded-3xl p-8 text-center shadow-xl space-y-6">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-[#8B0000] font-serif font-bold text-xl uppercase tracking-wide">Ficha Enviada!</h2>
            <p className="text-zinc-800 text-sm font-semibold">Obrigado, {patientName}.</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Suas respostas médicas de Anamnese e assinatura digital foram recebidas com segurança pela clínica. Suas informações serão consolidadas pelo Dr. Agnaldo Ferreira.
            </p>
          </div>
          <div className="pt-4 border-t border-zinc-100">
            <p className="text-[10px] text-zinc-400 font-mono">Você já pode fechar esta aba no seu celular ou navegador.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 px-4 font-sans text-left">
      <div className="max-w-xl mx-auto bg-white border border-[#E6DEC9] rounded-3xl overflow-hidden shadow-lg">
        {/* Brand Header */}
        <div className="bg-[#8B0000] text-white p-6 text-center border-b border-[#C09553]/30 relative">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
            <AFLogoSVG className="w-9 h-9" />
          </div>
          <h1 className="text-white text-lg font-bold font-serif uppercase tracking-tight">Dr. Agnaldo Ferreira</h1>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#C09553]">Odontologia Restauradora</p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-6 text-xs sm:text-sm">
          <div className="space-y-1.5 border-b border-zinc-100 pb-3">
            <h2 className="text-[#8B0000] font-serif font-bold text-base uppercase">Anamnese Odontológica Digital</h2>
            <p className="text-zinc-500 text-xs">
              Olá, <strong className="text-zinc-800">{patientName || 'Paciente'}</strong>! Por favor, responda com sinceridade ao questionário clínico abaixo e assine ao final para validação legal da sua consulta.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <span className="text-xs font-semibold leading-relaxed">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => { setErrorMessage(''); }}
                className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Fechar e Tentar Novamente
              </button>
            </div>
          )}

          <div className="space-y-4">
            
            {/* Pergunta 1 */}
            <div className="space-y-2 border-b border-zinc-100 pb-3">
              <span className="font-bold text-zinc-700 block leading-tight">1. Está sob tratamento médico no momento?</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q1" checked={q1.active} onChange={() => setQ1(prev => ({ ...prev, active: true }))} className="accent-[#8B0000]" />
                  <span>Sim</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q1" checked={!q1.active} onChange={() => setQ1(prev => ({ ...prev, active: false, details: '' }))} className="accent-[#8B0000]" />
                  <span>Não</span>
                </label>
              </div>
              {q1.active && (
                <input 
                  type="text" 
                  value={q1.details} 
                  onChange={e => setQ1(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Especifique o tratamento médico..." 
                  className="w-full border border-zinc-300 rounded p-2 text-xs focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] outline-none animate-fade-in"
                  required
                />
              )}
            </div>

            {/* Pergunta 2 */}
            <div className="space-y-2 border-b border-zinc-100 pb-3">
              <span className="font-bold text-zinc-700 block leading-tight">2. Toma algum medicamento de uso contínuo?</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q2" checked={q2.active} onChange={() => setQ2(prev => ({ ...prev, active: true }))} className="accent-[#8B0000]" />
                  <span>Sim</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q2" checked={!q2.active} onChange={() => setQ2(prev => ({ ...prev, active: false, details: '' }))} className="accent-[#8B0000]" />
                  <span>Não</span>
                </label>
              </div>
              {q2.active && (
                <input 
                  type="text" 
                  value={q2.details} 
                  onChange={e => setQ2(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Quais medicamentos?" 
                  className="w-full border border-zinc-300 rounded p-2 text-xs focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] outline-none animate-fade-in"
                  required
                />
              )}
            </div>

            {/* Pergunta 3 */}
            <div className="space-y-2 border-b border-zinc-100 pb-3">
              <span className="font-bold text-zinc-700 block leading-tight">3. Tem alguma alergia (penicilina, anestésicos, látex, alimentos, etc.)?</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q3" checked={q3.active} onChange={() => setQ3(prev => ({ ...prev, active: true }))} className="accent-[#8B0000]" />
                  <span>Sim</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q3" checked={!q3.active} onChange={() => setQ3(prev => ({ ...prev, active: false, details: '' }))} className="accent-[#8B0000]" />
                  <span>Não</span>
                </label>
              </div>
              {q3.active && (
                <input 
                  type="text" 
                  value={q3.details} 
                  onChange={e => setQ3(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Quais substâncias causam alergia?" 
                  className="w-full border border-zinc-300 rounded p-2 text-xs focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] outline-none animate-fade-in"
                  required
                />
              )}
            </div>

            {/* Pergunta 4 */}
            <div className="space-y-2 border-b border-zinc-100 pb-3">
              <span className="font-bold text-zinc-700 block leading-tight">4. Sofre de pressão alta, diabetes, asma ou problemas no coração/rins?</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q4" checked={q4.active} onChange={() => setQ4(prev => ({ ...prev, active: true }))} className="accent-[#8B0000]" />
                  <span>Sim</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q4" checked={!q4.active} onChange={() => setQ4(prev => ({ ...prev, active: false, details: '' }))} className="accent-[#8B0000]" />
                  <span>Não</span>
                </label>
              </div>
              {q4.active && (
                <input 
                  type="text" 
                  value={q4.details} 
                  onChange={e => setQ4(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Especifique a condição de saúde..." 
                  className="w-full border border-zinc-300 rounded p-2 text-xs focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] outline-none animate-fade-in"
                  required
                />
              )}
            </div>

            {/* Pergunta 5 */}
            <div className="space-y-2 border-b border-zinc-100 pb-3">
              <span className="font-bold text-zinc-700 block leading-tight">5. Tem sangramentos excessivos ou dificuldade de cicatrização?</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q5" checked={q5.active} onChange={() => setQ5(prev => ({ ...prev, active: true }))} className="accent-[#8B0000]" />
                  <span>Sim</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q5" checked={!q5.active} onChange={() => setQ5(prev => ({ ...prev, active: false, details: '' }))} className="accent-[#8B0000]" />
                  <span>Não</span>
                </label>
              </div>
              {q5.active && (
                <input 
                  type="text" 
                  value={q5.details} 
                  onChange={e => setQ5(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Especifique (ex: hemofilia, uso de anticoagulantes)..." 
                  className="w-full border border-zinc-300 rounded p-2 text-xs focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] outline-none animate-fade-in"
                  required
                />
              )}
            </div>

            {/* Pergunta 6 */}
            <div className="space-y-2 border-b border-zinc-100 pb-3">
              <span className="font-bold text-zinc-700 block leading-tight">6. Se for mulher: Está grávida ou amamentando?</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q6" checked={q6.active} onChange={() => setQ6(prev => ({ ...prev, active: true }))} className="accent-[#8B0000]" />
                  <span>Sim</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q6" checked={!q6.active} onChange={() => setQ6(prev => ({ ...prev, active: false, details: '' }))} className="accent-[#8B0000]" />
                  <span>Não</span>
                </label>
              </div>
              {q6.active && (
                <input 
                  type="text" 
                  value={q6.details} 
                  onChange={e => setQ6(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Quantos meses de gestação?" 
                  className="w-full border border-zinc-300 rounded p-2 text-xs focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] outline-none animate-fade-in"
                  required
                />
              )}
            </div>

            {/* Pergunta 7 */}
            <div className="space-y-2 border-b border-zinc-100 pb-3">
              <span className="font-bold text-zinc-700 block leading-tight">7. Já teve alguma complicação com anestesia dentária anterior?</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q7" checked={q7.active} onChange={() => setQ7(prev => ({ ...prev, active: true }))} className="accent-[#8B0000]" />
                  <span>Sim</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                  <input type="radio" name="q7" checked={!q7.active} onChange={() => setQ7(prev => ({ ...prev, active: false, details: '' }))} className="accent-[#8B0000]" />
                  <span>Não</span>
                </label>
              </div>
              {q7.active && (
                <input 
                  type="text" 
                  value={q7.details} 
                  onChange={e => setQ7(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Explique o que ocorreu..." 
                  className="w-full border border-zinc-300 rounded p-2 text-xs focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] outline-none animate-fade-in"
                  required
                />
              )}
            </div>

            {/* Pergunta 8 */}
            <div className="space-y-2">
              <span className="font-bold text-zinc-700 block leading-tight">8. Outras observações importantes sobre sua saúde?</span>
              <textarea 
                rows={3} 
                value={q8} 
                onChange={e => setQ8(e.target.value)} 
                placeholder="Descreva alergias a medicamentos específicos, cirurgias recentes, ou qualquer detalhe relevante sobre sua saúde..."
                className="w-full border border-zinc-300 rounded p-2.5 text-xs focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] outline-none resize-none font-sans"
              />
            </div>
            
          </div>

          {/* Electronic Signature */}
          <div className="space-y-3 bg-[#FAF8F5] border border-[#E6DEC9] p-4 rounded-2xl">
            <div>
              <span className="font-bold text-zinc-800 text-xs block">Assinatura Eletrônica Obrigatória</span>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-normal">
                Desenhe sua assinatura com o dedo (no celular) ou cursor (no computador) no quadro branco abaixo.
              </p>
            </div>
            
            <div className="relative border border-zinc-300 rounded-xl overflow-hidden bg-white shadow-inner">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-[150px] cursor-crosshair block bg-white touch-none"
              />
              <button
                type="button"
                onClick={clearCanvas}
                className="absolute bottom-2 right-2 px-2.5 py-1.5 bg-zinc-150 hover:bg-zinc-200 border border-zinc-300 text-zinc-700 font-bold text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Limpar Campo
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#8B0000] hover:bg-[#6c1b26] disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enviando Respostas...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#C09553]" />
                  <span>Enviar Ficha e Assinar Digitalmente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
