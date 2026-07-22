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
  XCircle,
  CreditCard,
  Wallet,
  QrCode,
  CheckCircle2,
  Image as ImageIcon,
  Tag
} from 'lucide-react';
import { motion } from 'motion/react';
import { ClinicSettings, TreatmentProposal, CRMPatient, CRMClinicalHistory, PaymentRecord } from '../types';
import { listCalendarEvents, deleteCalendarEvent } from '../lib/calendar';
import { getSupabaseCRMDatabase, saveSupabaseCRMDatabase } from '../lib/supabaseCrm';
import { addDays, subDays, format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AppointmentClinicalDrawer from './AppointmentClinicalDrawer';
import EventModal from './EventModal';

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
  onUpdateDailyRevenue?: (amount: number) => void;
}

interface Appointment {
  id: string;
  patientId?: string;
  patientName: string;
  originalSummary: string;
  time: string;
  service: string;
  status: 'Confirmado' | 'Pendente' | 'Cancelado' | 'Falta' | 'Reagendado' | 'Atendido';
  phone: string;
  proposalTotal?: number;
  estimatedValue?: number;
  linkedProcedureId?: string;
  linkedProcedureName?: string;
}

interface ReturnControl {
  id: string;
  patientName: string;
  lastVisit: string;
  nextRecallDate: string;
  status: 'Agendado' | 'Lembrete Enviado' | 'Confirmado' | 'Falta Registrada';
  phone: string;
}

function extractPhone(text: string): string {
  if (!text) return '';
  const waRegex = /(?:whatsapp|whats|tel|telefone|celular|fone|contato)(?:\s+do\s+paciente)?\s*:\s*([\d\s\-()]+)/i;
  const match = text.match(waRegex);
  if (match && match[1]) {
    const clean = match[1].replace(/\D/g, '');
    if (clean.length >= 8) return match[1].trim();
  }
  const phoneRegex = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}\s*[-.]?\s*\d{4}/g;
  const matches = text.match(phoneRegex);
  if (matches && matches.length > 0) {
    return matches[0].trim();
  }
  return '';
}

