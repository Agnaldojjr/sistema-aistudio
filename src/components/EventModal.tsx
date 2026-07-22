import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar as CalendarIcon, Clock, User, Phone, Mail, MessageCircle, AlertCircle, Save, Trash2, DollarSign, Tag, FileText } from 'lucide-react';
import { createCalendarEvent, deleteCalendarEvent } from '../lib/calendar';
import { addHours, addMinutes, format, parseISO } from 'date-fns';
import { getSupabaseCRMDatabase, saveSupabaseCRMDatabase } from '../lib/supabaseCrm';
import { DEFAULT_PROCEDURES } from '../constants';

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0');
  const m = (i % 2 === 0 ? '00' : '30');
  return `${h}:${m}`;
});

interface EventModalProps {
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  selectedDate?: Date;
  existingEvent?: any; // Google Calendar event object
  initialPatientName?: string;
  onNewPatient?: (name: string, phone: string, email: string) => void;
}

export default function EventModal({ onClose, onSaved, onDeleted, selectedDate, existingEvent, initialPatientName, onNewPatient }: EventModalProps) {
  const isEditing = !!existingEvent;
  
  // Initialize form state
  const [title, setTitle] = useState(existingEvent?.summary || initialPatientName || '');
  
  const getRoundedTime = (date: Date) => {
    let d = new Date(date);
    const minutes = d.getMinutes();
    d.setMinutes(minutes >= 30 ? 30 : 0, 0, 0);
    if (minutes >= 45) {
        d.setHours(d.getHours() + 1);
        d.setMinutes(0);
    } else if (minutes >= 15 && minutes < 45) {
        d.setMinutes(30);
    } else {
        d.setMinutes(0);
    }
    return format(d, 'HH:mm');
  };

  const roundedStartDate = selectedDate || new Date();
  const roundedEndDate = addMinutes(roundedStartDate, 30);

  const [date, setDate] = useState(
    existingEvent?.start?.dateTime 
      ? format(parseISO(existingEvent.start.dateTime), 'yyyy-MM-dd')
      : selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [startTime, setStartTime] = useState(
    existingEvent?.start?.dateTime 
      ? format(parseISO(existingEvent.start.dateTime), 'HH:mm')
      : getRoundedTime(roundedStartDate)
  );
  
  const [endTime, setEndTime] = useState(
    existingEvent?.end?.dateTime 
      ? format(parseISO(existingEvent.end.dateTime), 'HH:mm')
      : getRoundedTime(roundedEndDate)
  );
  
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  
  const [crmPatients, setCrmPatients] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPatientObj, setSelectedPatientObj] = useState<any | null>(null);

  // Procedure Linking States
  const [openProcedures, setOpenProcedures] = useState<any[]>([]);
  const [procedureSource, setProcedureSource] = useState<'plan' | 'catalog' | 'custom'>('catalog');
  const [selectedPlanProcedureId, setSelectedPlanProcedureId] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [customProcedureName, setCustomProcedureName] = useState('');
  const [estimatedValue, setEstimatedValue] = useState<number>(0);
  const [linkedProcedureName, setLinkedProcedureName] = useState<string>('');

  useEffect(() => {
    getSupabaseCRMDatabase()
      .then((db: any) => {
        if (db?.patients) {
          const sorted = [...db.patients].sort((a: any, b: any) =>
            (a.name || '').localeCompare(b.name || '')
          );
          setCrmPatients(sorted);

          const searchName = (title || initialPatientName || '').toLowerCase().trim();
          if (searchName) {
            const matched = sorted.find((p: any) => 
              (p.name || '').toLowerCase().trim() === searchName
            );
            if (matched) {
              setSelectedPatientObj(matched);
              setPatientPhone(matched.mobile || matched.phone || '');
              setPatientEmail(matched.email || '');

              // Check if patient has open procedures in odontograma
              const odontogramas = (db.odontograma || []).filter((o: any) => o.patientId === matched.id);
              const latestOdont = odontogramas.pop();
              const openProcs: any[] = [];

              if (latestOdont?.sections) {
                latestOdont.sections.forEach((sec: any) => {
                  sec.markers?.forEach((m: any) => {
                    if (m.procedureInstances) {
                      m.procedureInstances.forEach((inst: any) => {
                        if ((inst.status === 'A realizar' || inst.status === 'Em andamento') && !inst.paid) {
                          openProcs.push({
                            id: inst.id || `proc_${m.id}_${inst.procedureId}`,
                            name: inst.name || 'Procedimento',
                            toothNumber: m.toothNumber,
                            price: inst.price || 0,
                            status: inst.status
                          });
                        }
                      });
                    }
                  });
                });
              }

              setOpenProcedures(openProcs);
              if (openProcs.length > 0) {
                setProcedureSource('plan');
              }
            }
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load CRM database in EventModal:', err);
      });
  }, [initialPatientName]);

  const handleNameChange = (val: string) => {
    setTitle(val);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedPatientObj(null);
      setOpenProcedures([]);
      return;
    }
    const filtered = crmPatients.filter(p =>
      (p.name || '').toLowerCase().includes(val.toLowerCase())
    );
    setSuggestions(filtered);
    setShowSuggestions(true);

    const matched = crmPatients.find(p => (p.name || '').toLowerCase().trim() === val.toLowerCase().trim());
    if (matched) {
      setSelectedPatientObj(matched);
      setPatientPhone(matched.mobile || matched.phone || '');
      setPatientEmail(matched.email || '');
    }
  };

  const handleSelectPatient = (p: any) => {
    setTitle(p.name);
    setSelectedPatientObj(p);
    setPatientPhone(p.mobile || p.phone || '');
    setPatientEmail(p.email || '');
    setShowSuggestions(false);

    // Fetch open procedures for this patient
    getSupabaseCRMDatabase().then((db: any) => {
      const odontogramas = (db.odontograma || []).filter((o: any) => o.patientId === p.id);
      const latestOdont = odontogramas.pop();
      const openProcs: any[] = [];

      if (latestOdont?.sections) {
        latestOdont.sections.forEach((sec: any) => {
          sec.markers?.forEach((m: any) => {
            if (m.procedureInstances) {
              m.procedureInstances.forEach((inst: any) => {
                if ((inst.status === 'A realizar' || inst.status === 'Em andamento') && !inst.paid) {
                  openProcs.push({
                    id: inst.id || `proc_${m.id}_${inst.procedureId}`,
                    name: inst.name || 'Procedimento',
                    toothNumber: m.toothNumber,
                    price: inst.price || 0,
                    status: inst.status
                  });
                }
              });
            }
          });
        });
      }

      setOpenProcedures(openProcs);
      if (openProcs.length > 0) {
        setProcedureSource('plan');
      } else {
        setProcedureSource('catalog');
      }
    });
  };
  
  // Try to parse phone/email from description if editing
  React.useEffect(() => {
    if (existingEvent?.description) {
      const pMatch = existingEvent.description.match(/WhatsApp:\s*([\d\+\-\(\)\s]+)/);
      if (pMatch) setPatientPhone(pMatch[1].trim());
      
      const eMatch = existingEvent.description.match(/Email:\s*([^\s]+)/);
      if (eMatch) setPatientEmail(eMatch[1].trim());
    }
  }, [existingEvent]);

  // Handle Procedure Selection Changes
  const handleSelectCatalogProcedure = (procId: string) => {
    setSelectedCatalogId(procId);
    const proc = DEFAULT_PROCEDURES.find(p => p.id === procId);
    if (proc) {
      setEstimatedValue(proc.price);
      setLinkedProcedureName(proc.name);
    }
  };

  const handleSelectPlanProcedure = (procId: string) => {
    setSelectedPlanProcedureId(procId);
    const proc = openProcedures.find(p => p.id === procId);
    if (proc) {
      setEstimatedValue(proc.price);
      const displayName = proc.toothNumber ? `${proc.name} (Dente ${proc.toothNumber})` : proc.name;
      setLinkedProcedureName(displayName);
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
      const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();
      
      const attendees = [];
      if (patientEmail) {
        attendees.push({ email: patientEmail });
      }

      const finalProcedureName = procedureSource === 'custom' 
        ? customProcedureName 
        : linkedProcedureName || 'Consulta Odontológica';

      const description = `Consulta odontológica: ${finalProcedureName}.\nValor Estimado: R$ ${estimatedValue.toFixed(2)}\n\n${patientPhone ? `WhatsApp do Paciente: ${patientPhone}` : ''}\n${patientEmail ? `Email do Paciente: ${patientEmail}` : ''}`;
      
      const eventData = {
        summary: title || 'Consulta Odontológica',
        description,
        start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        attendees: attendees.length > 0 ? attendees : undefined,
      };

      if (isEditing) {
        await deleteCalendarEvent(existingEvent.id);
      }
      
      const createdCalEvent = await createCalendarEvent(eventData);
      const eventId = createdCalEvent?.id || `evt_${Date.now()}`;

      // Save / Upsert to Supabase crm_data.appointments with procedure link & estimated value
      const crmData = await getSupabaseCRMDatabase();
      if (!crmData.patients) crmData.patients = [];
      if (!crmData.appointments) crmData.appointments = [];

      let patientId = selectedPatientObj?.id;

      if (!patientId) {
        const matched = crmData.patients.find((p: any) => (p.name || '').toLowerCase().trim() === title.toLowerCase().trim());
        if (matched) {
          patientId = matched.id;
        } else {
          // Auto-create patient record
          patientId = `pat_${Date.now()}`;
          const newPat = {
            id: patientId,
            name: title.toUpperCase(),
            phone: patientPhone,
            mobile: patientPhone,
            email: patientEmail,
            createdAt: new Date().toISOString()
          };
          crmData.patients.push(newPat);
        }
      }

      const newApptRecord = {
        id: eventId,
        patientId,
        patientName: title,
        date,
        time: startTime,
        status: 'Confirmado',
        observations: description,
        estimatedValue: Number(estimatedValue) || 0,
        linkedProcedureId: selectedPlanProcedureId || selectedCatalogId || 'custom',
        linkedProcedureName: finalProcedureName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const existingIdx = crmData.appointments.findIndex((a: any) => a.id === eventId);
      if (existingIdx >= 0) {
        crmData.appointments[existingIdx] = { ...crmData.appointments[existingIdx], ...newApptRecord };
      } else {
        crmData.appointments.push(newApptRecord);
      }

      await saveSupabaseCRMDatabase(crmData);

      onSaved();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Falha ao salvar evento');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingEvent || !confirm('Deseja realmente cancelar esta consulta no Google Calendar?')) return;
    try {
      setLoading(true);
      await deleteCalendarEvent(existingEvent.id);
      if (onDeleted) onDeleted();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir');
      setLoading(false);
    }
  };

  const sendWhatsappText = () => {
    if (!patientPhone) {
      alert("Informe o WhatsApp do paciente primeiro (ex: 5511999999999).");
      return;
    }
    const numbersOnly = patientPhone.replace(/[^\d]/g, '');
    const dateFormatted = format(new Date(`${date}T${startTime}:00`), "dd/MM/yyyy 'às' HH:mm");
    const msg = `Olá! Gostaríamos de lembrar sobre a sua consulta odontológica agendada para ${dateFormatted}. Por favor, confirme ou avise caso precise remarcar.`;
    window.open(`https://wa.me/${numbersOnly}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-fade-in relative my-8">
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-[#FAF8F5]">
          <h2 className="text-lg font-bold text-[#4E1119] font-serif">
            {isEditing ? 'Detalhes da Consulta' : 'Nova Consulta'}
          </h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* PATIENT NAME FIELD */}
          <div className="space-y-1.5 relative">
            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
              <User className="w-4 h-4 text-zinc-400" />
              Nome do Paciente
            </label>
            <input
              required
              type="text"
              value={title}
              onChange={e => handleNameChange(e.target.value)}
              onFocus={() => {
                if (title && crmPatients.length > 0) {
                  const filtered = crmPatients.filter(p =>
                    (p.name || '').toLowerCase().includes(title.toLowerCase())
                  );
                  setSuggestions(filtered);
                  setShowSuggestions(true);
                } else {
                  setSuggestions(crmPatients.slice(0, 10));
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 250);
              }}
              placeholder="Ex: Lucimara dos Santos Firmino"
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20 text-sm"
            />
            {showSuggestions && (
              <div className="absolute left-0 right-0 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                {suggestions.map((p, idx) => (
                  <button
                    key={p.id || idx}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-50 font-sans text-xs flex flex-col gap-0.5 border-b border-zinc-100 last:border-b-0 cursor-pointer"
                  >
                    <span className="font-bold text-zinc-800">{p.name}</span>
                    <span className="text-[10px] text-zinc-500">
                      {p.mobile || p.phone ? `Celular: ${p.mobile || p.phone}` : 'Sem celular'}
                      {p.email ? ` | Email: ${p.email}` : ''}
                    </span>
                  </button>
                ))}
                
                {onNewPatient && (
                  <button
                    type="button"
                    onClick={() => {
                      onNewPatient(title, patientPhone, patientEmail);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-zinc-50 font-sans text-xs flex items-center gap-2 cursor-pointer border-t border-zinc-100 text-[#8B0000] font-bold"
                  >
                    <User className="w-4 h-4" />
                    Cadastrar "{title || 'Novo Paciente'}" no CRM
                  </button>
                )}
              </div>
            )}
          </div>

          {/* PROCEDURE LINKING & ESTIMATED VALUE SECTION */}
          <div className="bg-[#FAF8F5] border border-[#E6DEC9] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#4E1119] flex items-center gap-1.5 uppercase tracking-wider">
                <Tag className="w-4 h-4 text-[#C09553]" />
                Vincular Procedimento / Pacote
              </label>

              <div className="flex gap-1 bg-white border border-zinc-200 rounded-lg p-0.5 text-[10px] font-bold">
                {openProcedures.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setProcedureSource('plan')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      procedureSource === 'plan' ? 'bg-[#8B0000] text-white' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Plano Ativo ({openProcedures.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setProcedureSource('catalog')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    procedureSource === 'catalog' ? 'bg-[#8B0000] text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Catálogo Padrão
                </button>
                <button
                  type="button"
                  onClick={() => setProcedureSource('custom')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    procedureSource === 'custom' ? 'bg-[#8B0000] text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Personalizado / Promo
                </button>
              </div>
            </div>

            {/* SOURCE 1: OPEN PROCEDURES FROM PATIENT TREATMENT PLAN */}
            {procedureSource === 'plan' && openProcedures.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Procedimento Pendente no Plano do Paciente:</label>
                <select
                  value={selectedPlanProcedureId}
                  onChange={(e) => handleSelectPlanProcedure(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:border-[#C09553] outline-none"
                >
                  <option value="">Selecione um procedimento a realizar...</option>
                  {openProcedures.map((proc) => (
                    <option key={proc.id} value={proc.id}>
                      {proc.toothNumber ? `Dente ${proc.toothNumber}: ` : ''}{proc.name} - R$ {proc.price.toFixed(2)} ({proc.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* SOURCE 2: STANDARD CATALOG PACKAGES */}
            {procedureSource === 'catalog' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Pacotes e Procedimentos do Catálogo:</label>
                <select
                  value={selectedCatalogId}
                  onChange={(e) => handleSelectCatalogProcedure(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:border-[#C09553] outline-none"
                >
                  <option value="">Selecione do catálogo padrão...</option>
                  {DEFAULT_PROCEDURES.map((proc) => (
                    <option key={proc.id} value={proc.id}>
                      {proc.name} - R$ {proc.price.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* SOURCE 3: CUSTOM PROMO INPUT */}
            {procedureSource === 'custom' && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700">Nome do Procedimento / Promoção:</label>
                  <input
                    type="text"
                    placeholder="Ex: Avaliação Inicial + Raio-X Especial: R$ 150"
                    value={customProcedureName}
                    onChange={(e) => {
                      setCustomProcedureName(e.target.value);
                      setLinkedProcedureName(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:border-[#C09553] outline-none"
                  />
                </div>
              </div>
            )}

            {/* ESTIMATED PROCEDURE VALUE DISPLAY & EDIT */}
            <div className="pt-1 flex items-center justify-between border-t border-zinc-200">
              <span className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-[#C09553]" />
                Valor Estimado do Procedimento:
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-[#8B0000]">R$</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(parseFloat(e.target.value) || 0)}
                  className="w-28 px-3 py-1.5 border border-zinc-300 rounded-xl text-xs font-bold font-mono text-right text-[#8B0000] bg-white focus:border-[#C09553] outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 italic">
              Este valor atualizará o counter de <strong>Faturamento Programado Diário</strong> na Agenda.
            </p>
          </div>

          {/* DATE AND TIME */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-zinc-400" /> Data
              </label>
              <input
                required
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-zinc-400" /> Horário
              </label>
              <div className="flex items-center gap-2">
                {(() => {
                  const startTimeSlots = [...TIME_SLOTS];
                  if (startTime && !startTimeSlots.includes(startTime)) {
                    startTimeSlots.push(startTime);
                    startTimeSlots.sort();
                  }
                  return (
                    <select
                      value={startTime}
                      onChange={e => {
                        setStartTime(e.target.value);
                        const startIdx = TIME_SLOTS.indexOf(e.target.value);
                        const endIdx = TIME_SLOTS.indexOf(endTime);
                        if (startIdx >= 0 && (endIdx <= startIdx || endIdx > startIdx + 4)) {
                          const nextIdx = (startIdx + 1) % TIME_SLOTS.length;
                          setEndTime(TIME_SLOTS[nextIdx]);
                        }
                      }}
                      className="w-full px-2 py-2 border border-zinc-300 rounded-xl text-sm bg-white cursor-pointer"
                    >
                      {startTimeSlots.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  );
                })()}
                <span className="text-zinc-400">às</span>
                {(() => {
                  const endTimeSlots = [...TIME_SLOTS];
                  if (endTime && !endTimeSlots.includes(endTime)) {
                    endTimeSlots.push(endTime);
                    endTimeSlots.sort();
                  }
                  return (
                    <select
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-full px-2 py-2 border border-zinc-300 rounded-xl text-sm bg-white cursor-pointer"
                    >
                      {endTimeSlots.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* CONTACT INFO */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-zinc-400" /> WhatsApp
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={patientPhone}
                onChange={e => setPatientPhone(e.target.value)}
                placeholder="Ex: 5511999999999"
                className="flex-1 px-3 py-2 border border-zinc-300 rounded-xl focus:border-[#C09553] text-sm"
              />
              <button
                type="button"
                onClick={sendWhatsappText}
                className="bg-[#25D366] hover:bg-[#1DA851] text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Enviar lembrete pelo WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar MSG
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-zinc-400" /> Email do Paciente (Opcional)
            </label>
            <input
              type="email"
              value={patientEmail}
              onChange={e => setPatientEmail(e.target.value)}
              placeholder="Para envio automático do Google e lembretes"
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:border-[#C09553]"
            />
          </div>

          {/* MODAL FOOTER */}
          <div className="pt-4 flex items-center gap-3 border-t border-zinc-100">
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-1.5 text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl font-semibold text-xs transition-colors"
                title="Excluir Consulta"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-[#4E1119] hover:bg-[#6c1b26] text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:bg-zinc-400"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Salvando...' : 'Salvar Consulta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
