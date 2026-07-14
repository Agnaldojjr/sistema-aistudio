import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  MessageSquare, 
  UserPlus, 
  Activity, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  X, 
  Plus, 
  Settings, 
  Sparkles, 
  Smile, 
  ChevronRight, 
  ChevronLeft,
  ArrowUpRight, 
  Phone, 
  Send,
  Loader2,
  Monitor,
  Smartphone,
  Search,
  Trash2,
  CalendarClock,
  XCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { ClinicSettings, TreatmentProposal } from '../types';
import { listCalendarEvents, deleteCalendarEvent } from '../lib/calendar';
import { getSupabaseCRMDatabase, saveSupabaseCRMDatabase } from '../lib/supabaseCrm';
import { addDays, subDays, format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardViewProps {
  clinicSettings: ClinicSettings;
  proposal: TreatmentProposal;
  onNavigateToPlanning: (patientName?: string, status?: string) => void;
  onOpenRegistry: () => void;
  onOpenPatientsList: () => void;
  onOpenCalendar: () => void;
  isMobileOptimized: boolean;
  setIsMobileOptimized: (v: boolean) => void;
  onOpenPatient: (patientName: string) => void;
}

// Beautiful simulated mock list of appointments today representing a fully-populated workspace
interface Appointment {
  id: string;
  patientId?: string;
  patientName: string;
  originalSummary: string;
  time: string;
  service: string;
  status: 'Confirmado' | 'Pendente' | 'Cancelado' | 'Falta' | 'Reagendado';
  phone: string;
  proposalTotal?: number;
}

interface ReturnControl {
  id: string;
  patientName: string;
  lastVisit: string;
  nextRecallDate: string;
  status: 'Agendado' | 'Lembrete Enviado' | 'Confirmado' | 'Falta Registrada';
  phone: string;
}

// Helper to extract phone number from event description
function extractPhone(text: string): string {
  if (!text) return '';
  // Match patterns like "WhatsApp: 31 98888-8888" or "WhatsApp do Paciente: 31988888888"
  const waRegex = /(?:whatsapp|whats|tel|telefone|celular|fone|contato)(?:\s+do\s+paciente)?\s*:\s*([\d\s\-()]+)/i;
  const match = text.match(waRegex);
  if (match && match[1]) {
    const clean = match[1].replace(/\D/g, '');
    if (clean.length >= 8) return match[1].trim();
  }
  // Fallback: look for a sequence of 8-11 digits (possibly with formatting)
  const phoneRegex = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}\s*[-.]?\s*\d{4}/g;
  const matches = text.match(phoneRegex);
  if (matches && matches.length > 0) {
    return matches[0].trim();
  }
  return '';
}

// Heuristic to filter out non-patient calendar events (e.g. Lunch, Meetings)
function isPatientAppointment(summary: string, description: string): boolean {
  const lowerSummary = (summary || '').toLowerCase();
  
  // Normalized blocked words (removing accents)
  const normalizedSummary = lowerSummary.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const blockedKeywords = ['reuniao', 'almoco', 'particular', 'bloqueio', 'compromisso', 'ferias', 'folga', 'curso', 'palestra', 'personal', 'maintenance', 'manutencao'];
  
  for (const kw of blockedKeywords) {
    if (normalizedSummary.includes(kw)) {
      return false;
    }
  }
  return true;
}