function isPatientAppointment(summary: string, description: string): boolean {
  const lowerSummary = (summary || '').toLowerCase();
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
  onUpdateDailyRevenue
}: DashboardViewProps) {
  
  const todayDateStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [returns, setReturns] = useState<ReturnControl[]>([]);
  const [realPatients, setRealPatients] = useState<any[]>([]);
  const [crmFullDb, setCrmFullDb] = useState<any>({ patients: [], appointments: [], clinical_history: [], tratamentos: [], odontograma: [], pagamentos: [] });
  const [loadingRealData, setLoadingRealData] = useState(false);
  const [selectedAgendaDate, setSelectedAgendaDate] = useState<Date>(new Date());
  const [loadingAgenda, setLoadingAgenda] = useState(false);

  // States for Drawer (Clinical History / Prontuário)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerAppointment, setDrawerAppointment] = useState<Appointment | null>(null);
  const [drawerPatient, setDrawerPatient] = useState<CRMPatient | null>(null);
  const [drawerClinicalHistory, setDrawerClinicalHistory] = useState<CRMClinicalHistory[]>([]);
  const [drawerGaleria, setDrawerGaleria] = useState<any[]>([]);
  const [drawerTreatmentPlan, setDrawerTreatmentPlan] = useState<any>(null);

  // States for Quick Payment Modal
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [paymentAppointment, setPaymentAppointment] = useState<Appointment | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito'>('PIX');
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [paymentDescription, setPaymentDescription] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // States for Event Modal (Create / Edit Appointment with Procedure link)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // States for changing patient association
  const [isChangePatientOpen, setIsChangePatientOpen] = useState(false);
  const [appointmentToChange, setAppointmentToChange] = useState<Appointment | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [agendaSearchQuery, setAgendaSearchQuery] = useState('');

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return realPatients.filter((p: any) => p.name?.toLowerCase().includes(q) || p.appProperties?.phone?.includes(q));
  }, [searchQuery, realPatients]);

  const filteredAppointments = useMemo(() => {
    if (!agendaSearchQuery.trim()) return appointments;
    const q = agendaSearchQuery.toLowerCase();
    return appointments.filter((appt) => 
      (appt.patientName || '').toLowerCase().includes(q) || 
      (appt.service || '').toLowerCase().includes(q) || 
      (appt.phone || '').includes(q)
    );
  }, [agendaSearchQuery, appointments]);

  // Calculate Faturamento Programado Diário (Sum of non-cancelled appointments)
  const dailyScheduledRevenue = useMemo(() => {
    return appointments
      .filter(a => a.status !== 'Cancelado')
      .reduce((sum, a) => sum + (a.estimatedValue || 0), 0);
  }, [appointments]);

  useEffect(() => {
    if (onUpdateDailyRevenue) {
      onUpdateDailyRevenue(dailyScheduledRevenue);
    }
  }, [dailyScheduledRevenue, onUpdateDailyRevenue]);

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

  const loadRealDashboardData = async () => {
    setLoadingRealData(true);
    try {
      const db = await getSupabaseCRMDatabase();
      setCrmFullDb(db);
      const drivePatients = db.patients || [];
      const enriched = await enrichPatients(drivePatients);
      setRealPatients(enriched);
    } catch (err) {
      console.warn('Dashboard Patient folders load skipped:', err);
      setRealPatients([]);
    } flex: {
      setLoadingRealData(false);
    }
  };

  useEffect(() => {
    loadRealDashboardData();
  }, []);

  const fetchAgenda = async () => {
    setLoadingAgenda(true);
    try {
      const startOfDay = new Date(selectedAgendaDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedAgendaDate);
      endOfDay.setHours(23, 59, 59, 999);

      const calData = await listCalendarEvents(startOfDay, endOfDay);
      const crmData = await getSupabaseCRMDatabase();
      setCrmFullDb(crmData);
      if (!crmData.patients) crmData.patients = [];
      if (!crmData.appointments) crmData.appointments = [];

      let dbChanged = false;
      const appts: Appointment[] = [];

      if (calData && calData.items) {
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
              phone: '',
              estimatedValue: 0
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

          // Calculate or extract estimated procedure value
          let estVal = associatedAppt?.estimatedValue;
          if (estVal === undefined || estVal === null) {
            // Try to extract value from description or patient plan
            const valMatch = rawDesc.match(/R\$\s*([\d.,]+)/i) || eventSummary.match(/R\$\s*([\d.,]+)/i);
            if (valMatch && valMatch[1]) {
              estVal = parseFloat(valMatch[1].replace('.', '').replace(',', '.'));
            } else {
              // Default estimate per consulta if patient has plan
              estVal = 200;
            }
          }

          appts.push({
            id: eventId,
            patientId: patient?.id,
            patientName: patient?.name || eventSummary,
            originalSummary: eventSummary,
            time: timeStr,
            service: associatedAppt?.linkedProcedureName || cleanDesc,
            status: associatedAppt?.status || 'Confirmado',
            phone: patient?.mobile || patient?.phone || extractPhone(rawDesc),
            estimatedValue: Number(estVal) || 0,
            linkedProcedureId: associatedAppt?.linkedProcedureId,
            linkedProcedureName: associatedAppt?.linkedProcedureName
          });
        }

        if (dbChanged) {
          await saveSupabaseCRMDatabase(crmData);
          const enriched = await enrichPatients(crmData.patients);
          setRealPatients(enriched);
        }
      }

      // Also check local database appointments for this date not in Google Calendar
      const dateStr = format(selectedAgendaDate, 'yyyy-MM-dd');
      const extraDbAppts = (crmData.appointments || []).filter((a: any) => a.date === dateStr && !appts.some(ex => ex.id === a.id));
      for (const extra of extraDbAppts) {
        appts.push({
          id: extra.id,
          patientId: extra.patientId,
          patientName: extra.patientName || 'Paciente',
          originalSummary: extra.patientName || 'Consulta',
          time: extra.time || '10:00',
          service: extra.linkedProcedureName || extra.observations || 'Consulta Odontológica',
          status: extra.status || 'Confirmado',
          phone: '',
          estimatedValue: extra.estimatedValue || 200,
          linkedProcedureId: extra.linkedProcedureId,
          linkedProcedureName: extra.linkedProcedureName
        });
      }

      setAppointments(appts);
    } catch (err) {
      console.warn('Dashboard Calendar load skipped:', err);
      setAppointments([]);
    } finally {
      setLoadingAgenda(false);
    }
  };

  useEffect(() => {
    fetchAgenda();
  }, [selectedAgendaDate]);

  // Helper to derive Active Treatment Status for row badges
  const getActiveTreatmentInfo = (patientId?: string) => {
    if (!patientId || !crmFullDb) {
      return { stage: '⚪ Sem plano', stageColor: 'bg-zinc-100 text-zinc-600 border-zinc-200', mappedTeeth: 0, openProcs: 0 };
    }
    
    const patientTrat = (crmFullDb.tratamentos || []).filter((t: any) => t.patientId === patientId);
    const latestTrat = patientTrat[patientTrat.length - 1];
    const proposalStatus = latestTrat?.proposal?.status || 'Sem plano';

    const patientOdont = (crmFullDb.odontograma || []).filter((o: any) => o.patientId === patientId);
    const latestOdont = patientOdont[patientOdont.length - 1];

    let mappedTeeth = 0;
    let openProcs = 0;

    if (latestOdont?.sections) {
      const teethSet = new Set<number>();
      latestOdont.sections.forEach((sec: any) => {
        sec.markers?.forEach((m: any) => {
          if (m.toothNumber) teethSet.add(m.toothNumber);
          if (m.procedureInstances) {
            m.procedureInstances.forEach((inst: any) => {
              if ((inst.status === 'A realizar' || inst.status === 'Em andamento') && !inst.paid) {
                openProcs++;
              }
            });
          }
        });
      });
      mappedTeeth = teethSet.size;
    }

    let stage = '🔴 Aberto';
    let stageColor = 'bg-rose-50 text-rose-800 border-rose-200';

    if (proposalStatus.includes('Aprovado') || proposalStatus.includes('Concluído')) {
      stage = '🟢 Aprovado';
      stageColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (proposalStatus.includes('Em Andamento')) {
      stage = '🔄 Em Andamento';
      stageColor = 'bg-blue-50 text-blue-800 border-blue-200';
    } else if (proposalStatus === 'Sem plano') {
      stage = '⚪ Sem plano';
      stageColor = 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }

    return { stage, stageColor, mappedTeeth, openProcs };
  };

  // Open Drawer Handler for Clinical History & Photos
  const handleOpenDrawer = async (appt: Appointment) => {
    setDrawerAppointment(appt);
    setIsDrawerOpen(true);

    try {
      const crmData = await getSupabaseCRMDatabase();
      const pId = appt.patientId;
      
      let pObj = (crmData.patients || []).find((p: any) => p.id === pId || p.name?.toUpperCase() === appt.patientName.toUpperCase());
      if (!pObj) {
        pObj = {
          id: pId || `pat_${Date.now()}`,
          name: appt.patientName,
          phone: appt.phone,
          mobile: appt.phone
        };
      }
      setDrawerPatient(pObj);

      const history = (crmData.clinical_history || []).filter((h: any) => h.patientId === pObj.id);
      setDrawerClinicalHistory(history);

      const galeria = (crmData.galeria || []).filter((g: any) => g.patientId === pObj.id);
      setDrawerGaleria(galeria);

      const latestOdont = (crmData.odontograma || []).filter((o: any) => o.patientId === pObj.id).pop();
      const latestTrat = (crmData.tratamentos || []).filter((t: any) => t.patientId === pObj.id).pop();
      setDrawerTreatmentPlan({
        proposal: latestTrat?.proposal || null,
        sections: latestOdont?.sections || null
      });

    } catch (err) {
      console.error('Erro ao abrir gaveta clínica:', err);
    }
  };

  // Save Clinical Evolution Note from Drawer
  const handleAddClinicalNote = async (note: { proceduresPerformed: string; treatmentEvolution: string; observations?: string }) => {
    if (!drawerAppointment) return;
    const pId = drawerPatient?.id || drawerAppointment.patientId || `pat_${Date.now()}`;
    const newHistoryItem: CRMClinicalHistory = {
      id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      patientId: pId,
      date: format(new Date(), 'yyyy-MM-dd HH:mm'),
      proceduresPerformed: note.proceduresPerformed,
      treatmentEvolution: note.treatmentEvolution,
      observations: note.observations || ''
    };

    const crmData = await getSupabaseCRMDatabase();
    if (!crmData.clinical_history) crmData.clinical_history = [];
    crmData.clinical_history.push(newHistoryItem);
    await saveSupabaseCRMDatabase(crmData);

    setDrawerClinicalHistory(prev => [newHistoryItem, ...prev]);
  };

  // Open Quick Payment Registration Modal
  const handleOpenQuickPayment = (appt: Appointment) => {
    setPaymentAppointment(appt);
    setPaymentAmount(appt.estimatedValue || 200);
    setPaymentMethod('PIX');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setPaymentDescription(appt.linkedProcedureName || appt.service || 'Pagamento de Consulta Odontológica');
    setIsQuickPaymentOpen(true);
  };

  // Synchronized 4-Step Payment Execution
  const handleConfirmQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAppointment) return;

    setIsProcessingPayment(true);
    try {
      const appt = paymentAppointment;
      const paymentId = `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const pId = appt.patientId || `pat_${Date.now()}`;

      const newPaymentRecord: PaymentRecord = {
        id: paymentId,
        patientId: pId,
        patientName: appt.patientName,
        date: paymentDate,
        amount: Number(paymentAmount) || 0,
        paymentMethod: paymentMethod,
        status: 'Pago',
        description: paymentDescription
      };

      // 1) Save PaymentRecord in `agnaldo_dent_financeiro` local storage
      let localPayments: PaymentRecord[] = [];
      try {
        const storedStr = localStorage.getItem('agnaldo_dent_financeiro');
        if (storedStr) localPayments = JSON.parse(storedStr);
      } catch (e) {
        console.warn('Error reading local payments:', e);
      }
      localPayments.push(newPaymentRecord);
      localStorage.setItem('agnaldo_dent_financeiro', JSON.stringify(localPayments));

      // Load Supabase CRM Database
      const crmData = await getSupabaseCRMDatabase();
      if (!crmData.pagamentos) crmData.pagamentos = [];
      if (!crmData.odontograma) crmData.odontograma = [];
      if (!crmData.tratamentos) crmData.tratamentos = [];
      if (!crmData.appointments) crmData.appointments = [];

      // 2) Save to Supabase crm_data.pagamentos
      crmData.pagamentos.push(newPaymentRecord);

      // 3) Update procedureInstances.paid = true with paymentMethod and paymentDate
      const patientOdonts = crmData.odontograma.filter((o: any) => o.patientId === pId);
      if (patientOdonts.length > 0) {
        const latestOdont = patientOdonts[patientOdonts.length - 1];
        if (latestOdont && latestOdont.sections) {
          latestOdont.sections.forEach((sec: any) => {
            sec.markers?.forEach((m: any) => {
              if (m.procedureInstances) {
                m.procedureInstances.forEach((inst: any) => {
                  if (!inst.paid) {
                    inst.paid = true;
                    inst.paymentMethod = paymentMethod;
                    inst.paymentDate = paymentDate;
                    inst.status = 'Realizado';
                  }
                });
              }
            });
          });
        }
      }

      // 4) Update proposal.status to 'Aprovado (paciente pagou)' and appointment status to 'Atendido'
      const patientTrats = crmData.tratamentos.filter((t: any) => t.patientId === pId);
      if (patientTrats.length > 0) {
        const latestTrat = patientTrats[patientTrats.length - 1];
        if (latestTrat && latestTrat.proposal) {
          latestTrat.proposal.status = 'Aprovado (paciente pagou)';
          latestTrat.proposal.paymentMethod = paymentMethod;
        }
      }

      // Update active proposal in localStorage
      try {
        const currentPropStr = localStorage.getItem('agnaldo_dent_proposal');
        if (currentPropStr) {
          const propObj = JSON.parse(currentPropStr);
          propObj.status = 'Aprovado (paciente pagou)';
          propObj.paymentMethod = paymentMethod;
          localStorage.setItem('agnaldo_dent_proposal', JSON.stringify(propObj));
        }
      } catch (e) {
        // Ignore
      }

      // Update appointment status to 'Atendido' in crmData.appointments
      const apptIdx = crmData.appointments.findIndex((a: any) => a.id === appt.id);
      if (apptIdx >= 0) {
        crmData.appointments[apptIdx].status = 'Atendido';
        crmData.appointments[apptIdx].updatedAt = new Date().toISOString();
      } else {
        crmData.appointments.push({
          id: appt.id,
          patientId: pId,
          patientName: appt.patientName,
          date: format(selectedAgendaDate, 'yyyy-MM-dd'),
          time: appt.time,
          status: 'Atendido',
          estimatedValue: paymentAmount,
          linkedProcedureName: appt.linkedProcedureName || appt.service,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      await saveSupabaseCRMDatabase(crmData);
      setCrmFullDb(crmData);

      // Local state update
      setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: 'Atendido' } : a));

      setIsQuickPaymentOpen(false);
      setPaymentAppointment(null);
    } catch (err: any) {
      console.error('Erro ao registrar pagamento:', err);
      alert('Erro ao registrar pagamento: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const updateAppointmentStatus = async (apptId: string, patientId: string | undefined, newStatus: Appointment['status']) => {
    setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status: newStatus } : a));
    if (!patientId) return;

    try {
      const crmData = await getSupabaseCRMDatabase();
      if (!crmData.appointments) crmData.appointments = [];

      const apptIdx = crmData.appointments.findIndex((a: any) => a.id === apptId);
      if (apptIdx > -1) {
        crmData.appointments[apptIdx].status = newStatus;
        crmData.appointments[apptIdx].updatedAt = new Date().toISOString();
      } else {
        const currentAppt = appointments.find(a => a.id === apptId);
        if (currentAppt) {
          crmData.appointments.push({
            id: apptId,
            patientId: patientId,
            patientName: currentAppt.patientName,
            date: format(selectedAgendaDate, 'yyyy-MM-dd'),
            time: currentAppt.time,
            status: newStatus,
            observations: currentAppt.service,
            estimatedValue: currentAppt.estimatedValue || 0,
            linkedProcedureName: currentAppt.linkedProcedureName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      await saveSupabaseCRMDatabase(crmData);
      setCrmFullDb(crmData);
    } catch (error) {
      console.error("Erro ao salvar status de comparecimento no Supabase:", error);
    }
  };

  const sendWhatsAppConfirmation = (appt: Appointment) => {
    const message = `Olá, ${appt.patientName}! Gostaríamos de confirmar a sua consulta de *${appt.service}* agendada para hoje às *${appt.time}* com o *${clinicSettings.doctorName}*.\n\n📍 Endereço: ${clinicSettings.address}\n(Ref: ${clinicSettings.referencePoint})\n\nPor favor, responda confirmando sua presença. Ficamos no aguardo!`;
    const cleanPhone = appt.phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    updateAppointmentStatus(appt.id, appt.patientId, 'Confirmado');
  };

  const toggleAppointmentStatus = (appt: Appointment) => {
    const nextStatusMap: Record<Appointment['status'], Appointment['status']> = {
      'Confirmado': 'Falta',
      'Falta': 'Pendente',
      'Pendente': 'Confirmado',
      'Cancelado': 'Pendente',
      'Reagendado': 'Pendente',
      'Atendido': 'Confirmado'
    };
    const nextStatus = nextStatusMap[appt.status] || 'Confirmado';
    updateAppointmentStatus(appt.id, appt.patientId, nextStatus);
  };

  const handleRescheduleAppointment = (appt: Appointment) => {
    updateAppointmentStatus(appt.id, appt.patientId, 'Reagendado');
    onOpenCalendar();
  };

  const handleCancelAppointmentStatus = (appt: Appointment) => {
    updateAppointmentStatus(appt.id, appt.patientId, 'Cancelado');
  };

  const handleDeleteAppointment = async (id: string, name: string) => {
    if (window.confirm(`Deseja realmente cancelar e apagar definitivamente o agendamento de ${name}?`)) {
      try {
        if (!id.startsWith('c-')) {
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

      const existingApptIdx = crmData.appointments.findIndex((a: any) => a.id === apptId);
      const apptData = {
        id: apptId,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        date: format(selectedAgendaDate, 'yyyy-MM-dd'),
        time: appointmentToChange.time,
        status: appointmentToChange.status,
        observations: appointmentToChange.service,
        estimatedValue: appointmentToChange.estimatedValue || 200,
        createdAt: new Date().toISOString()
      };

      if (existingApptIdx >= 0) {
        crmData.appointments[existingApptIdx] = { ...crmData.appointments[existingApptIdx], ...apptData };
      } else {
        crmData.appointments.push(apptData);
      }

      await saveSupabaseCRMDatabase(crmData);
      setCrmFullDb(crmData);

      const enriched = await enrichPatients(crmData.patients);
      setRealPatients(enriched);
      
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
              Acompanhe a agenda diária, prontuários clínicos e o faturamento programado com o fluxo integrado de atendimento odontológico.
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
                           onMouseDown={() => {
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
                  onClick={() => setIsEventModalOpen(true)}
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

        {/* Floating current date & revenue indicator */}
        <div className="mt-6 pt-5 border-t border-[#FAF8F5]/10 flex flex-wrap gap-4 items-center justify-between text-xs text-[#FAF8F5]/80 font-mono">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#C09553]" />
            <span className="capitalize font-semibold text-zinc-100">{todayDateStr}</span>
          </div>

          <div className="flex items-center gap-2 bg-[#C09553]/20 border border-[#C09553]/40 px-3.5 py-1.5 rounded-full font-bold text-[#E1CDAC]">
            <DollarSign className="w-4 h-4 text-[#C09553]" />
            <span>FATURAMENTO PROGRAMADO DIÁRIO: R$ {dailyScheduledRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* ================= MAIN DASHBOARD GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMN 1: CLIENT AGENDA OF THE DAY (Left Side - 8 columns) */}
        <div className="lg:col-span-8 bg-white border border-[#E6DEC9] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#B48C4D]" />
              <h3 className="font-serif font-bold text-[#8B0000] text-base leading-none">
                Agenda {isToday(selectedAgendaDate) ? 'do Dia' : format(selectedAgendaDate, "dd 'de' MMM", { locale: ptBR })}
              </h3>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Date switcher */}
              <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-xl p-0.5 shrink-0">
                <button 
                  onClick={() => setSelectedAgendaDate(subDays(selectedAgendaDate, 1))}
                  className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="Dia Anterior"
                >
                  <ChevronLeft className="w-4 h-4 text-zinc-500 hover:text-[#8B0000]" />
                </button>
                <button 
                  onClick={() => setSelectedAgendaDate(new Date())}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase hover:bg-white text-zinc-600 rounded-lg transition-colors cursor-pointer"
                >
                  Hoje
                </button>
                <button 
                  onClick={() => setSelectedAgendaDate(addDays(selectedAgendaDate, 1))}
                  className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="Próximo Dia"
                >
                  <ChevronRight className="w-4 h-4 text-zinc-500 hover:text-[#8B0000]" />
                </button>
              </div>

              {/* Search box */}
              <div className="relative flex-1 sm:w-48 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Filtrar agenda..."
                  value={agendaSearchQuery}
                  onChange={(e) => setAgendaSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50 hover:bg-zinc-100/50 border border-zinc-200 text-zinc-800 placeholder-zinc-400 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#C09553] focus:border-[#C09553] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Status & Consultas Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 pb-1">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-2 text-center">
              <span className="text-[9px] font-extrabold uppercase text-zinc-400 block">Total Consultas</span>
              <span className="text-sm font-bold text-zinc-800 font-mono">{appointments.length}</span>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-100/70 rounded-xl p-2 text-center">
              <span className="text-[9px] font-extrabold uppercase text-emerald-600 block">Confirmadas</span>
              <span className="text-sm font-bold text-emerald-700 font-mono">
                {appointments.filter(a => a.status === 'Confirmado').length}
              </span>
            </div>
            <div className="bg-rose-50/50 border border-rose-100/70 rounded-xl p-2 text-center">
              <span className="text-[9px] font-extrabold uppercase text-rose-600 block">Faltas</span>
              <span className="text-sm font-bold text-rose-700 font-mono">
                {appointments.filter(a => a.status === 'Falta').length}
              </span>
            </div>
            <div className="bg-amber-50/50 border border-amber-100/70 rounded-xl p-2 text-center">
              <span className="text-[9px] font-extrabold uppercase text-amber-600 block">Pendentes</span>
              <span className="text-sm font-bold text-amber-700 font-mono">
                {appointments.filter(a => a.status === 'Pendente').length}
              </span>
            </div>
          </div>

          {/* AGENDA TABLE */}
          <div className="divide-y divide-zinc-100 flex-1 overflow-x-auto">
            <table className="w-full text-left font-sans text-xs min-w-[640px]">
              <thead>
                <tr className="text-zinc-400 uppercase font-bold text-[10px] tracking-wider border-b border-zinc-100">
                  <th className="py-2.5">Horário</th>
                  <th className="py-2.5">Paciente & Prontuário</th>
                  <th className="py-2.5">Estágio do Plano</th>
                  <th className="py-2.5">Procedimento & Valor</th>
                  <th className="py-2.5 text-center">Status</th>
                  <th className="py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loadingAgenda ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Loader2 className="w-8 h-8 text-[#C09553] animate-spin mb-3" />
                        <p className="text-zinc-600 font-semibold mb-1">Carregando agendamentos...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 bg-[#FAF8F5] rounded-full flex items-center justify-center mb-3">
                          <Calendar className="w-6 h-6 text-zinc-300" />
                        </div>
                        <p className="text-zinc-600 font-semibold mb-1">Nenhum agendamento encontrado</p>
                        <p className="text-zinc-400 text-[11px] max-w-xs">Os eventos agendados aparecerão automaticamente aqui.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((appt) => {
                    const treatmentInfo = getActiveTreatmentInfo(appt.patientId);

                    return (
                      <tr key={appt.id} className="hover:bg-[#FAF8F5]/60 transition-all group">
                        {/* Time */}
                        <td className="py-3.5 font-bold font-mono text-[#8B0000] text-sm">
                          {appt.time}
                        </td>
                        
                        {/* Patient detail & Prontuário Button */}
                        <td className="py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="font-bold text-zinc-800 uppercase cursor-pointer hover:text-[#8B0000] hover:underline"
                              onClick={() => onOpenPatient(appt.patientName)}
                            >
                              {appt.patientName}
                            </span>
                            <button
                              onClick={() => handleOpenDrawer(appt)}
                              className="p-1 text-zinc-400 hover:text-[#8B0000] hover:bg-[#8B0000]/10 rounded-md transition-colors cursor-pointer"
                              title="Abrir Prontuário & Evolução Clínica"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {appt.originalSummary && appt.originalSummary.toUpperCase() !== appt.patientName.toUpperCase() && (
                            <div className="text-[9px] text-[#C09553] font-medium mt-0.5 truncate max-w-[160px]" title={`Agenda: ${appt.originalSummary}`}>
                              Agenda: {appt.originalSummary}
                            </div>
                          )}
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{appt.phone || 'Sem celular'}</div>
                        </td>

                        {/* Active Treatment Status Badge */}
                        <td className="py-3.5">
                          <button
                            onClick={() => handleOpenDrawer(appt)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9.5px] font-bold border transition-colors cursor-pointer ${treatmentInfo.stageColor}`}
                            title="Clique para ver o prontuário completo"
                          >
                            <span>{treatmentInfo.stage}</span>
                            {treatmentInfo.mappedTeeth > 0 && <span className="opacity-80">• {treatmentInfo.mappedTeeth} Dentes</span>}
                            {treatmentInfo.openProcs > 0 && <span className="opacity-80">• {treatmentInfo.openProcs} Procs</span>}
                          </button>
                        </td>

                        {/* Service detail & Estimated Price */}
                        <td className="py-3.5">
                          <div className="font-medium text-zinc-700 text-xs truncate max-w-[180px]" title={appt.service}>
                            {appt.service}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1">
                            <span className="text-[10px] text-zinc-400 uppercase font-bold">Est:</span>
                            <span className="text-xs font-bold font-mono text-[#8B0000] bg-rose-50 border border-rose-200/80 px-1.5 py-0.2 rounded">
                              R$ {(appt.estimatedValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </td>

                        {/* Comparecimento state toggle */}
                        <td className="py-3.5 text-center">
                          <button
                            onClick={() => toggleAppointmentStatus(appt)}
                            className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-bold border cursor-pointer transition-colors shadow-2xs ${
                              appt.status === 'Confirmado'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : appt.status === 'Atendido'
                                ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                                : appt.status === 'Falta'
                                ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                : appt.status === 'Reagendado'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
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
                            
                            {/* Quick Payment Action Button */}
                            <button
                              onClick={() => handleOpenQuickPayment(appt)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="Registrar Pagamento Rápido"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>Pagar</span>
                            </button>

                            <button
                              onClick={() => sendWhatsAppConfirmation(appt)}
                              className="p-1 px-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg border border-green-200 hover:border-green-300 transition-colors flex items-center justify-center cursor-pointer"
                              title="Confirmar via WhatsApp"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onNavigateToPlanning(appt.patientName)}
                              className="px-2.5 py-1 bg-[#8B0000] text-white hover:bg-[#6c1b26] transition-colors font-bold text-[10px] rounded cursor-pointer"
                              title="Abrir Planejamento Odontológico"
                            >
                              Atender
                            </button>

                            <button
                              onClick={() => handleOpenChangePatient(appt)}
                              className="p-1 px-1.5 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 rounded-lg border border-zinc-200 hover:border-zinc-300 transition-colors flex items-center justify-center cursor-pointer"
                              title="Alterar / Associar Paciente"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleRescheduleAppointment(appt)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200 cursor-pointer"
                              title="Reagendar Consulta"
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteAppointment(appt.id, appt.patientName)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Apagar Agendamento"
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

        {/* COLUMN 2: FIDELIZATION & RETURN RECALL CONTROL (Right Side - 4 columns) */}
        <div className="lg:col-span-4 bg-white border border-[#E6DEC9] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col space-y-4">
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
                <p className="text-zinc-600 font-semibold mb-1">Agenda de Recall em Dia</p>
                <p className="text-zinc-400 text-[11px] max-w-[200px]">Nenhum paciente pendente para retorno de rotina no momento.</p>
              </div>
            ) : (
              returns.map((ret) => {
                return (
                  <div key={ret.id} className="pt-3 first:pt-0 flex justify-between items-start gap-4 text-xs font-sans">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div 
                        className="font-bold text-zinc-800 uppercase text-xs truncate cursor-pointer hover:text-[#8B0000] hover:underline"
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* APPOINTMENT CLINICAL DRAWER (SLIDE-OVER) */}
      <AppointmentClinicalDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        appointment={drawerAppointment}
        patient={drawerPatient}
        clinicalHistory={drawerClinicalHistory}
        galeriaList={drawerGaleria}
        treatmentPlan={drawerTreatmentPlan}
        onAddClinicalNote={handleAddClinicalNote}
        onRefreshData={fetchAgenda}
        onNavigateToPlanning={onNavigateToPlanning}
      />

      {/* QUICK PAYMENT REGISTRATION MODAL */}
      {isQuickPaymentOpen && paymentAppointment && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 animate-fade-in">
            <div className="p-5 bg-gradient-to-r from-[#4E1119] to-[#8B0000] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#C09553]" />
                <h3 className="font-serif font-bold text-lg">Registrar Pagamento</h3>
              </div>
              <button 
                onClick={() => { setIsQuickPaymentOpen(false); setPaymentAppointment(null); }}
                className="p-1 hover:bg-white/10 rounded-lg text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmQuickPayment} className="p-5 space-y-4">
              <div className="bg-[#FAF8F5] border border-[#E6DEC9] rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider">Paciente / Agendamento</span>
                <p className="text-sm font-bold text-zinc-800 uppercase">{paymentAppointment.patientName}</p>
                <p className="text-xs text-zinc-600">{paymentAppointment.service}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 block">Valor Pago (R$)</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 font-bold text-[#8B0000] text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full font-mono font-bold text-base text-[#8B0000] pl-10 pr-4 py-2.5 border border-zinc-300 rounded-xl focus:border-[#C09553] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 block">Forma de Pagamento</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-xs font-semibold bg-white focus:border-[#C09553] outline-none"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 block">Data do Pagamento</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-semibold bg-white focus:border-[#C09553] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 block">Descrição / Observação</label>
                <input
                  type="text"
                  placeholder="Ex: Quitação da consulta / procedimento"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:border-[#C09553] outline-none"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-800 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Atualização Sincronizada em 4 Etapas:
                </span>
                <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-emerald-900">
                  <li>Registra no Financeiro Local (`agnaldo_dent_financeiro`)</li>
                  <li>Salva no Supabase `crm_data.pagamentos`</li>
                  <li>Marca procedimento como pago (`procedureInstances.paid = true`)</li>
                  <li>Atualiza status do orçamento para "Aprovado" e consulta para "Atendido"</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsQuickPaymentOpen(false); setPaymentAppointment(null); }}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sincronizando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Pagamento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENT MODAL (NEW / EDIT APPOINTMENT) */}
      {isEventModalOpen && (
        <EventModal
          onClose={() => setIsEventModalOpen(false)}
          onSaved={() => {
            setIsEventModalOpen(false);
            fetchAgenda();
          }}
          selectedDate={selectedAgendaDate}
        />
      )}

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
