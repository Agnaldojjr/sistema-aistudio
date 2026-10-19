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
  status: 'Confirmado' | 'Pendente' | 'Cancelado' | 'Falta' | 'Faltou' | 'Agendado' | 'Reagendado' | 'Atendido' | 'Realizado' | 'Concluído' | string;
  phone: string;
  proposalTotal?: number;
  estimatedValue?: number;
  linkedProcedureId?: string;
  linkedProcedureName?: string;
  suggestedPatients?: any[];
}

export const parseCurrency = (v: any): number => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (!v) return 0;
  return parseFloat(String(v).replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
};

interface ReturnControl {
  id: string;
  patientName: string;
  lastVisit: string;
  nextRecallDate: string;
  status: 'Agendado' | 'Lembrete Enviado' | 'Confirmado' | 'Falta Registrada';
  phone: string;
}

export function normalizePhoneDigits(phone: string): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  if ((digits.length === 11 || digits.length === 12) && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

export function phonesMatch(phoneA?: string, phoneB?: string): boolean {
  const a = normalizePhoneDigits(phoneA || '');
  const b = normalizePhoneDigits(phoneB || '');
  if (a.length < 8 || b.length < 8) return false;
  if (a === b) return true;

  // Se ambos possuem DDD (10 ou 11 dígitos), exige mesmo DDD + últimos 8 dígitos iguais (cobre nono dígito)
  if (a.length >= 10 && b.length >= 10) {
    const dddA = a.slice(0, 2);
    const dddB = b.slice(0, 2);
    return dddA === dddB && a.slice(-8) === b.slice(-8);
  }

  // Se um deles tem apenas o número sem DDD (8 ou 9 dígitos), compara os últimos 8 dígitos
  return a.slice(-8) === b.slice(-8);
}

export function extractPhone(text: string): string {
  if (!text) return '';

  // 1. Links diretos de WhatsApp (wa.me/55..., api.whatsapp.com/send?phone=...) ou tel:
  const linkMatch = text.match(/(?:wa\.me\/|phone=|tel:)(\+?\d[\d\s\-().]{7,18}\d)/i);
  if (linkMatch && linkMatch[1]) {
    const digits = linkMatch[1].replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) return linkMatch[1].trim();
  }

  // 2. Campos rotulados (WhatsApp:, Tel:, Celular:, Contato:, Fone:, etc.)
  const waRegex = /(?:whatsapp|whats|wpp|tel|telefone|celular|cel|fone|contato)(?:\s+do\s+paciente)?\s*[:=\-]?\s*(\+?\d[\d\s\-().]{7,20}\d)/i;
  const match = text.match(waRegex);
  if (match && match[1]) {
    const clean = match[1].replace(/\D/g, '');
    if (clean.length >= 8 && clean.length <= 15) return match[1].trim();
  }

  // Remove datas (YYYY-MM-DD, DD/MM/YYYY) e horas (HH:MM) para evitar falsos positivos
  const sanitizedText = text
    .replace(/\b\d{4}[-/]\d{2}[-/]\d{2}\b/g, ' ')
    .replace(/\b\d{2}[-/]\d{2}[-/]\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/R\$\s*[\d.,]+/gi, ' ');

  // 3. Padrão de telefone com DDI/DDD opcional: (31) 99999-9999, 31 99999 9999, +55 31 99999-9999, 99999-9999
  const phoneRegex = /(?:\+?55\s*[-.]?\s*)?(?:\(?\d{2}\)?\s*[-.]?\s*)?\b9?\d{4}\s*[-.\s]?\s*\d{4}\b/g;
  const matches = sanitizedText.match(phoneRegex);
  if (matches && matches.length > 0) {
    for (const candidate of matches) {
      const digits = candidate.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 13) {
        return candidate.trim();
      }
    }
  }

  return '';
}

export function extractPhoneFromCalendarEvent(item: any): string {
  if (!item) return '';
  const candidateTexts: string[] = [];

  if (item.description) candidateTexts.push(String(item.description));
  if (item.summary) candidateTexts.push(String(item.summary));
  if (item.location) candidateTexts.push(String(item.location));

  if (Array.isArray(item.attendees)) {
    for (const att of item.attendees) {
      if (att.displayName) candidateTexts.push(String(att.displayName));
      if (att.comment) candidateTexts.push(String(att.comment));
      if (att.email) candidateTexts.push(String(att.email));
    }
  }

  if (item.extendedProperties) {
    const priv = item.extendedProperties.private || {};
    const shared = item.extendedProperties.shared || {};
    Object.values({ ...priv, ...shared }).forEach((val) => {
      if (val) candidateTexts.push(String(val));
    });
  }

  if (item.source?.title) candidateTexts.push(String(item.source.title));
  if (item.source?.url) candidateTexts.push(String(item.source.url));

  for (const text of candidateTexts) {
    const found = extractPhone(text);
    if (found) return found;
  }

  return '';
}

