import React, { useEffect } from 'react';
import { TreatmentProposal, PatientData, CRMPatient } from '../types';
import { User, HeartPulse, MapPin, Building2, Save, MessageCircle, Cake, Sparkles, CalendarClock, AlertCircle, Phone } from 'lucide-react';
import { usePatientContext } from '../context/PatientContext';

interface PatientRegistrationTabProps {
  proposal: TreatmentProposal;
  setProposal: React.Dispatch<React.SetStateAction<TreatmentProposal>>;
}

export default function PatientRegistrationTab({ proposal, setProposal }: PatientRegistrationTabProps) {
  const { selectedPatient, setSelectedPatient, saveContextToSupabase, isSavingToSupabase } = usePatientContext();
  
  // Use selectedPatient if available, otherwise fallback to proposal.patientData
  const pd: Partial<CRMPatient> = selectedPatient || proposal.patientData || {};

  const [whatsappMessage, setWhatsappMessage] = React.useState('');
  const [selectedTemplate, setSelectedTemplate] = React.useState('confirmacao');

  // Sync proposal.patientName if selectedPatient changes
  useEffect(() => {
    if (selectedPatient && selectedPatient.name !== proposal.patientName) {
      setProposal(prev => ({ ...prev, patientName: selectedPatient.name, patientData: selectedPatient }));
    }
  }, [selectedPatient, setProposal, proposal.patientName]);

  React.useEffect(() => {
    const name = proposal.patientName || 'Paciente';
    if (selectedTemplate === 'aniversario') {
      const saved = localStorage.getItem('whatsapp_template_aniversario');
      setWhatsappMessage(saved ? saved.replace('[NOME]', name) : `Olá, ${name}! A equipe do Dr. Agnaldo Ferreira deseja a você um feliz aniversário! Que seu dia seja iluminado e repleto de sorrisos! 🎂✨`);
    } else if (selectedTemplate === 'feriado') {
      const saved = localStorage.getItem('whatsapp_template_feriado');
      setWhatsappMessage(saved ? saved.replace('[NOME]', name) : `Olá, ${name}! Desejamos a você e sua família um Feliz Natal e um Próspero Ano Novo! Que o novo ano traga muitas alegrias, saúde e motivos para sorrir! 🎄🎉 - Dr. Agnaldo Ferreira`);
    } else if (selectedTemplate === 'profilaxia') {
      const saved = localStorage.getItem('whatsapp_template_profilaxia');
      setWhatsappMessage(saved ? saved.replace('[NOME]', name) : `Olá, ${name}! Faz 6 meses desde sua última profilaxia (limpeza) com o Dr. Agnaldo Ferreira. É hora de agendar sua revisão periódica para manter seu sorriso saudável! Vamos agendar? 🦷😊`);
    } else if (selectedTemplate === 'confirmacao') {
      const saved = localStorage.getItem('whatsapp_template_confirmacao');
      setWhatsappMessage(saved ? saved.replace('[NOME]', name) : `Olá, ${name}! Gostaríamos de confirmar sua consulta com o Dr. Agnaldo Ferreira no dia [DATA] às [HORÁRIO]. Por favor, responda esta mensagem para confirmar. Qualquer dúvida, estamos à disposição!`);
    }
  }, [selectedTemplate, proposal.patientName]);

  const isBirthdayToday = () => {
    const birthDate = pd.birthDate;
    if (!birthDate) return false;
    const parts = birthDate.split('-');
    if (parts.length !== 3) return false;
    const [year, month, day] = parts;
    const today = new Date();
    return today.getDate() === parseInt(day) && (today.getMonth() + 1) === parseInt(month);
  };

  const isProphylaxisDue = () => {
    const createdAt = pd.createdAt;
    if (!createdAt) return false;
    const createdDate = new Date(createdAt);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return createdDate < sixMonthsAgo;
  };

  const handleUpdate = (field: keyof CRMPatient, value: string) => {
    if (selectedPatient) {
      const updatedPatient = { ...selectedPatient, [field]: value };
      setSelectedPatient(updatedPatient);
      setProposal(prev => ({
        ...prev,
        patientData: updatedPatient
      }));
    } else {
      setProposal(prev => ({
        ...prev,
        patientData: {
          ...(prev.patientData || {}),
          [field]: value
        }
      }));
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value.toUpperCase();
    if (selectedPatient) {
      const updatedPatient = { ...selectedPatient, name: newName };
      setSelectedPatient(updatedPatient);
      setProposal(prev => ({ ...prev, patientName: newName, patientData: updatedPatient }));
    } else {
      setProposal(prev => ({ ...prev, patientName: newName }));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden font-sans">
      
      {/* 1. Dados Cadastrais */}
      <div className="border-b border-zinc-200">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#C09553]/30">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#C09553]" />
            <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Dados cadastrais</h3>
          </div>
          {selectedPatient && (
            <button
              type="button"
              onClick={saveContextToSupabase}
              disabled={isSavingToSupabase}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#C09553] hover:bg-[#A88248] text-white rounded-lg text-[11px] font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSavingToSupabase ? 'Salvando...' : 'Salvar no Supabase'}
            </button>
          )}
        </div>
        <div className="p-4 space-y-4 text-xs bg-[#FAF8F5]/30">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-zinc-500 font-semibold mb-1">Nome do paciente *</label>
              <input type="text" value={proposal.patientName} onChange={handleNameChange} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Nascimento</label>
              <input type="date" value={pd.birthDate || ''} onChange={e => handleUpdate('birthDate', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-zinc-500 font-semibold mb-1">Sexo</label>
                <select value={pd.gender || ''} onChange={e => handleUpdate('gender', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                  <option value=""></option>
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-500 font-semibold mb-1">Situação</label>
                <select value={pd.status || 'ATIVO'} onChange={e => handleUpdate('status', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                  <option value="ATIVO">ATIVO</option>
                  <option value="INATIVO">INATIVO</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Estado civil</label>
              <select value={pd.maritalStatus || ''} onChange={e => handleUpdate('maritalStatus', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                <option value=""></option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">CPF</label>
              <input type="text" placeholder="000.000.000-00" value={pd.cpf || ''} onChange={e => handleUpdate('cpf', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">RG</label>
              <input type="text" value={pd.rg || ''} onChange={e => handleUpdate('rg', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Órgão emissor/UF</label>
              <input type="text" value={pd.rgIssuer || ''} onChange={e => handleUpdate('rgIssuer', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Prontuário</label>
              <input type="text" value={pd.medicalRecord || ''} onChange={e => handleUpdate('medicalRecord', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Como conheceu a clínica?</label>
              <select value={pd.howKnewClinic || ''} onChange={e => handleUpdate('howKnewClinic', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                <option value="">Selecione</option>
                <option value="Indicação">Indicação</option>
                <option value="Redes Sociais">Redes Sociais</option>
                <option value="Google">Google</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Telefone</label>
              <input type="text" value={pd.phone || ''} onChange={e => handleUpdate('phone', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Celular</label>
              <input type="text" placeholder="(00) 00000-0000" value={pd.mobile || ''} onChange={e => handleUpdate('mobile', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-zinc-500 font-semibold mb-1">E-mail</label>
              <input type="email" value={pd.email || ''} onChange={e => handleUpdate('email', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-zinc-500 font-semibold mb-1">Observações</label>
            <textarea rows={3} value={pd.observations || ''} onChange={e => handleUpdate('observations', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none resize-y"></textarea>
          </div>

        </div>
      </div>

      {/* 2. Dados do Responsável */}
      <div className="border-b border-zinc-200">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
          <HeartPulse className="w-4 h-4 text-[#C09553]" />
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Dados do responsável</h3>
        </div>
        <div className="p-4 space-y-4 text-xs bg-[#FAF8F5]/30">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-zinc-500 font-semibold mb-1">Nome</label>
              <input type="text" value={pd.respName || ''} onChange={e => handleUpdate('respName', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Nascimento</label>
              <input type="date" value={pd.respBirthDate || ''} onChange={e => handleUpdate('respBirthDate', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Telefone</label>
              <input type="text" value={pd.respPhone || ''} onChange={e => handleUpdate('respPhone', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Celular</label>
              <input type="text" value={pd.respMobile || ''} onChange={e => handleUpdate('respMobile', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Estado civil</label>
              <select value={pd.respMaritalStatus || ''} onChange={e => handleUpdate('respMaritalStatus', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                <option value=""></option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">CPF</label>
              <input type="text" value={pd.respCpf || ''} onChange={e => handleUpdate('respCpf', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">RG</label>
              <input type="text" value={pd.respRg || ''} onChange={e => handleUpdate('respRg', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Órgão emissor/UF</label>
              <input type="text" value={pd.respRgIssuer || ''} onChange={e => handleUpdate('respRgIssuer', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Profissão</label>
              <input type="text" value={pd.respProfession || ''} onChange={e => handleUpdate('respProfession', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

        </div>
      </div>

      {/* 3. Endereço */}
      <div className="border-b border-zinc-200">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
          <MapPin className="w-4 h-4 text-[#C09553]" />
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Endereço</h3>
        </div>
        <div className="p-4 space-y-4 text-xs bg-[#FAF8F5]/30">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">CEP</label>
              <input type="text" value={pd.cep || ''} onChange={e => handleUpdate('cep', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-zinc-500 font-semibold mb-1">Logradouro</label>
              <input type="text" value={pd.street || ''} onChange={e => handleUpdate('street', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Número</label>
              <input type="text" value={pd.number || ''} onChange={e => handleUpdate('number', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-zinc-500 font-semibold mb-1">Complemento</label>
              <input type="text" value={pd.complement || ''} onChange={e => handleUpdate('complement', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-zinc-500 font-semibold mb-1">Bairro</label>
              <input type="text" value={pd.neighborhood || ''} onChange={e => handleUpdate('neighborhood', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Cidade</label>
              <input type="text" value={pd.city || ''} onChange={e => handleUpdate('city', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Estado</label>
              <input type="text" value={pd.state || ''} onChange={e => handleUpdate('state', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

        </div>
      </div>

      {/* 4. Convênio */}
      <div className="border-b border-zinc-200">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
          <Building2 className="w-4 h-4 text-[#C09553]" />
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Convênio</h3>
        </div>
        <div className="p-4 space-y-4 text-xs bg-[#FAF8F5]/30">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Convênio *</label>
              <select value={pd.healthInsurance || 'PARTICULAR'} onChange={e => handleUpdate('healthInsurance', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                <option value="PARTICULAR">PARTICULAR</option>
                <option value="BRADESCO">BRADESCO SAÚDE</option>
                <option value="SULAMERICA">SULAMÉRICA</option>
                <option value="AMIL">AMIL</option>
                <option value="UNIMED">UNIMED</option>
                <option value="OUTRO">OUTRO</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Carteira</label>
              <input type="text" value={pd.healthInsuranceCard || ''} onChange={e => handleUpdate('healthInsuranceCard', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Validade</label>
              <input type="text" placeholder="MM/AAAA" value={pd.healthInsuranceValidity || ''} onChange={e => handleUpdate('healthInsuranceValidity', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

        </div>
      </div>

      {/* 5. WhatsApp & Lembretes */}
      <div className="border-b border-zinc-200">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
          <MessageCircle className="w-4 h-4 text-[#C09553]" />
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase">WhatsApp & Lembretes</h3>
        </div>
        <div className="p-4 space-y-4 text-xs bg-[#FAF8F5]/30">
          
          {/* Smart Alerts */}
          {(isBirthdayToday() || isProphylaxisDue()) && (
            <div className="space-y-2">
              {isBirthdayToday() && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 flex items-start gap-2.5 shadow-sm">
                  <Cake className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Aniversariante do Dia!</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">Hoje é aniversário deste paciente. Aproveite para enviar os parabéns e estreitar o relacionamento!</p>
                  </div>
                </div>
              )}
              {isProphylaxisDue() && (
                <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-3.5 flex items-start gap-2.5 shadow-sm">
                  <CalendarClock className="w-4.5 h-4.5 text-[#8B0000] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Lembrete de Profilaxia Semestral</span>
                    <p className="text-[11px] text-red-800 mt-0.5">Já se passaram 6 meses ou mais desde que este paciente foi registrado ou realizou seu tratamento. Convide-o para uma nova limpeza!</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!pd.mobile ? (
            <div className="bg-zinc-50 border border-zinc-200 text-zinc-500 rounded-xl p-4 text-center">
              <AlertCircle className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
              <p className="font-semibold text-xs">Preencha o campo Celular (nos Dados Cadastrais) para habilitar as mensagens de WhatsApp e lembretes para este paciente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-zinc-500 font-semibold">Selecione o Modelo de Mensagem</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('confirmacao')}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      selectedTemplate === 'confirmacao'
                        ? 'bg-[#8B0000] text-white border-[#8B0000]'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    Confirmar Consulta
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('aniversario')}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
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
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      selectedTemplate === 'profilaxia'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    🦷 Lembrete de Profilaxia (6 meses)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('feriado')}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      selectedTemplate === 'feriado'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    🎄 Fim de Ano (Natal/Ano Novo)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-zinc-500 font-semibold">Editar Mensagem antes de Enviar</label>
                <textarea
                  rows={4}
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none font-sans text-xs resize-y"
                  placeholder="Mensagem..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const digitsOnly = pd.mobile!.replace(/\D/g, '');
                    const cleanNum = (digitsOnly.length === 10 || digitsOnly.length === 11) ? '55' + digitsOnly : digitsOnly;
                    const encodedMsg = encodeURIComponent(whatsappMessage);
                    const url = cleanNum ? `https://wa.me/${cleanNum}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
                    window.open(url, '_blank');
                  }}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <MessageCircle className="w-4.5 h-4.5 text-white" />
                  <span>Enviar via WhatsApp ({pd.mobile})</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