export default function DashboardView({
  clinicSettings,
  proposal,
  onNavigateToPlanning,
  onOpenRegistry,
  onOpenPatientsList,
  onOpenCalendar,
  isMobileOptimized,
  setIsMobileOptimized,
  onOpenPatient,
}: DashboardViewProps) {
  
  // Real-time local date details
  const todayDateStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Synchronized Appointments and Returns lists from real Drive & Calendar APIs
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [returns, setReturns] = useState<ReturnControl[]>([]);
  const [realPatients, setRealPatients] = useState<any[]>([]);
  const [loadingRealData, setLoadingRealData] = useState(false);
  const [selectedAgendaDate, setSelectedAgendaDate] = useState<Date>(new Date());
  const [loadingAgenda, setLoadingAgenda] = useState(false);

  // States for manually changing patient association
  const [isChangePatientOpen, setIsChangePatientOpen] = useState(false);
  const [appointmentToChange, setAppointmentToChange] = useState<Appointment | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return realPatients.filter((p: any) => p.name?.toLowerCase().includes(q) || p.appProperties?.phone?.includes(q));
  }, [searchQuery, realPatients]);

  const enrichPatients = async (patientsList: any[]) => {
    try {
      const { getPatientFileUrlFromSupabase } = await import('../lib/supabaseStorage');
      const enriched = await Promise.all((patientsList || []).map(async (p: any) => {
        let totalVal = parseFloat(p.appProperties?.total || "0");
        if (isNaN(totalVal) || totalVal === 0) {
          try {
            const data = await (async () => {
              const url = await getPatientFileUrlFromSupabase(p.id, "orcamento.json");
              if (!url) return null;
              const r = await fetch(url);
              if (!r.ok) return null;
              return await r.json();
            })();
            if (data?.simulations?.length > 0) {
              totalVal = data.simulations[data.selectedPlanIndex || 0]?.custoTotal || data.simulations[0]?.custoTotal || 0;
            }
          } catch (e) {
            // Ignore
          }
        }
        return { ...p, extractedTotal: totalVal };
      }));
      return enriched;
    } catch (e) {
      console.warn('Error enriching patients:', e);
      return patientsList;
    }
  };

  useEffect(() => {
    const loadRealDashboardData = async () => {
      setLoadingRealData(true);
      try {
        const drivePatients = await (async () => { const db = await getSupabaseCRMDatabase(); return db.patients || []; })();
        const enriched = await enrichPatients(drivePatients);
        setRealPatients(enriched);
      } catch (err) {
        console.warn('Dashboard Patient folders load skipped:', err);
        setRealPatients([]);
      } finally {
        setLoadingRealData(false);
      }
    };

    loadRealDashboardData();
  }, []);

  useEffect(() => {
    const fetchAgenda = async () => {
      setLoadingAgenda(true);
      try {
        const startOfDay = new Date(selectedAgendaDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedAgendaDate);
        endOfDay.setHours(23, 59, 59, 999);

        const calData = await listCalendarEvents(startOfDay, endOfDay);
        if (calData && calData.items) {
          const crmData = await getSupabaseCRMDatabase();
          if (!crmData.patients) crmData.patients = [];
          if (!crmData.appointments) crmData.appointments = [];

          let dbChanged = false;
          const appts: Appointment[] = [];

          for (const item of calData.items) {
            if (item.status === 'cancelled') continue;
            if (!item.start?.dateTime && !item.start?.date) continue;

            const startDateTime = item.start.dateTime || item.start.date;
            let timeStr = 'Dia Todo';
            if (item.start.dateTime) {
              const dt = new Date(startDateTime);
              timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }

            let rawDesc = item.description || 'Consulta Clínica';
            let cleanDesc = rawDesc;
            if (rawDesc.includes('Notas:')) {
              const parts = rawDesc.split('Notas:');
              cleanDesc = parts[1].trim();
            } else if (rawDesc.includes('Business name:')) {
              cleanDesc = 'Agendamento via WhatsApp';
            }

            const eventId = item.id;
            const eventSummary = (item.summary || 'Consulta Sem Nome').trim();

            if (!isPatientAppointment(eventSummary, rawDesc)) {
              appts.push({
                id: eventId,
                patientName: eventSummary,
                originalSummary: eventSummary,
                time: timeStr,
                service: cleanDesc,
                status: 'Confirmado',
                phone: ''
              });
              continue;
            }

            let associatedAppt = crmData.appointments.find((a: any) => a.id === eventId);
            let patient = null;

            if (associatedAppt) {
              patient = crmData.patients.find((p: any) => p.id === associatedAppt.patientId);
            }

            if (!patient) {
              const extractedPhone = extractPhone(rawDesc);
              const normalizedExtractedPhone = extractedPhone.replace(/\D/g, '');

              if (normalizedExtractedPhone) {
                patient = crmData.patients.find((p: any) => {
                  const pPhone = (p.mobile || p.phone || '').replace(/\D/g, '');
                  return pPhone && pPhone === normalizedExtractedPhone;
                });
              }

              if (!patient) {
                const cleanEventSummary = eventSummary.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                patient = crmData.patients.find((p: any) => {
                  const pNameClean = (p.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  return pNameClean === cleanEventSummary || 
                         pNameClean.includes(cleanEventSummary) || 
                         cleanEventSummary.includes(pNameClean);
                });
              }

              if (patient) {
                const newApptLink = {
                  id: eventId,
                  patientId: patient.id,
                  patientName: patient.name,
                  date: format(selectedAgendaDate, 'yyyy-MM-dd'),
                  time: timeStr,
                  status: 'Confirmado',
                  observations: cleanDesc,
                  createdAt: new Date().toISOString()
                };

                if (associatedAppt) {
                  const idx = crmData.appointments.findIndex((a: any) => a.id === eventId);
                  crmData.appointments[idx] = { ...associatedAppt, ...newApptLink };
                } else {
                  crmData.appointments.push(newApptLink);
                }
                dbChanged = true;
              } else {
                const newPatId = `pat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const extractedPhone = extractPhone(rawDesc);
                const formattedPhone = extractedPhone || '';
                let finalName = eventSummary.toUpperCase();

                if (formattedPhone) {
                  try {
                    const hermesRes = await fetch(`/api/hermes/name?phone=${formattedPhone}`);
                    if (hermesRes.ok) {
                      const data = await hermesRes.json();
                      if (data.name) {
                        finalName = data.name.toUpperCase();
                      }
                    }
                  } catch (e) {
                    console.error("Erro ao consultar Hermes:", e);
                  }
                }

                const newPatient = {
                  id: newPatId,
                  name: finalName,
                  codigo_paciente: `COD-${Math.floor(1000 + Math.random() * 9000)}`,
                  phone: formattedPhone,
                  mobile: formattedPhone,
                  healthInsurance: 'PARTICULAR',
                  medicalRecord: '',
                  observations: 'Cadastrado automaticamente via Google Calendar',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };

                crmData.patients.push(newPatient);

                const newApptLink = {
                  id: eventId,
                  patientId: newPatId,
                  patientName: newPatient.name,
                  date: format(selectedAgendaDate, 'yyyy-MM-dd'),
                  time: timeStr,
                  status: 'Confirmado',
                  observations: cleanDesc,
                  createdAt: new Date().toISOString()
                };

                crmData.appointments.push(newApptLink);
                patient = newPatient;
                dbChanged = true;
              }
            }

            appts.push({
              id: eventId,
              patientId: patient?.id,
              patientName: patient?.name || eventSummary,
              originalSummary: eventSummary,
              time: timeStr,
              service: cleanDesc,
              status: associatedAppt?.status || 'Confirmado',
              phone: patient?.mobile || patient?.phone || extractPhone(rawDesc)
            });
          }

          if (dbChanged) {
            await saveSupabaseCRMDatabase(crmData);
            const enriched = await enrichPatients(crmData.patients);
            setRealPatients(enriched);
          }

          setAppointments(appts);
        } else {
          setAppointments([]);
        }
      } catch (err) {
        console.warn('Dashboard Calendar load skipped:', err);
        setAppointments([]);
      } finally {
        setLoadingAgenda(false);
      }
    };

    fetchAgenda();
  }, [selectedAgendaDate]);

  // Stat Indicators derived dynamically with beautiful, real business ratios
  const stats = useMemo(() => {
    let approvedSum = 0;
    let pendingNegotiationSum = 0;
    let convertedTreatments = 0;
    let totalConsults = realPatients.length;

    realPatients.forEach((p) => {
      const status = p.appProperties?.status || 'Em Andamento';
      const amt = p.extractedTotal || 0;

      if (status === 'Concluído' || status === 'Em Andamento') {
        approvedSum += amt;
        convertedTreatments += 1;
      } else if (status === 'Aguardando Aprovação') {
        pendingNegotiationSum += amt;
      }
    });

    let conversionRate = totalConsults > 0 ? Math.round((convertedTreatments / totalConsults) * 100) : 0;

    return {
      approvedSum,
      pendingNegotiationSum,
      totalConsults,
      convertedTreatments,
      conversionRate
    };
  }, [realPatients]);

  // Quick WhatsApp templates for action triggers
  const sendWhatsAppConfirmation = (appt: Appointment) => {
    const message = `Olá, ${appt.patientName}! Gostaríamos de confirmar a sua consulta de *${appt.service}* agendada para hoje às *${appt.time}* com o *${clinicSettings.doctorName}*.\n\n📍 Endereço: ${clinicSettings.address}\n(Ref: ${clinicSettings.referencePoint})\n\nPor favor, responda confirmando sua presença. Ficamos no aguardo!`;
    const cleanPhone = appt.phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    // Mark appointment as confirmed on click
    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: 'Confirmado' } : a));
  };

  const sendWhatsAppRecall = (ret: ReturnControl) => {
    const message = `Olá, ${ret.patientName}! Tudo bem? Passando para lembrá-la(o) que está na hora de realizar a sua consulta clínica de retorno odontológico periódico (limpeza/controle geral).\n\nSua última visita foi em ${ret.lastVisit}. Que tal agendarmos o seu check-up para os próximos dias?\n\nFicamos no aguardo para cuidar do seu sorriso! ✨`;
    const cleanPhone = ret.phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'Lembrete Enviado' } : r));
  };

  const toggleAppointmentStatus = (id: string) => {
    setAppointments(prev => prev.map(a => {
      if (a.id !== id) return a;
      const nextStatusMap: Record<Appointment['status'], Appointment['status']> = {
        'Confirmado': 'Falta',
        'Falta': 'Pendente',
        'Pendente': 'Confirmado',
        'Cancelado': 'Pendente',
        'Reagendado': 'Pendente'
      };
      return { ...a, status: nextStatusMap[a.status] };
    }));
  };

  const handleRescheduleAppointment = (appt: Appointment) => {
    // Muda o status para reagendado e abre o calendário para escolher a nova data
    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: 'Reagendado' } : a));
    onOpenCalendar();
  };

  const handleCancelAppointmentStatus = (appt: Appointment) => {
    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: 'Cancelado' } : a));
  };

  const handleDeleteAppointment = async (id: string, name: string) => {
    if (window.confirm(`Deseja realmente cancelar e apagar definitivamente o agendamento de ${name}?`)) {
      try {
        if (!id.startsWith('c-')) {
          // If it's a real Google Calendar ID, call the API
          await deleteCalendarEvent(id);
        }
        setAppointments(prev => prev.filter(a => a.id !== id));
      } catch (err) {
        console.error("Erro ao deletar agendamento:", err);
        alert("Falha ao apagar o agendamento. Verifique sua conexão ou se você tem permissão.");
      }
    }
  };

  const handleOpenChangePatient = (appt: Appointment) => {
    setAppointmentToChange(appt);
    setPatientSearchQuery('');
    setIsChangePatientOpen(true);
  };

  const handleAssociatePatient = async (selectedPatient: any) => {
    if (!appointmentToChange) return;
    try {
      const crmData = await getSupabaseCRMDatabase();
      if (!crmData.patients) crmData.patients = [];
      if (!crmData.appointments) crmData.appointments = [];

      const apptId = appointmentToChange.id;
      const oldPatientId = appointmentToChange.patientId;

      // Update or create the association in crmData.appointments
      const existingApptIdx = crmData.appointments.findIndex((a: any) => a.id === apptId);
      const apptData = {
        id: apptId,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        date: format(selectedAgendaDate, 'yyyy-MM-dd'),
        time: appointmentToChange.time,
        status: appointmentToChange.status,
        observations: appointmentToChange.service,
        createdAt: new Date().toISOString()
      };

      if (existingApptIdx >= 0) {
        crmData.appointments[existingApptIdx] = { ...crmData.appointments[existingApptIdx], ...apptData };
      } else {
        crmData.appointments.push(apptData);
      }

      // Cleanup old auto-created patient if they have no other history
      if (oldPatientId && oldPatientId !== selectedPatient.id) {
        const oldPatient = crmData.patients.find((p: any) => p.id === oldPatientId);
        if (oldPatient && oldPatient.observations === 'Cadastrado automaticamente via Google Calendar') {
          const hasOtherAppointments = crmData.appointments.some((a: any) => a.id !== apptId && a.patientId === oldPatientId);
          const hasClinicalHistory = (crmData.clinical_history || []).some((h: any) => h.patientId === oldPatientId);
          const hasPayments = (crmData.pagamentos || []).some((p: any) => p.patientId === oldPatientId);
          const hasTreatments = (crmData.tratamentos || []).some((t: any) => t.patientId === oldPatientId);
          
          if (!hasOtherAppointments && !hasClinicalHistory && !hasPayments && !hasTreatments) {
            crmData.patients = crmData.patients.filter((p: any) => p.id !== oldPatientId);
          }
        }
      }

      await saveSupabaseCRMDatabase(crmData);

      // Refresh patients list in dashboard
      const enriched = await enrichPatients(crmData.patients);
      setRealPatients(enriched);
      
      // Update appointments list locally
      setAppointments(prev => prev.map(a => {
        if (a.id === apptId) {
          return {
            ...a,
            patientId: selectedPatient.id,
            patientName: selectedPatient.name,
            phone: selectedPatient.mobile || selectedPatient.phone || ''
          };
        }
        return a;
      }));

      setIsChangePatientOpen(false);
      setAppointmentToChange(null);
    } catch (err: any) {
      alert('Erro ao associar paciente: ' + err.message);
    }
  };

  const filteredPatientsForChange = useMemo(() => {
    if (!patientSearchQuery.trim()) return realPatients;
    const q = patientSearchQuery.toLowerCase();
    return realPatients.filter((p: any) => 
      (p.name || '').toLowerCase().includes(q) || 
      (p.mobile || p.phone || '').includes(q)
    );
  }, [patientSearchQuery, realPatients]);

  return (
    <div className="space-y-8 font-sans print:hidden">
      
      {/* ================= HERO GREETING BLOCK ================= */}
      <div className="relative bg-gradient-to-r from-[#8B0000] to-[#5C0000] border border-[#C09553]/40 rounded-3xl p-6 sm:p-8 text-[#FAF8F5] shadow-xl">
        {/* Abstract background graphics with branding patterns */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#C09553]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-gradient-to-tr from-[#C09553]/5 to-transparent rounded-full blur-2xl pointer-events-none" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#E1CDAC]">
                SISTEMA PREMIUM DE GESTÃO CLÍNICA
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
              Olá, {clinicSettings.doctorName}
            </h1>
            <p className="text-sm text-[#FAF8F5]/80 max-w-xl font-medium">
              Acompanhe as métricas do dia, os orçamentos em negociação e gerencie o fluxo de retorno periódico para manter a clínica altamente rentável.
            </p>
            
            {/* SEARCH FIELD */}
            <div className="relative mt-4 w-full max-w-md pt-2">
              <div className="relative flex items-center">
                <Search className="w-5 h-5 absolute left-3 text-[#FAF8F5]/60" />
                <input 
                  type="text"
                  placeholder="Buscar paciente por nome ou telefone..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
                  onFocus={() => setShowSearchResults(true)}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                  className="w-full bg-black/20 border border-white/20 text-white placeholder-white/50 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C09553] focus:border-transparent transition-all backdrop-blur-sm"
                />
              </div>
              {showSearchResults && searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl overflow-hidden z-50 max-h-64 overflow-y-auto border border-zinc-200">
                   {filteredPatients.length > 0 ? (
                      filteredPatients.map(p => (
                         <button 
                           key={p.id}
                           onMouseDown={() => { // Using onMouseDown to fire before onBlur
                             onOpenPatient(p.name);
                             setSearchQuery('');
                             setShowSearchResults(false);
                           }}
                           className="w-full text-left px-4 py-3 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 flex items-center gap-3 transition-colors"
                         >
                           <div className="w-9 h-9 rounded-full bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000] font-bold shrink-0">
                             {p.name ? p.name.charAt(0).toUpperCase() : '?'}
                           </div>
                           <div className="truncate">
                             <p className="text-sm font-bold text-zinc-800 truncate">{p.name}</p>
                             <p className="text-xs text-zinc-500 truncate">{p.appProperties?.phone || 'Sem telefone'}</p>
                           </div>
                         </button>
                      ))
                   ) : (
                      <div className="px-4 py-4 text-sm text-zinc-500 text-center font-medium">Nenhum paciente encontrado</div>
                   )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <button
              id="btn-dash-new-planning"
              onClick={onOpenRegistry}
              className="flex items-center justify-center gap-2 bg-[#C09553] hover:bg-[#A97E3B] text-white font-bold text-xs px-5 py-3.5 rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Novo Paciente
            </button>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={onOpenCalendar}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#8B0000] hover:bg-[#5C0000] border border-white/20 text-[#FAF8F5] font-bold text-xs px-4 py-3.5 rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
                >
                  <Calendar className="w-4 h-4" />
                  Agendar Consulta
                </button>
                <button
                  id="btn-dash-patients"
                  onClick={onOpenPatientsList}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-[#FAF8F5] font-bold text-xs px-4 py-3.5 rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  <Users className="w-4 h-4" />
                  Galeria
                </button>
              </div>
              <button
                onClick={() => setIsMobileOptimized(!isMobileOptimized)}
                className="flex items-center justify-center gap-2 bg-[#C09553]/20 hover:bg-[#C09553]/30 border border-[#C09553]/35 text-[#FAF8F5] font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer active:scale-95"
                title={isMobileOptimized ? 'Alternar para Modo Desktop' : 'Alternar para Modo Celular'}
              >
                {isMobileOptimized ? <Monitor className="w-4 h-4 text-[#C09553]" /> : <Smartphone className="w-4 h-4 text-[#C09553]" />}
                {isMobileOptimized ? 'Modo Desktop' : 'Modo Celular'}
              </button>
            </div>
          </div>
        </div>

        {/* Floating current date indicator */}
        <div className="mt-6 pt-5 border-t border-[#FAF8F5]/10 flex flex-wrap gap-4 items-center justify-between text-xs text-[#FAF8F5]/60 font-mono">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#C09553]" />
            <span className="capitalize font-semibold text-zinc-100">{todayDateStr}</span>
          </div>
          <span className="bg-[#FAF8F5]/5 px-3 py-1 rounded-full border border-white/10 hidden sm:inline">
            Foco Máximo em Conversão de Pacientes: {stats.conversionRate}%
          </span>
        </div>
      </div>

      {/* ================= METRICS METRICS bento grid ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* STAT 1: CONVERSION RATE WITH RADIAL ring */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4 transition-shadow hover:shadow-md cursor-default"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Taxa de Conversão</span>
            <span className="text-2xl font-serif font-bold text-[#8B0000] block">{stats.conversionRate}%</span>
            <span className="text-[10.5px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              Meta Recomendada: 75%
            </span>
          </div>
          <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
            {/* Visual SVG Progress Ring */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F5F1E9" strokeWidth="3" />
              <circle 
                cx="18" 
                cy="18" 
                r="15.915" 
                fill="none" 
                stroke="#C09553" 
                strokeWidth="3.5" 
                strokeDasharray={`${stats.conversionRate} ${100 - stats.conversionRate}`} 
                strokeLinecap="round"
              />
            </svg>
            <Smile className="w-5 h-5 absolute text-[#B48C4D]" />
          </div>
        </motion.div>

        {/* STAT 2: APPROVED BUDGET VOLUME */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4 transition-shadow hover:shadow-md cursor-default"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Faturamento Estimado</span>
            <span className="text-2xl font-serif font-bold text-emerald-700 block">
              {stats.approvedSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[10px] text-zinc-400 font-medium tracking-normal block">Contratos fechados este mês</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0 shadow-inner">
            <DollarSign className="w-6 h-6" />
          </div>
        </motion.div>

        {/* STAT 3: BUDGETS PENDING NEGOTIATION */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4 transition-shadow hover:shadow-md cursor-default"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Orçamentos Pendentes</span>
            <span className="text-2xl font-serif font-bold text-amber-700 block">
              {stats.pendingNegotiationSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[10.5px] text-amber-600 font-bold flex items-center gap-0.5">
              <Clock className="w-3.5 h-3.5" /> Aguardando aprovação
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center flex-shrink-0 shadow-inner">
            <FileText className="w-6 h-6" />
          </div>
        </motion.div>

        {/* STAT 4: TOTAL RECALLS / RETORNOS */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4 transition-shadow hover:shadow-md cursor-default"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Retornos do Mês</span>
            <span className="text-2xl font-serif font-bold text-blue-700 block">
              {returns.length} Pacientes
            </span>
            <span className="text-[10.5px] text-[#8B0000] font-semibold">Prevenção / Recalls agendados</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0 shadow-inner">
            <Activity className="w-6 h-6" />
          </div>
        </motion.div>

      </div>

      {/* ================= WORKFLOW COHESIVE DIAGRAM INDICATOR ================= */}
      <div className="bg-[#FAF8F5] border border-[#E6DEC9] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C09553]" />
          <span className="text-xs font-bold text-[#8B0000] uppercase tracking-wide">
            Seu Fluxo de Trabalho Integrado:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 md:gap-3 text-[10px] sm:text-[11px] font-bold text-zinc-400 overflow-x-auto w-full md:w-auto justify-start md:justify-end py-1">
          <span className="text-[#8B0000] bg-[#8B0000]/5 px-2 py-0.5 rounded border border-[#8B0000]/10">Cadastro</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#C09553]" />
          <span className="text-[#8B0000] bg-[#8B0000]/5 px-2 py-0.5 rounded border border-[#8B0000]/10">Consulta</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#C09553]" />
          <span className="text-zinc-600">Mapeamento</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-600">Fotos Antes/Depois</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-600">Negociação</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-600">WhatsApp</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-600">Retorno</span>
        </div>
      </div>

      {/* ================= ROWS ROW 1: AGENDA vs RETORNOS FIDELIDADE ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMN 1: CLIENT AGENDA OF THE DAY (Left Side) */}
        <div className="lg:col-span-7 bg-white border border-[#E6DEC9] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#B48C4D]" />
              <h3 className="font-serif font-bold text-[#8B0000] text-base leading-none">
                Agenda {isToday(selectedAgendaDate) ? 'do Dia' : format(selectedAgendaDate, "dd 'de' MMM", { locale: ptBR })}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedAgendaDate(subDays(selectedAgendaDate, 1))}
                className="p-1 hover:bg-[#FAF8F5] rounded-lg transition-colors border border-transparent hover:border-[#E6DEC9]"
              >
                <ChevronLeft className="w-4 h-4 text-zinc-500 hover:text-[#8B0000]" />
              </button>
              <button 
                onClick={() => setSelectedAgendaDate(addDays(selectedAgendaDate, 1))}
                className="p-1 hover:bg-[#FAF8F5] rounded-lg transition-colors border border-transparent hover:border-[#E6DEC9]"
              >
                <ChevronRight className="w-4 h-4 text-zinc-500 hover:text-[#8B0000]" />
              </button>
              <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100 uppercase ml-2">
                {appointments.length} Consultas
              </span>
            </div>
          </div>

          <div className="divide-y divide-zinc-100 flex-1 overflow-x-auto">
            <table className="w-full text-left font-sans text-xs min-w-[500px]">
              <thead>
                <tr className="text-zinc-400 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-2.5">Horário</th>
                  <th className="py-2.5">Paciente</th>
                  <th className="py-2.5">Procedimento / Motivo</th>
                  <th className="py-2.5 text-center">Comparecimento</th>
                  <th className="py-2.5 text-right">A ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loadingAgenda ? (
                  <tr>
                    <td colSpan={5} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Loader2 className="w-8 h-8 text-[#C09553] animate-spin mb-3" />
                        <p className="text-zinc-600 font-semibold mb-1">Carregando agendamentos...</p>
                      </div>
                    </td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 bg-[#FAF8F5] rounded-full flex items-center justify-center mb-3">
                          <Calendar className="w-6 h-6 text-zinc-300" />
                        </div>
                        <p className="text-zinc-600 font-semibold mb-1">Nenhum agendamento para {isToday(selectedAgendaDate) ? 'hoje' : 'esta data'}</p>
                        <p className="text-zinc-400 text-[11px] max-w-xs">Os eventos do Google Calendar aparecerão automaticamente aqui.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  appointments.map((appt) => {
                    return (
                      <tr key={appt.id} className="hover:bg-[#FAF8F5]/40 transition-all group">
                        {/* Time */}
                        <td className="py-3.5 font-bold font-mono text-[#8B0000] text-sm">
                          {appt.time}
                        </td>
                        
                        {/* Patient detail */}
                        <td className="py-3.5">
                          <div 
                            className="font-bold text-zinc-800 uppercase cursor-pointer hover:text-[#8B0000] hover:underline"
                            onClick={() => onOpenPatient(appt.patientName)}
                          >
                            {appt.patientName}
                          </div>
                          {appt.originalSummary && appt.originalSummary.toUpperCase() !== appt.patientName.toUpperCase() && (
                            <div className="text-[9px] text-[#C09553] font-medium mt-0.5 truncate max-w-[180px]" title={`Título original na Agenda: ${appt.originalSummary}`}>
                              Agenda: {appt.originalSummary}
                            </div>
                          )}
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{appt.phone}</div>
                        </td>
                        
                        {/* Service detail */}
                        <td className="py-3.5 font-medium text-zinc-600">
                          {appt.service}
                        </td>

                        {/* Comparecimento state toggle */}
                        <td className="py-3.5 text-center">
                          <button
                            onClick={() => toggleAppointmentStatus(appt.id)}
                            className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-bold border cursor-pointer transition-colors shadow-2xs ${
                              appt.status === 'Confirmado'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : appt.status === 'Falta'
                                ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                : appt.status === 'Reagendado'
                                ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                                : appt.status === 'Cancelado'
                                ? 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                            title="Clique para alternar o status de comparecimento"
                          >
                            {appt.status}
                          </button>
                        </td>

                        {/* Actions column */}
                        <td className="py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => sendWhatsAppConfirmation(appt)}
                              className="p-1 px-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg border border-green-200 hover:border-green-300 transition-colors flex items-center justify-center"
                              title="Confirmar via WhatsApp"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onNavigateToPlanning(appt.patientName)}
                              className="px-2.5 py-1 bg-[#8B0000] text-white hover:bg-[#6c1b26] transition-colors font-bold text-[10px] rounded"
                              title="Abrir Planejamento de Tratamento"
                            >
                              Atender
                            </button>
                            <button
                              onClick={() => handleOpenChangePatient(appt)}
                              className="p-1 px-1.5 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 rounded-lg border border-zinc-200 hover:border-zinc-300 transition-colors flex items-center justify-center"
                              title="Alterar / Associar Paciente"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRescheduleAppointment(appt)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors ml-1 border border-transparent hover:border-blue-200"
                              title="Reagendar Consulta (Muda status e abre agenda)"
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCancelAppointmentStatus(appt)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors border border-transparent hover:border-zinc-200"
                              title="Marcar como Cancelado"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAppointment(appt.id, appt.patientName)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Apagar Agendamento do Calendário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* NEW REGISTRATION QUICK SHORTCUT MODULE */}
        <div className="lg:col-span-5 bg-[#FAF8F5] border-2 border-dashed border-[#E6DEC9] rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h4 className="font-serif font-bold text-[#8B0000] text-base leading-none">
              Cadastro Rápido & Consulta Inicial
            </h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              O paciente acabou de chegar no consultório? Inicie o cadastro rápido passo-a-passo e junte fotos iniciais num só clique para abrir o odontograma interativo.
            </p>
          </div>

          <div className="space-y-3.5 pt-2">
            <div className="bg-white border border-zinc-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#8B0000]/5 text-[#8B0000] flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <p className="font-bold text-zinc-700">Etapa 1: Cadastro & Documentos</p>
                <p className="text-zinc-500 text-[10.5px]">Identifique documento CPF, convênio ou responsável.</p>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-50 text-[#B48C4D] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <p className="font-bold text-zinc-700">Etapa 2: Mapeamento dos Dentes</p>
                <p className="text-zinc-500 text-[10.5px]">Configure os procedimentos em cada arcada do paciente.</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onOpenRegistry()}
            className="w-full mt-2 bg-[#8B0000] hover:bg-[#6c1b26] text-white text-xs font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4 text-[#C09553]" />
            <span>Preencher Cadastro Inicial</span>
          </button>
        </div>

      </div>

      {/* ================= ROWS ROW 2: PENDING PROPOSALS & NEGOTIATIONS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMN 2: FIDELIZATION & RETURN RECALL CONTROL (Right Side) */}
        <div className="lg:col-span-5 bg-white border border-[#E6DEC9] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#B48C4D]" />
              <h3 className="font-serif font-bold text-[#8B0000] text-base leading-none">
                Retorno & Recalls Periódicos
              </h3>
            </div>
            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
              Fidelização
            </span>
          </div>

          <p className="text-[11.5px] text-zinc-500 leading-normal">
            Pacientes que realizaram procedimentos há mais de 6 meses e necessitam de agendamento de retorno preventivo.
          </p>

          <div className="divide-y divide-zinc-100 space-y-3 flex-1">
            {returns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                <div className="w-12 h-12 bg-[#FAF8F5] rounded-full flex items-center justify-center mb-3">
                  <Activity className="w-6 h-6 text-zinc-300" />
                </div>
                <p className="text-zinc-600 font-semibold mb-1 xs">Agenda de Recall em Dia</p>
                <p className="text-zinc-400 text-[11px] max-w-[200px]">Nenhum paciente pendente para retorno de rotina no momento.</p>
              </div>
            ) : (
              returns.map((ret) => {
                return (
                  <div key={ret.id} className="pt-3 first:pt-0 flex justify-between items-start gap-4 text-xs font-sans">
                    <div className="space-y-0.5">
                      <div 
                        className="font-bold text-zinc-800 uppercase text-xs truncate max-w-[200px] cursor-pointer hover:text-[#8B0000] hover:underline"
                        onClick={() => onOpenPatient(ret.patientName)}
                      >
                        {ret.patientName}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        Última Visita: <strong className="text-zinc-600">{ret.lastVisit}</strong>
                      </div>
                      <div className="text-[10px] font-semibold text-[#B48C4D]">
                        Retorno Previsto: {ret.nextRecallDate}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        ret.status === 'Confirmado' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : ret.status === 'Falta Registrada' 
                          ? 'bg-red-50 text-[#8B0000] border-red-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {ret.status}
                      </span>
                      
                      <button
                        onClick={() => sendWhatsAppRecall(ret)}
                        className="mt-1 flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                      >
                        <Send className="w-2.5 h-2.5" />
                        <span>Lembrar WhatsApp</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ACTIVE NEGOTIATIONS SECTION */}
        <div className="lg:col-span-7 bg-white border border-[#E6DEC9] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#B48C4D]" />
              <h3 className="font-serif font-bold text-[#8B0000] text-base leading-none">
                Negociações de Orçamento Ativas
              </h3>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded-full uppercase font-semibold">
              Pendentes
            </span>
          </div>

          <div className="space-y-3.5 divide-y divide-zinc-100">
            {loadingRealData ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-500 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-[#B48C4D]" />
                <span className="font-semibold text-zinc-600">Sincronizando...</span>
                <span className="text-[10px] text-zinc-400">Puxando dados do Supabase</span>
              </div>
            ) : realPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-[#FAF8F5] rounded-full flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-zinc-300" />
                </div>
                <p className="text-zinc-600 font-semibold mb-1 text-sm">Nenhum orçamento encontrado</p>
                <p className="text-zinc-400 text-[11px] max-w-sm">Os orçamentos salvos aparecerão aqui. Clique em "Preencher Cadastro Inicial" para começar.</p>
              </div>
            ) : (
              realPatients.slice(0, 5).map((patient) => {
                const status = patient.appProperties?.status || 'Em Andamento';
                const statusColors: Record<string, string> = {
                  'Concluído': 'bg-green-500',
                  'Aguardando Aprovação': 'bg-amber-500',
                  'Arquivado': 'bg-zinc-500',
                  'Em Andamento': 'bg-blue-500',
                };
                const color = statusColors[status] || 'bg-blue-500';

                return (
                  <div key={patient.id} className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-sans">
                    <div className="space-y-0.5">
                      <div className="font-bold text-zinc-800 uppercase flex items-center gap-1.5">
                        {patient.name}
                        <span className={`w-1.5 h-1.5 rounded-full ${color} shadow-sm`} />
                      </div>
                      <div className="text-[10.5px] text-zinc-500 leading-normal font-medium">
                        Etapa Atual: <strong className="text-zinc-700">{status}</strong>
                      </div>
                      {patient.createdTime && (
                        <div className="text-[10px] text-zinc-400 font-mono">
                          Criado em: {new Date(patient.createdTime).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">VALOR LÍQUIDO</p>
                        <p className="font-bold text-[#8B0000] text-sm font-mono leading-none">
                          {patient.extractedTotal ? patient.extractedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                        </p>
                      </div>
                      <button
                        onClick={() => onNavigateToPlanning(patient.name, status)}
                        className="p-2 border border-zinc-200 hover:border-[#8B0000] rounded-xl hover:bg-[#FAF8F5] transition-all flex items-center gap-1 text-[10.5px] text-[#8B0000] font-bold"
                      >
                        Abrir Orçamento
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

    </div>

      {/* Change Patient Association Modal */}
      {isChangePatientOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-gradient-to-r from-[#8B0000] to-[#5C0000] text-white">
              <div>
                <h3 className="font-serif font-bold text-lg">Associar / Alterar Paciente</h3>
                <p className="text-xs text-white/80 mt-1">
                  Agendamento: <span className="font-semibold">{appointmentToChange?.originalSummary}</span>
                </p>
              </div>
              <button 
                onClick={() => { setIsChangePatientOpen(false); setAppointmentToChange(null); }}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-zinc-100 bg-zinc-50">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Pesquisar por nome ou WhatsApp..."
                  value={patientSearchQuery}
                  onChange={(e) => setPatientSearchQuery(e.target.value)}
                  className="w-full bg-white border border-zinc-200 text-zinc-800 placeholder-zinc-400 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C09553] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredPatientsForChange.length > 0 ? (
                filteredPatientsForChange.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => handleAssociatePatient(p)}
                    className="w-full text-left p-3 hover:bg-zinc-50 rounded-xl flex items-center gap-3 transition-colors border border-transparent hover:border-zinc-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000] font-bold shrink-0">
                      {p.name ? p.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="truncate flex-1">
                      <p className="text-sm font-bold text-zinc-800 truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{p.mobile || p.phone || 'Sem telefone'}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-zinc-500 font-medium">
                  Nenhum paciente encontrado
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button
                onClick={() => { setIsChangePatientOpen(false); setAppointmentToChange(null); }}
                className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