const GENERIC_DENTAL_TERMS = [
  'consulta', 'de', 'da', 'do', 'limpeza', 'avaliacao', 'retorno', 'orcamento', 'emergencia',
  'ortodontia', 'aparelho', 'revisao', 'procedimento', 'cirurgia', 'extracao',
  'clareamento', 'restauracao', 'canal', 'endodontia', 'periodontia', 'profilaxia',
  'implante', 'protese', 'botox', 'harmonizacao', 'facial', 'lente', 'resina',
  'porcelana', 'lentes', 'facetas', 'dr', 'dra', 'paciente', 'atendimento',
  'exame', 'raio-x', 'raiox', 'panoramica', 'periapical', 'tomografia', 'e', 'ou', 'com', 'urgencia', 'manutencao'
];

function isOnlyDentalTerms(text: string): boolean {
  const norm = (text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const words = norm.split(/[\s,.\-/|]+/).filter(w => w.length > 0);
  if (words.length === 0) return false;
  return words.every(w => GENERIC_DENTAL_TERMS.includes(w));
}

export function parseEventSummaryAndService(summary: string, cleanDesc: string): {
  cleanPatientName: string;
  extractedService: string;
} {
  let working = (summary || 'Consulta Sem Nome').trim();

  // Remove marcadores de origem como 📍 [CELULAR]
  working = working.replace(/^📍\s*\[CELULAR\]\s*/i, '').replace(/^\[CELULAR\]\s*/i, '').trim();

  // Remove telefones embutidos no título para não sujar o nome do paciente
  working = working
    .replace(/(?:whatsapp|whats|wpp|tel|telefone|celular|cel|fone|contato)\s*[:=\-]?\s*(?:\+?55\s*[-.]?\s*)?(?:\(?\d{2}\)?\s*[-.]?\s*)?\b9?\d{4}\s*[-.\s]?\s*\d{4}\b/gi, ' ')
    .replace(/(?:\+?55\s*[-.]?\s*)?(?:\(\d{2}\)|\b\d{2})\s*[-.]?\s*9?\d{4}\s*[-.\s]?\s*\d{4}\b/g, ' ')
    .replace(/\b9\d{4}\s*[-.\s]?\s*\d{4}\b/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  let rawNamePart = working;
  let extractedProc = '';

  // Separa "Fulano - Avaliação e Limpeza" ou "Fulano | Limpeza" ou "Fulano / Avaliação"
  const separatorMatch = working.match(/^(.+?)\s*(?:[-–—|/]|:\s+)\s*(.+)$/);
  if (separatorMatch) {
    const left = separatorMatch[1].trim();
    const right = separatorMatch[2].trim();

    // Caso o usuário tenha escrito "Avaliação - Fulano" (procedimento antes do nome)
    if (isOnlyDentalTerms(left) && !isOnlyDentalTerms(right)) {
      rawNamePart = right;
      extractedProc = left;
    } else {
      rawNamePart = left;
      extractedProc = right;
    }
  }

  // Remove prefixos comuns antes do nome ("Consulta com Fulano" -> "Fulano")
  const prefixes = [
    /^consulta\s+com\s+/i,
    /^consulta\s+de\s+/i,
    /^consulta\s+/i,
    /^paciente\s+/i,
    /^atendimento\s+/i,
  ];
  for (const prefRx of prefixes) {
    if (prefRx.test(rawNamePart)) {
      const stripped = rawNamePart.replace(prefRx, '').trim();
      if (stripped.length >= 2) {
        rawNamePart = stripped;
        break;
      }
    }
  }

  // Limpa pontuações residuais nas pontas
  const cleanPatientName = rawNamePart.replace(/^[\s\-–—|/:,]+|[\s\-–—|/:,]+$/g, '').trim() || working;

  const isGenericDesc = !cleanDesc || cleanDesc === 'Consulta Clínica' || cleanDesc === 'Agendamento via WhatsApp';
  let extractedService = cleanDesc || 'Consulta Clínica';
  if (extractedProc) {
    extractedService = isGenericDesc ? extractedProc : `${extractedProc} • ${cleanDesc}`;
  }

  return {
    cleanPatientName,
    extractedService
  };
}

function isPatientAppointment(summary: string, description: string): boolean {
  const lowerSummary = (summary || '').toLowerCase();
  const normalizedSummary = lowerSummary.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const blockedKeywords = ['reuniao', 'almoco', 'particular', 'bloqueio', 'compromisso', 'ferias', 'folga', 'curso', 'palestra', 'personal', 'maintenance'];
  for (const kw of blockedKeywords) {
    if (normalizedSummary.includes(kw)) {
      return false;
    }
  }

  if (isOnlyDentalTerms(normalizedSummary)) {
    return false;
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

  // States for changing / confirming patient association in CRM
  const [isChangePatientOpen, setIsChangePatientOpen] = useState(false);
  const [appointmentToChange, setAppointmentToChange] = useState<Appointment | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [newPatientLinkName, setNewPatientLinkName] = useState('');
  const [newPatientLinkPhone, setNewPatientLinkPhone] = useState('');
  const [pendingActionAfterLink, setPendingActionAfterLink] = useState<'none' | 'planning' | 'open_patient'>('none');
  const [isSavingPatientLink, setIsSavingPatientLink] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [agendaSearchQuery, setAgendaSearchQuery] = useState('');

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return realPatients.filter((p: any) => p.name?.toLowerCase().includes(q) || p.mobile?.includes(q) || p.phone?.includes(q) || p.appProperties?.phone?.includes(q));
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
      .reduce((sum, a) => sum + parseCurrency(a.estimatedValue), 0);
  }, [appointments]);

  useEffect(() => {
    if (onUpdateDailyRevenue) {
      onUpdateDailyRevenue(dailyScheduledRevenue);
    }
  }, [dailyScheduledRevenue, onUpdateDailyRevenue]);

  const enrichPatients = async (patientsList: any[]) => {
    try {
      const { getPatientFileUrlFromSupabase } = await import('../lib/storage');
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

          // Extrai telefone lendo TODOS os campos do evento (summary, description, location, attendees, extendedProperties)
          const extractedPhone = extractPhoneFromCalendarEvent(item);
          // Separa o Nome do Paciente do Procedimento (ex: "Fulano 31999999999 - Avaliação e Limpeza")
          const { cleanPatientName, extractedService } = parseEventSummaryAndService(eventSummary, cleanDesc);

          if (!isPatientAppointment(eventSummary, rawDesc)) {
            appts.push({
              id: eventId,
              patientName: eventSummary,
              originalSummary: eventSummary,
              time: timeStr,
              service: extractedService,
              status: 'Confirmado',
              phone: extractedPhone,
              estimatedValue: 0
            });
            continue;
          }

          let associatedAppt = crmData.appointments.find((a: any) => a.id === eventId);
          let patient: any = null;

          if (associatedAppt && associatedAppt.patientId) {
            patient = crmData.patients.find((p: any) => p.id === associatedAppt.patientId) || null;
          }

          const normCleanName = cleanPatientName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const suggestedPatients: any[] = [];

          if (!patient) {
            // Busca candidatos por telefone e por nome no CRM
            const phoneMatches = extractedPhone
              ? crmData.patients.filter((p: any) => phonesMatch(p.mobile || p.phone || p.appProperties?.phone, extractedPhone))
              : [];

            const nameMatches = crmData.patients.filter((p: any) => {
              const pNameClean = (p.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              if (!pNameClean || pNameClean.length < 2 || !normCleanName) return false;
              if (pNameClean === normCleanName) return true;
              if (pNameClean.startsWith(normCleanName + " ") || normCleanName.startsWith(pNameClean + " ")) return true;
              return false;
            });

            // Se bater Nome + Telefone em um paciente já existente (ou se houver match único de telefone), vincula ao paciente existente sem duplicar
            const exactPhoneAndNameMatch = phoneMatches.find((pm: any) => nameMatches.some((nm: any) => nm.id === pm.id));
            if (exactPhoneAndNameMatch) {
              patient = exactPhoneAndNameMatch;
            } else if (phoneMatches.length === 1 && nameMatches.length === 0) {
              patient = phoneMatches[0];
            }

            // Monta lista ordenada de sugestões para o modal de confirmação rápida (1B)
            const seenIds = new Set<string>();
            for (const p of [...phoneMatches, ...nameMatches]) {
              if (p && p.id && !seenIds.has(p.id)) {
                seenIds.add(p.id);
                suggestedPatients.push(p);
              }
            }

            // Se encontrou vínculo inequívoco com paciente já existente (Nome + Telefone), registra o vínculo do agendamento
            if (patient) {
              const newApptLink = {
                id: eventId,
                patientId: patient.id,
                patientName: patient.name,
                date: format(selectedAgendaDate, 'yyyy-MM-dd'),
                time: timeStr,
                status: associatedAppt?.status || 'Confirmado',
                observations: extractedService,
                createdAt: associatedAppt?.createdAt || new Date().toISOString()
              };

              if (associatedAppt) {
                const idx = crmData.appointments.findIndex((a: any) => a.id === eventId);
                crmData.appointments[idx] = { ...associatedAppt, ...newApptLink };
              } else {
                crmData.appointments.push(newApptLink);
              }
              dbChanged = true;
            }
            // IMPORTANTE (Regra 1B): NÃO cria pacientes automaticamente em crmData.patients!
          }

          // Calculate or extract estimated procedure value
          let estVal = associatedAppt?.estimatedValue;
          if (estVal === undefined || estVal === null) {
            const valMatch = rawDesc.match(/R\$\s*([\d.,]+)/i) || eventSummary.match(/R\$\s*([\d.,]+)/i);
            if (valMatch && valMatch[1]) {
              estVal = parseFloat(valMatch[1].replace('.', '').replace(',', '.'));
            } else {
              estVal = 200;
            }
          }

          appts.push({
            id: eventId,
            patientId: patient?.id,
            patientName: patient?.name || cleanPatientName.toUpperCase(),
            originalSummary: eventSummary,
            time: timeStr,
            service: associatedAppt?.linkedProcedureName || extractedService,
            status: associatedAppt?.status || 'Confirmado',
            phone: patient?.mobile || patient?.phone || extractedPhone,
            estimatedValue: Number(estVal) || 0,
            linkedProcedureId: associatedAppt?.linkedProcedureId,
            linkedProcedureName: associatedAppt?.linkedProcedureName,
            suggestedPatients
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

    const handleSync = () => fetchAgenda();
    window.addEventListener('appointments-updated', handleSync);
    return () => {
      window.removeEventListener('appointments-updated', handleSync);
    };
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
      const paymentId = appt.linkedProcedureId && appt.linkedProcedureId !== 'custom'
        ? `pay-proc-${appt.linkedProcedureId}`
        : `pay-appt-${appt.id}`;
      const pId = appt.patientId || `pat_${Date.now()}`;

      const parsedAmount = parseCurrency(paymentAmount);
      const newPaymentRecord: PaymentRecord = {
        id: paymentId,
        patientId: pId,
        patientName: appt.patientName,
        date: paymentDate,
        amount: parsedAmount,
        value: parsedAmount,
        paymentMethod: paymentMethod,
        method: paymentMethod,
        status: 'Pago',
        description: paymentDescription,
        appointmentId: appt.id,
        procedureId: appt.linkedProcedureId
      };

      // 1) Save PaymentRecord in `agnaldo_dent_financeiro` local storage with deduplication
      let localPayments: PaymentRecord[] = [];
      try {
        const storedStr = localStorage.getItem('agnaldo_dent_financeiro');
        if (storedStr) localPayments = JSON.parse(storedStr);
      } catch (e) {
        console.warn('Error reading local payments:', e);
      }
      const existingLocalIdx = localPayments.findIndex(p => p.id === paymentId || (appt.linkedProcedureId && p.procedureId === appt.linkedProcedureId) || (appt.id && p.appointmentId === appt.id));
      if (existingLocalIdx >= 0) {
        localPayments[existingLocalIdx] = { ...localPayments[existingLocalIdx], ...newPaymentRecord };
      } else {
        localPayments.push(newPaymentRecord);
      }
      localStorage.setItem('agnaldo_dent_financeiro', JSON.stringify(localPayments));
      window.dispatchEvent(new Event('local-storage'));

      // Load Supabase CRM Database
      const crmData = await getSupabaseCRMDatabase();
      if (!crmData.pagamentos) crmData.pagamentos = [];
      if (!crmData.odontograma) crmData.odontograma = [];
      if (!crmData.tratamentos) crmData.tratamentos = [];
      if (!crmData.appointments) crmData.appointments = [];

      // 2) Save to Supabase crm_data.pagamentos with deduplication
      const existingCrmIdx = crmData.pagamentos.findIndex((p: any) => p.id === paymentId || (appt.linkedProcedureId && p.procedureId === appt.linkedProcedureId) || (appt.id && p.appointmentId === appt.id));
      if (existingCrmIdx >= 0) {
        crmData.pagamentos[existingCrmIdx] = { ...crmData.pagamentos[existingCrmIdx], ...newPaymentRecord };
      } else {
        crmData.pagamentos.push(newPaymentRecord);
      }

      // 3) Update procedureInstances.paid = true targeting linked procedure
      const patientOdonts = crmData.odontograma.filter((o: any) => o.patientId === pId);
      if (patientOdonts.length > 0) {
        const latestOdont = patientOdonts[patientOdonts.length - 1];
        if (latestOdont && latestOdont.sections) {
          let targeted = false;
          latestOdont.sections.forEach((sec: any) => {
            sec.markers?.forEach((m: any) => {
              if (m.procedureInstances) {
                m.procedureInstances.forEach((inst: any) => {
                  if (appt.linkedProcedureId && appt.linkedProcedureId !== 'custom') {
                    if (inst.id === appt.linkedProcedureId) {
                      inst.paid = true;
                      inst.paymentMethod = paymentMethod;
                      inst.paymentDate = paymentDate;
                      inst.status = 'Realizado';
                      targeted = true;
                    }
                  } else if (!targeted && !inst.paid) {
                    inst.paid = true;
                    inst.paymentMethod = paymentMethod;
                    inst.paymentDate = paymentDate;
                    inst.status = 'Realizado';
                    targeted = true;
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
      window.dispatchEvent(new Event('appointments-updated'));

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
      window.dispatchEvent(new Event('appointments-updated'));
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
      'Faltou': 'Pendente',
      'Pendente': 'Confirmado',
      'Agendado': 'Confirmado',
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
        const crmData = await getSupabaseCRMDatabase();
        crmData.appointments = (crmData.appointments || []).filter((a: any) => a.id !== id);
        await saveSupabaseCRMDatabase(crmData);
        setCrmFullDb(crmData);
        setAppointments(prev => prev.filter(a => a.id !== id));
        window.dispatchEvent(new Event('appointments-updated'));
      } catch (err) {
        console.error("Erro ao deletar agendamento:", err);
        alert("Falha ao apagar o agendamento. Verifique sua conexão ou se você tem permissão.");
      }
    }
  };

  const handleOpenChangePatient = (appt: Appointment, nextAction: 'none' | 'planning' | 'open_patient' = 'none') => {
    setAppointmentToChange(appt);
    setNewPatientLinkName(appt.patientName || '');
    setNewPatientLinkPhone(appt.phone || '');
    setPendingActionAfterLink(nextAction);
    setPatientSearchQuery('');
    setIsChangePatientOpen(true);
  };

  const linkAppointmentsToPatientInDb = (crmData: any, targetAppt: Appointment, patientObj: any) => {
    const normTargetName = (targetAppt.patientName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const targetPhone = targetAppt.phone || newPatientLinkPhone;

    // Identifica todos os agendamentos do dia que pertencem a este mesmo paciente (mesmo ID, mesmo nome limpo ou mesmo telefone)
    const matchingAppts = appointments.filter(a => {
      if (a.id === targetAppt.id) return true;
      if (a.patientId) return false; // já vinculado
      const aNormName = (a.patientName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (normTargetName && aNormName === normTargetName) return true;
      if (targetPhone && a.phone && phonesMatch(a.phone, targetPhone)) return true;
      return false;
    });

    const linkedIds = new Set<string>();
    for (const apptItem of matchingAppts) {
      linkedIds.add(apptItem.id);
      const existingApptIdx = crmData.appointments.findIndex((a: any) => a.id === apptItem.id);
      const apptData = {
        id: apptItem.id,
        patientId: patientObj.id,
        patientName: patientObj.name,
        date: format(selectedAgendaDate, 'yyyy-MM-dd'),
        time: apptItem.time,
        status: apptItem.status,
        observations: apptItem.service,
        estimatedValue: apptItem.estimatedValue || 200,
        createdAt: new Date().toISOString()
      };

      if (existingApptIdx >= 0) {
        crmData.appointments[existingApptIdx] = { ...crmData.appointments[existingApptIdx], ...apptData };
      } else {
        crmData.appointments.push(apptData);
      }
    }

    return linkedIds;
  };

  const handleAssociatePatient = async (selectedPatient: any) => {
    if (!appointmentToChange || isSavingPatientLink) return;
    setIsSavingPatientLink(true);
    try {
      const crmData = await getSupabaseCRMDatabase();
      if (!crmData.patients) crmData.patients = [];
      if (!crmData.appointments) crmData.appointments = [];

      // Se o paciente no CRM ainda não tinha telefone e o agendamento possui telefone extraído, atualiza o cadastro
      const candidatePhone = (newPatientLinkPhone || appointmentToChange.phone || '').trim();
      const patIdx = crmData.patients.findIndex((p: any) => p.id === selectedPatient.id);
      let updatedPatientObj = selectedPatient;
      if (patIdx >= 0 && candidatePhone && !crmData.patients[patIdx].mobile && !crmData.patients[patIdx].phone) {
        crmData.patients[patIdx] = {
          ...crmData.patients[patIdx],
          phone: candidatePhone,
          mobile: candidatePhone,
          updatedAt: new Date().toISOString()
        };
        updatedPatientObj = crmData.patients[patIdx];
      }

      const linkedIds = linkAppointmentsToPatientInDb(crmData, appointmentToChange, updatedPatientObj);

      await saveSupabaseCRMDatabase(crmData);
      setCrmFullDb(crmData);

      const enriched = await enrichPatients(crmData.patients);
      setRealPatients(enriched);
      
      setAppointments(prev => prev.map(a => {
        if (linkedIds.has(a.id)) {
          return {
            ...a,
            patientId: updatedPatientObj.id,
            patientName: updatedPatientObj.name,
            phone: updatedPatientObj.mobile || updatedPatientObj.phone || candidatePhone,
            suggestedPatients: []
          };
        }
        return a;
      }));

      const actionToRun = pendingActionAfterLink;
      setIsChangePatientOpen(false);
      setAppointmentToChange(null);
      setPendingActionAfterLink('none');
      window.dispatchEvent(new Event('appointments-updated'));

      if (actionToRun === 'planning') {
        onNavigateToPlanning(updatedPatientObj.name);
      } else if (actionToRun === 'open_patient') {
        onOpenPatient(updatedPatientObj.name);
      }
    } catch (err: any) {
      alert('Erro ao associar paciente: ' + err.message);
    } finally {
      setIsSavingPatientLink(false);
    }
  };

  const handleCreateAndAssociatePatient = async () => {
    if (!appointmentToChange || isSavingPatientLink) return;
    const cleanName = (newPatientLinkName || appointmentToChange.patientName || '').trim().toUpperCase();
    if (!cleanName) {
      alert('Informe o nome do paciente.');
      return;
    }

    setIsSavingPatientLink(true);
    try {
      const crmData = await getSupabaseCRMDatabase();
      if (!crmData.patients) crmData.patients = [];
      if (!crmData.appointments) crmData.appointments = [];

      const cleanPhone = (newPatientLinkPhone || appointmentToChange.phone || '').trim();

      // Verifica se já existe exatamente esse paciente (por telefone + nome ou nome exato) para evitar duplicidade
      let targetPatient = crmData.patients.find((p: any) => {
        const pName = (p.name || '').trim().toUpperCase();
        if (cleanPhone && phonesMatch(p.mobile || p.phone, cleanPhone) && pName === cleanName) return true;
        return pName === cleanName && (!cleanPhone || !p.mobile || phonesMatch(p.mobile || p.phone, cleanPhone));
      });

      if (!targetPatient) {
        const newPatId = `pat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        targetPatient = {
          id: newPatId,
          name: cleanName,
          codigo_paciente: `COD-${Math.floor(1000 + Math.random() * 9000)}`,
          phone: cleanPhone,
          mobile: cleanPhone,
          healthInsurance: 'PARTICULAR',
          medicalRecord: '',
          observations: `Cadastrado via Agenda (${appointmentToChange.service || 'Consulta'})`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        crmData.patients.push(targetPatient);
      } else if (cleanPhone && !targetPatient.mobile && !targetPatient.phone) {
        targetPatient.phone = cleanPhone;
        targetPatient.mobile = cleanPhone;
        targetPatient.updatedAt = new Date().toISOString();
      }

      const linkedIds = linkAppointmentsToPatientInDb(crmData, appointmentToChange, targetPatient);

      await saveSupabaseCRMDatabase(crmData);
      setCrmFullDb(crmData);

      const enriched = await enrichPatients(crmData.patients);
      setRealPatients(enriched);

      setAppointments(prev => prev.map(a => {
        if (linkedIds.has(a.id)) {
          return {
            ...a,
            patientId: targetPatient.id,
            patientName: targetPatient.name,
            phone: targetPatient.mobile || targetPatient.phone || cleanPhone,
            suggestedPatients: []
          };
        }
        return a;
      }));

      const actionToRun = pendingActionAfterLink;
      setIsChangePatientOpen(false);
      setAppointmentToChange(null);
      setPendingActionAfterLink('none');
      window.dispatchEvent(new Event('appointments-updated'));

      if (actionToRun === 'planning') {
        onNavigateToPlanning(targetPatient.name);
      } else if (actionToRun === 'open_patient') {
        onOpenPatient(targetPatient.name);
      }
    } catch (err: any) {
      alert('Erro ao criar e vincular paciente: ' + err.message);
    } finally {
      setIsSavingPatientLink(false);
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
                             <p className="text-xs text-zinc-500 truncate">{p.mobile || p.phone || p.appProperties?.phone || 'Sem telefone'}</p>
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
                <div className="relative flex items-center justify-center">
                  <button 
                    onClick={(e) => {
                      const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                      if (input && input.showPicker) {
                        try {
                          input.showPicker();
                        } catch (err) {
                          // ignore fallback
                        }
                      }
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase hover:bg-white text-zinc-600 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {isToday(selectedAgendaDate) ? 'Hoje' : format(selectedAgendaDate, 'dd/MM/yyyy')}
                  </button>
                  <input
                    type="date"
                    className="absolute opacity-0 w-0 h-0 pointer-events-none"
                    value={format(selectedAgendaDate, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [year, month, day] = e.target.value.split('-').map(Number);
                        setSelectedAgendaDate(new Date(year, month - 1, day));
                      }
                    }}
                  />
                </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 pb-1">
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
            <div className="bg-blue-50/50 border border-blue-100/70 rounded-xl p-2 text-center">
              <span className="text-[9px] font-extrabold uppercase text-blue-600 block">Atendidas</span>
              <span className="text-sm font-bold text-blue-700 font-mono">
                {appointments.filter(a => a.status === 'Atendido' || a.status === 'Realizado' || a.status === 'Concluído').length}
              </span>
            </div>
            <div className="bg-rose-50/50 border border-rose-100/70 rounded-xl p-2 text-center">
              <span className="text-[9px] font-extrabold uppercase text-rose-600 block">Faltas</span>
              <span className="text-sm font-bold text-rose-700 font-mono">
                {appointments.filter(a => a.status === 'Falta' || a.status === 'Faltou').length}
              </span>
            </div>
            <div className="bg-amber-50/50 border border-amber-100/70 rounded-xl p-2 text-center">
              <span className="text-[9px] font-extrabold uppercase text-amber-600 block">Pendentes</span>
              <span className="text-sm font-bold text-amber-700 font-mono">
                {appointments.filter(a => a.status === 'Pendente' || a.status === 'Agendado' || a.status === 'Reagendado').length}
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span 
                              className="font-bold text-zinc-800 uppercase cursor-pointer hover:text-[#8B0000] hover:underline"
                              onClick={() => appt.patientId ? onOpenPatient(appt.patientName) : handleOpenChangePatient(appt, 'open_patient')}
                            >
                              {appt.patientName}
                            </span>
                            <button
                              onClick={() => appt.patientId ? handleOpenDrawer(appt) : handleOpenChangePatient(appt)}
                              className="p-1 text-zinc-400 hover:text-[#8B0000] hover:bg-[#8B0000]/10 rounded-md transition-colors cursor-pointer"
                              title="Abrir Prontuário & Evolução Clínica"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {!appt.patientId && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => handleOpenChangePatient(appt)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                                title="Confirmar vínculo com paciente existente ou criar novo cadastro limpo no CRM"
                              >
                                <UserPlus className="w-3 h-3 text-amber-700" />
                                {(appt.suggestedPatients?.length || 0) > 0
                                  ? `Vincular ao CRM (${appt.suggestedPatients!.length} sugestão)`
                                  : 'Confirmar / Cadastrar no CRM'}
                              </button>
                            </div>
                          )}
                          {appt.originalSummary && appt.originalSummary.toUpperCase() !== appt.patientName.toUpperCase() && (
                            <div className="text-[9px] text-[#C09553] font-medium mt-0.5 truncate max-w-[180px]" title={`Evento original: ${appt.originalSummary}`}>
                              Evento: {appt.originalSummary}
                            </div>
                          )}
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            {appt.phone ? `📱 ${appt.phone}` : 'Sem celular identificado'}
                          </div>
                        </td>

                        {/* Active Treatment Status Badge */}
                        <td className="py-3.5">
                          <button
                            onClick={() => appt.patientId ? handleOpenDrawer(appt) : handleOpenChangePatient(appt)}
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
                              onClick={() => appt.patientId ? onNavigateToPlanning(appt.patientName) : handleOpenChangePatient(appt, 'planning')}
                              className="px-2.5 py-1 bg-[#8B0000] text-white hover:bg-[#6c1b26] transition-colors font-bold text-[10px] rounded cursor-pointer"
                              title="Abrir Planejamento Odontológico"
                            >
                              Atender
                            </button>

                            <button
                              onClick={() => handleOpenChangePatient(appt)}
                              className={`p-1 px-1.5 rounded-lg border transition-colors flex items-center justify-center cursor-pointer ${
                                appt.patientId
                                  ? 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border-zinc-200 hover:border-zinc-300'
                                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-300'
                              }`}
                              title="Vincular a paciente existente ou cadastrar no CRM"
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

      {/* Confirm / Link Patient Association Modal */}
      {isChangePatientOpen && appointmentToChange && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-gradient-to-r from-[#8B0000] to-[#5C0000] text-white">
              <div>
                <h3 className="font-serif font-bold text-lg">Confirmar Paciente no CRM</h3>
                <p className="text-xs text-white/80 mt-0.5">
                  Evento Google Agenda: <span className="font-semibold">{appointmentToChange.originalSummary}</span> ({appointmentToChange.time})
                </p>
              </div>
              <button 
                onClick={() => { setIsChangePatientOpen(false); setAppointmentToChange(null); setPendingActionAfterLink('none'); }}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {/* BLOCO 1: SUGESTÕES ENCONTRADAS NO CRM (1 CLIQUE) */}
              {appointmentToChange.suggestedPatients && appointmentToChange.suggestedPatients.length > 0 && (
                <div className="p-4 bg-amber-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900">
                      🔗 Paciente(s) Já Encontrado(s) no CRM (Vincular com 1 Clique)
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Encontramos {appointmentToChange.suggestedPatients.length} cadastro(s) compatível(is) por nome ou telefone. Clique para vincular sem duplicar:
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {appointmentToChange.suggestedPatients.map((p: any) => {
                      const isPhoneMatched = newPatientLinkPhone && phonesMatch(p.mobile || p.phone, newPatientLinkPhone);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={isSavingPatientLink}
                          onClick={() => handleAssociatePatient(p)}
                          className="w-full text-left p-3 bg-white hover:bg-emerald-50/70 rounded-xl flex items-center gap-3 transition-all border border-amber-200 hover:border-emerald-400 shadow-2xs cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-full bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000] font-bold shrink-0">
                            {p.name ? p.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div className="truncate flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-zinc-800 truncate">{p.name}</p>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isPhoneMatched ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {isPhoneMatched ? 'Mesmo Telefone' : 'Mesmo Nome'}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 font-mono truncate">
                              {p.mobile || p.phone || 'Sem telefone salvo (será atualizado)'}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold shrink-0">
                            Vincular
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BLOCO 2: CRIAR NOVO PACIENTE LIMPO NO CRM */}
              <div className="p-4 bg-[#FAF8F5] space-y-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8B0000] block">
                  ➕ Ou Cadastrar Como Novo Paciente no CRM
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 uppercase block mb-1">Nome Limpo (Sem Procedimento)</label>
                    <input
                      type="text"
                      value={newPatientLinkName}
                      onChange={(e) => setNewPatientLinkName(e.target.value)}
                      placeholder="Ex: FULANO DA SILVA"
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 uppercase focus:outline-none focus:ring-2 focus:ring-[#C09553]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 uppercase block mb-1">WhatsApp / Telefone Identificado</label>
                    <input
                      type="text"
                      value={newPatientLinkPhone}
                      onChange={(e) => setNewPatientLinkPhone(e.target.value)}
                      placeholder="Ex: 31999999999"
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#C09553]"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-zinc-500">
                    Procedimento separado: <strong className="text-zinc-700">{appointmentToChange.service}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={isSavingPatientLink || !newPatientLinkName.trim()}
                    onClick={handleCreateAndAssociatePatient}
                    className="px-4 py-2 bg-[#8B0000] hover:bg-[#5C0000] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Criar no CRM & Vincular</span>
                  </button>
                </div>
              </div>

              {/* BLOCO 3: BUSCAR QUALQUER OUTRO PACIENTE DO CRM */}
              <div className="p-4 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                  Buscar Outro Paciente no CRM
                </span>
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 absolute left-3 text-zinc-400" />
                  <input 
                    type="text"
                    placeholder="Pesquisar todos os pacientes por nome ou WhatsApp..."
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 placeholder-zinc-400 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#C09553] focus:border-transparent transition-all"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pt-1">
                  {filteredPatientsForChange.length > 0 ? (
                    filteredPatientsForChange.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={isSavingPatientLink}
                        onClick={() => handleAssociatePatient(p)}
                        className="w-full text-left p-2.5 hover:bg-zinc-50 rounded-xl flex items-center gap-3 transition-colors border border-transparent hover:border-zinc-200 cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000] font-bold text-xs shrink-0">
                          {p.name ? p.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="truncate flex-1">
                          <p className="text-xs font-bold text-zinc-800 truncate">{p.name}</p>
                          <p className="text-[11px] text-zinc-500 font-mono truncate">{p.mobile || p.phone || 'Sem telefone'}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      </button>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-zinc-500 font-medium">
                      Nenhum paciente encontrado na busca
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3.5 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button
                type="button"
                onClick={() => { setIsChangePatientOpen(false); setAppointmentToChange(null); setPendingActionAfterLink('none'); }}
                className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
