import React, { useState, useEffect } from 'react';
import { Save, Settings, Sparkles, MessageSquare, CheckCircle, RotateCcw, Database } from 'lucide-react';
import { getGoogleDriveCRMDatabase } from '../lib/driveCrm';
import { saveSupabaseCRMDatabase } from '../lib/supabaseCrm';

interface SettingsViewProps {
  currentTheme: string;
  onChangeTheme: (theme: string) => void;
  clinicSettings?: any;
}

export default function SettingsView({ currentTheme, onChangeTheme, clinicSettings }: SettingsViewProps) {
  // Messages states
  const [templateConfirmacao, setTemplateConfirmacao] = useState('');
  const [templateAniversario, setTemplateAniversario] = useState('');
  const [templateProfilaxia, setTemplateProfilaxia] = useState('');
  const [templateFeriado, setTemplateFeriado] = useState('');
  
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Default Fallbacks
  const defaults = {
    confirmacao: `Olá, [NOME]! Gostaríamos de confirmar sua consulta com o Dr. Agnaldo Ferreira no dia [DATA] às [HORÁRIO]. Por favor, responda esta mensagem para confirmar. Qualquer dúvida, estamos à disposição!`,
    aniversario: `Olá, [NOME]! A equipe do Dr. Agnaldo Ferreira deseja a você um feliz aniversário! Que seu dia seja iluminado e repleto de sorrisos! 🎂✨`,
    profilaxia: `Olá, [NOME]! Faz 6 meses desde sua última profilaxia (limpeza) com o Dr. Agnaldo Ferreira. É hora de agendar sua revisão periódica para manter seu sorriso saudável! Vamos agendar? 🦷😊`,
    feriado: `Olá, [NOME]! Desejamos a você e sua família um Feliz Natal e um Próspero Ano Novo! Que o novo ano traga muitas alegrias, saúde e motivos para sorrir! 🎄🎉 - Dr. Agnaldo Ferreira`
  };

  useEffect(() => {
    // Load from localStorage
    setTemplateConfirmacao(localStorage.getItem('whatsapp_template_confirmacao') || defaults.confirmacao);
    setTemplateAniversario(localStorage.getItem('whatsapp_template_aniversario') || defaults.aniversario);
    setTemplateProfilaxia(localStorage.getItem('whatsapp_template_profilaxia') || defaults.profilaxia);
    setTemplateFeriado(localStorage.getItem('whatsapp_template_feriado') || defaults.feriado);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('whatsapp_template_confirmacao', templateConfirmacao);
    localStorage.setItem('whatsapp_template_aniversario', templateAniversario);
    localStorage.setItem('whatsapp_template_profilaxia', templateProfilaxia);
    localStorage.setItem('whatsapp_template_feriado', templateFeriado);
    
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const handleResetDefaults = () => {
    if (window.confirm("Deseja realmente restaurar os modelos padrão de fábrica?")) {
      setTemplateConfirmacao(defaults.confirmacao);
      setTemplateAniversario(defaults.aniversario);
      setTemplateProfilaxia(defaults.profilaxia);
      setTemplateFeriado(defaults.feriado);
      
      localStorage.setItem('whatsapp_template_confirmacao', defaults.confirmacao);
      localStorage.setItem('whatsapp_template_aniversario', defaults.aniversario);
      localStorage.setItem('whatsapp_template_profilaxia', defaults.profilaxia);
      localStorage.setItem('whatsapp_template_feriado', defaults.feriado);
      
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    }
  };

  const [isMigrating, setIsMigrating] = useState(false);
  const handleMigration = async () => {
    if (!window.confirm("Isso fará o download do banco de dados do Google Drive e substituirá os dados locais do Supabase. Deseja continuar?")) return;
    
    setIsMigrating(true);
    try {
      const data = await getGoogleDriveCRMDatabase();
      await saveSupabaseCRMDatabase(data);
      alert("Migração concluída com sucesso! Recarregue a página para ver os dados.");
    } catch (err: any) {
      alert("Erro na migração: " + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans text-xs sm:text-sm animate-fade-in-up">
      {showSavedToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-5 h-5" />
          <span className="font-bold">Configurações salvas com sucesso!</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 pb-4">
        <div className="w-10 h-10 rounded-full bg-[#8B0000]/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-[#8B0000]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#4E1119] font-serif uppercase tracking-tight">Configurações do Sistema</h2>
          <p className="text-xs text-zinc-500">Customize a identidade visual e os modelos de envio automático do app</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Section 1: Themes */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
            <Sparkles className="w-4 h-4 text-[#C09553]" />
            <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Tema Visual do Aplicativo</h3>
          </div>
          
          <div className="p-5 space-y-4">
            <p className="text-zinc-500 text-xs leading-relaxed">
              Altere a cor de fundo e contraste do sistema para sua preferência. Todas as opções mantêm a identidade corporativa do Dr. Agnaldo Ferreira com detalhes em ouro.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              {/* Theme standard */}
              <button
                type="button"
                onClick={() => onChangeTheme('padrao')}
                className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                  currentTheme === 'padrao'
                    ? 'border-[#C09553] bg-[#FAF8F5] ring-2 ring-[#C09553]/30 shadow-md'
                    : 'border-zinc-200 bg-white hover:border-[#8B0000]'
                }`}
              >
                <div className="w-full h-12 rounded-lg bg-[#FAF8F5] border border-zinc-200 flex overflow-hidden">
                  <div className="w-1/3 bg-[#8B0000]" />
                  <div className="w-2/3 bg-white p-1 flex flex-col justify-between">
                    <span className="w-full h-1 bg-zinc-200 rounded-xs" />
                    <span className="w-3 h-3 rounded-full bg-[#C09553] self-end" />
                  </div>
                </div>
                <div>
                  <span className="font-bold text-zinc-800 text-xs block">Padrão da Clínica</span>
                  <span className="text-[10px] text-zinc-400">Claro (Bordô & Creme)</span>
                </div>
              </button>

              {/* Theme Bordô Nobre */}
              <button
                type="button"
                onClick={() => onChangeTheme('bordo-nobre')}
                className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                  currentTheme === 'bordo-nobre'
                    ? 'border-[#C09553] bg-[#FAF3EA] ring-2 ring-[#C09553]/30 shadow-md'
                    : 'border-zinc-200 bg-white hover:border-[#8B0000]'
                }`}
              >
                <div className="w-full h-12 rounded-lg bg-[#3A0F15] border border-[#521D25] flex overflow-hidden">
                  <div className="w-1/3 bg-[#FAF3EA]" />
                  <div className="w-2/3 bg-[#3A0F15] p-1 flex flex-col justify-between">
                    <span className="w-full h-1 bg-[#FAF3EA]/40 rounded-xs" />
                    <span className="w-3 h-3 rounded-full bg-[#C09553] self-end" />
                  </div>
                </div>
                <div>
                  <span className="font-bold text-zinc-800 text-xs block">Bordô Nobre</span>
                  <span className="text-[10px] text-zinc-400">Fundo Bordô & Cards Bege</span>
                </div>
              </button>

              {/* Theme Bege Real */}
              <button
                type="button"
                onClick={() => onChangeTheme('bege-real')}
                className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                  currentTheme === 'bege-real'
                    ? 'border-[#C09553] bg-[#FAF8F5] ring-2 ring-[#C09553]/30 shadow-md'
                    : 'border-zinc-200 bg-white hover:border-[#8B0000]'
                }`}
              >
                <div className="w-full h-12 rounded-lg bg-[#E5DACB] border border-[#C09553] flex overflow-hidden">
                  <div className="w-1/3 bg-[#4A121A]" />
                  <div className="w-2/3 bg-[#FFFFFF] p-1 flex flex-col justify-between">
                    <span className="w-full h-1 bg-zinc-200 rounded-xs" />
                    <span className="w-3 h-3 rounded-full bg-[#C09553] self-end" />
                  </div>
                </div>
                <div>
                  <span className="font-bold text-zinc-800 text-xs block">Bege Real</span>
                  <span className="text-[10px] text-zinc-400">Fundo Bege & Cards Brancos</span>
                </div>
              </button>

              {/* Theme Bordô Imperial */}
              <button
                type="button"
                onClick={() => onChangeTheme('bordo-imperial')}
                className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                  currentTheme === 'bordo-imperial'
                    ? 'border-[#C09553] bg-[#FAF3EA] ring-2 ring-[#C09553]/30 shadow-md'
                    : 'border-zinc-200 bg-white hover:border-[#8B0000]'
                }`}
              >
                <div className="w-full h-12 rounded-lg bg-[#5C1D24] border border-[#732D35] flex overflow-hidden">
                  <div className="w-1/3 bg-[#EADFC9]" />
                  <div className="w-2/3 bg-[#5C1D24] p-1 flex flex-col justify-between">
                    <span className="w-full h-1 bg-[#FAF6EE]/40 rounded-xs" />
                    <span className="w-3 h-3 rounded-full bg-[#C09553] self-end" />
                  </div>
                </div>
                <div>
                  <span className="font-bold text-zinc-800 text-xs block">Bordô Imperial</span>
                  <span className="text-[10px] text-zinc-400">Fundo Bordô Médio & Cards Bege</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Messages Template */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
            <MessageSquare className="w-4 h-4 text-[#C09553]" />
            <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Modelos de Mensagem do WhatsApp</h3>
          </div>
          
          <div className="p-5 space-y-4 text-xs">
            <p className="text-zinc-500 leading-relaxed mb-2">
              Edite as mensagens que são enviadas automaticamente aos pacientes. Use a tag <strong className="text-zinc-800 font-mono">[NOME]</strong> para que o sistema a substitua automaticamente pelo nome real do paciente no momento do envio.
            </p>
            
            {/* 1. Confirmação de Consulta */}
            <div className="space-y-1.5">
              <label className="block text-zinc-700 font-bold uppercase tracking-wider text-[10px]">1. Confirmação de Consulta</label>
              <textarea
                rows={3}
                value={templateConfirmacao}
                onChange={(e) => setTemplateConfirmacao(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl p-3 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none resize-y text-xs font-sans leading-relaxed"
                placeholder="Escreva a mensagem..."
              />
            </div>

            {/* 2. Parabéns / Aniversário */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-zinc-700 font-bold uppercase tracking-wider text-[10px]">2. Mensagem de Aniversário (Parabéns)</label>
              <textarea
                rows={3}
                value={templateAniversario}
                onChange={(e) => setTemplateAniversario(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl p-3 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none resize-y text-xs font-sans leading-relaxed"
                placeholder="Escreva a mensagem..."
              />
            </div>

            {/* 3. Profilaxia (6 meses) */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-zinc-700 font-bold uppercase tracking-wider text-[10px]">3. Lembrete de Profilaxia (6 meses)</label>
              <textarea
                rows={3}
                value={templateProfilaxia}
                onChange={(e) => setTemplateProfilaxia(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl p-3 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none resize-y text-xs font-sans leading-relaxed"
                placeholder="Escreva a mensagem..."
              />
            </div>

            {/* 4. Feriados / Festas de Fim de Ano */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-zinc-700 font-bold uppercase tracking-wider text-[10px]">4. Feriados Festivos (Natal & Ano Novo)</label>
              <textarea
                rows={3}
                value={templateFeriado}
                onChange={(e) => setTemplateFeriado(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl p-3 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none resize-y text-xs font-sans leading-relaxed"
                placeholder="Escreva a mensagem..."
              />
            </div>
          </div>
        </div>


        {/* Section 3: Data Migration */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
            <Database className="w-4 h-4 text-[#C09553]" />
            <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Migração de Dados</h3>
          </div>
          
          <div className="p-5 space-y-4 text-xs">
            <p className="text-zinc-500 leading-relaxed mb-2">
              Utilize esta ferramenta para importar seu banco de dados antigo do Google Drive (JSON) para o novo banco de dados (Supabase Postgres).
            </p>
            <button
              type="button"
              disabled={isMigrating}
              onClick={handleMigration}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isMigrating ? "Migrando..." : "Migrar do Google Drive para Supabase"}
            </button>
          </div>
        </div>

        {/* Actions buttons */}
        <div className="flex items-center gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-zinc-600" />
            Restaurar Padrão
          </button>
          
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#4E1119] hover:bg-[#6c1b26] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#C09553]" />
            Salvar Configurações
          </button>
        </div>
      </form>
    </div>
  );
}
