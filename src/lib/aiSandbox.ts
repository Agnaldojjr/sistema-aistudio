import { DEMO_SVG_PLACEHOLDERS } from '../constants';
import type { PaymentRecord } from '../types';

export interface AIRuntimeLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'network' | 'info';
  source: string;
  message: string;
  stack?: string;
  route?: string;
}

export interface AIStaticAuditFinding {
  id: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  category: 'Architecture' | 'Performance' | 'UX/Accessibility' | 'Resilience' | 'Security';
  file: string;
  title: string;
  description: string;
  suggestion: string;
}

const SANDBOX_FLAG_KEY = 'ai_sandbox_mode';
const SANDBOX_CRM_KEY = 'ai_sandbox_crm_data';
const SANDBOX_CALENDAR_KEY = 'ai_sandbox_calendar_events';
const SANDBOX_LOGS_KEY = 'ai_sandbox_runtime_logs';

let runtimeLogs: AIRuntimeLogEntry[] = [];
let telemetryInitialized = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (_) {}
  });
}

export function subscribeAiRuntimeLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAiRuntimeLogs(): AIRuntimeLogEntry[] {
  return [...runtimeLogs];
}

export function clearAiRuntimeLogs(): void {
  runtimeLogs = [];
  try {
    sessionStorage.removeItem(SANDBOX_LOGS_KEY);
  } catch (_) {}
  notifyListeners();
}

export function addAiRuntimeLog(entry: Omit<AIRuntimeLogEntry, 'id' | 'timestamp' | 'route'>): void {
  const newEntry: AIRuntimeLogEntry = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    route: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
  };
  runtimeLogs = [newEntry, ...runtimeLogs].slice(0, 150);
  try {
    sessionStorage.setItem(SANDBOX_LOGS_KEY, JSON.stringify(runtimeLogs));
    if (typeof window !== 'undefined') {
      (window as any).__AI_INSPECTOR_LOGS__ = runtimeLogs;
    }
  } catch (_) {}
  notifyListeners();
}

export function initAiRuntimeTelemetry(): void {
  if (typeof window === 'undefined' || telemetryInitialized) return;
  telemetryInitialized = true;

  try {
    const saved = sessionStorage.getItem(SANDBOX_LOGS_KEY);
    if (saved) {
      runtimeLogs = JSON.parse(saved);
    }
  } catch (_) {}

  window.addEventListener('error', (event) => {
    addAiRuntimeLog({
      level: 'error',
      source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : 'window.onerror',
      message: event.message || 'Erro de runtime não tratado',
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    addAiRuntimeLog({
      level: 'error',
      source: 'unhandledrejection',
      message: reason?.message || String(reason || 'Promise rejeitada sem catch'),
      stack: reason?.stack,
    });
  });

  const origError = console.error.bind(console);
  console.error = (...args: any[]) => {
    origError(...args);
    const msg = args
      .map((a) => (typeof a === 'object' ? (a?.message || JSON.stringify(a)) : String(a)))
      .join(' ');
    if (!msg.includes('[AI-Inspector-Ignore]')) {
      addAiRuntimeLog({
        level: 'error',
        source: 'console.error',
        message: msg.slice(0, 1000),
        stack: args.find((a) => a instanceof Error)?.stack,
      });
    }
  };

  const origWarn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    origWarn(...args);
    const msg = args
      .map((a) => (typeof a === 'object' ? (a?.message || JSON.stringify(a)) : String(a)))
      .join(' ');
    if (!msg.includes('[AI-Inspector-Ignore]')) {
      addAiRuntimeLog({
        level: 'warn',
        source: 'console.warn',
        message: msg.slice(0, 1000),
      });
    }
  };

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    try {
      const response = await origFetch(input, init);
      if (!response.ok && !urlStr.includes('/llms') && !urlStr.includes('/ai-context')) {
        addAiRuntimeLog({
          level: 'network',
          source: `fetch ${init?.method || 'GET'} ${urlStr}`,
          message: `HTTP ${response.status} (${response.statusText}) em ${urlStr}`,
        });
      }
      return response;
    } catch (err: any) {
      addAiRuntimeLog({
        level: 'network',
        source: `fetch ${init?.method || 'GET'} ${urlStr}`,
        message: `Falha de rede em ${urlStr}: ${err?.message || String(err)}`,
        stack: err?.stack,
      });
      throw err;
    }
  };

  // Expose programmatic API on window for automated browser AI agents (Playwright, Operator, Computer Use)
  (window as any).__AI_INSPECTOR__ = {
    version: '1.0.0',
    isSandbox: () => isAiSandboxMode(),
    enableSandbox: () => enableAiSandboxMode(),
    getLogs: () => getAiRuntimeLogs(),
    clearLogs: () => clearAiRuntimeLogs(),
    getMockCRM: () => getAiSandboxCRMDatabase(),
    getStaticAuditFindings: () => getStaticAuditFindings(),
    endpoints: {
      llmsTxt: '/llms.txt',
      llmsFullTxt: '/llms-full.txt',
      aiContextJson: '/ai-context.json',
      apiAiContext: '/api/ai-context',
      uiInspector: '/ai-inspector',
    },
  };
}

export function isAiSandboxMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    if (
      params.get('ai') === 'true' ||
      params.get('sandbox') === 'true' ||
      params.get('ai_inspect') === 'true' ||
      pathname.startsWith('/ai-inspector')
    ) {
      sessionStorage.setItem(SANDBOX_FLAG_KEY, 'true');
      return true;
    }
    return sessionStorage.getItem(SANDBOX_FLAG_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

export function enableAiSandboxMode(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SANDBOX_FLAG_KEY, 'true');
    // Seed mock CRM data if not initialized
    if (!sessionStorage.getItem(SANDBOX_CRM_KEY)) {
      const initialData = createDefaultSandboxCRMData();
      sessionStorage.setItem(SANDBOX_CRM_KEY, JSON.stringify(initialData));
    }
    // Seed mock financial view records only if localStorage is currently empty
    const existingFin = localStorage.getItem('agnaldo_dent_financeiro');
    if (!existingFin || existingFin === '[]') {
      localStorage.setItem('agnaldo_dent_financeiro', JSON.stringify(getDefaultSandboxFinancialRecords()));
    }
  } catch (_) {}
}

export function disableAiSandboxMode(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SANDBOX_FLAG_KEY);
    sessionStorage.removeItem(SANDBOX_CRM_KEY);
    sessionStorage.removeItem(SANDBOX_CALENDAR_KEY);
  } catch (_) {}
}

export function resetAiSandboxData(): void {
  if (typeof window === 'undefined') return;
  try {
    const fresh = createDefaultSandboxCRMData();
    sessionStorage.setItem(SANDBOX_CRM_KEY, JSON.stringify(fresh));
    sessionStorage.removeItem(SANDBOX_CALENDAR_KEY);
    localStorage.setItem('agnaldo_dent_financeiro', JSON.stringify(getDefaultSandboxFinancialRecords()));
    addAiRuntimeLog({
      level: 'info',
      source: 'aiSandbox.reset',
      message: 'Dados fictícios do Modo Sandbox restaurados para o estado inicial.',
    });
  } catch (_) {}
}

function getIsoDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultSandboxFinancialRecords(): PaymentRecord[] {
  const today = getIsoDateOffset(0);
  const yesterday = getIsoDateOffset(-1);
  const threeDaysAgo = getIsoDateOffset(-3);
  return [
    {
      id: 'sandbox-fin-1',
      patientId: 'sandbox-pat-1',
      patientName: 'Mariana Costa Albuquerque (Demo IA)',
      date: `${today}T10:30:00.000Z`,
      amount: 3400,
      value: 3400,
      paymentMethod: 'PIX',
      method: 'PIX',
      status: 'Pago',
      description: '2x Faceta de Resina Composta (Dentes 11 e 21)',
    },
    {
      id: 'sandbox-fin-2',
      patientId: 'sandbox-pat-2',
      patientName: 'Roberto Mendes Figueiredo (Demo IA)',
      date: `${yesterday}T15:00:00.000Z`,
      amount: 2500,
      value: 2500,
      paymentMethod: 'Cartão de Crédito',
      method: 'Cartão de Crédito',
      status: 'Pago',
      description: 'Implante Dentário Cone Morse (Dente 36)',
    },
    {
      id: 'sandbox-fin-3',
      patientId: 'sandbox-pat-3',
      patientName: 'Camila Borges Vasconcelos (Demo IA)',
      date: `${threeDaysAgo}T11:15:00.000Z`,
      amount: 1200,
      value: 1200,
      paymentMethod: 'PIX',
      method: 'PIX',
      status: 'Pendente',
      description: 'Clareamento Dental Combinado (Consultório + Caseiro)',
    },
    {
      id: 'sandbox-fin-4',
      patientId: 'sandbox-pat-4',
      patientName: 'Fernando Henrique Prado (Demo IA)',
      date: `${today}T09:00:00.000Z`,
      amount: 950,
      value: 950,
      paymentMethod: 'Cartão de Débito',
      method: 'Cartão de Débito',
      status: 'Pago',
      description: 'Endodontia Molar (Dente 16) + Restauração',
    },
  ];
}

export function createDefaultSandboxCRMData() {
  const today = getIsoDateOffset(0);
  const tomorrow = getIsoDateOffset(1);
  const yesterday = getIsoDateOffset(-1);
  const lastMonth = getIsoDateOffset(-35);

  const patients = [
    {
      id: 'sandbox-pat-1',
      codigo_paciente: 'PAC-001',
      name: 'Mariana Costa Albuquerque (Demo IA)',
      birthDate: '1989-04-15',
      gender: 'Feminino',
      status: 'Em Tratamento',
      maritalStatus: 'Casada',
      cpf: '000.111.222-33',
      rg: 'MG-12.345.678',
      phone: '(31) 3222-1010',
      mobile: '(31) 99811-2233',
      email: 'mariana.demo@exemplo.com.br',
      cep: '30140-071',
      street: 'Av. do Contorno',
      number: '4500',
      neighborhood: 'Funcionários',
      city: 'Belo Horizonte',
      state: 'MG',
      healthInsurance: 'Particular',
      howKnewClinic: 'Indicação',
      observations: 'Paciente em reabilitação estética anterior superior. Sensibilidade leve no dente 22.',
      createdAt: `${lastMonth}T10:00:00.000Z`,
      updatedAt: `${today}T09:00:00.000Z`,
    },
    {
      id: 'sandbox-pat-2',
      codigo_paciente: 'PAC-002',
      name: 'Roberto Mendes Figueiredo (Demo IA)',
      birthDate: '1975-11-22',
      gender: 'Masculino',
      status: 'Em Tratamento',
      maritalStatus: 'Casado',
      cpf: '111.222.333-44',
      rg: 'MG-87.654.321',
      phone: '(31) 3344-5566',
      mobile: '(31) 99722-3344',
      email: 'roberto.demo@exemplo.com.br',
      cep: '30380-400',
      street: 'Rua São Paulo',
      number: '1820',
      neighborhood: 'Lourdes',
      city: 'Belo Horizonte',
      state: 'MG',
      healthInsurance: 'Particular',
      howKnewClinic: 'Instagram',
      observations: 'Planejamento de implante no elemento 36 e coroa de porcelana no 46.',
      createdAt: `${lastMonth}T14:30:00.000Z`,
      updatedAt: `${yesterday}T16:00:00.000Z`,
    },
    {
      id: 'sandbox-pat-3',
      codigo_paciente: 'PAC-003',
      name: 'Camila Borges Vasconcelos (Demo IA)',
      birthDate: '1994-08-09',
      gender: 'Feminino',
      status: 'Orçamento Aberto',
      maritalStatus: 'Solteira',
      cpf: '222.333.444-55',
      mobile: '(31) 99633-4455',
      email: 'camila.demo@exemplo.com.br',
      city: 'Belo Horizonte',
      state: 'MG',
      healthInsurance: 'Particular',
      howKnewClinic: 'Google',
      observations: 'Interesse em clareamento combinado e troca de restaurações em resina.',
      createdAt: `${yesterday}T11:00:00.000Z`,
      updatedAt: `${yesterday}T11:00:00.000Z`,
    },
    {
      id: 'sandbox-pat-4',
      codigo_paciente: 'PAC-004',
      name: 'Fernando Henrique Prado (Demo IA)',
      birthDate: '1982-02-19',
      gender: 'Masculino',
      status: 'Concluído',
      maritalStatus: 'Divorciado',
      cpf: '333.444.555-66',
      mobile: '(31) 99544-5566',
      email: 'fernando.demo@exemplo.com.br',
      city: 'Nova Lima',
      state: 'MG',
      healthInsurance: 'Particular',
      howKnewClinic: 'Indicação',
      observations: 'Controle semestral de profilaxia e manutenção de prótese.',
      createdAt: `${lastMonth}T09:00:00.000Z`,
      updatedAt: `${today}T08:30:00.000Z`,
    },
  ];

  const appointments = [
    {
      id: 'sandbox-app-1',
      patientId: 'sandbox-pat-1',
      patientName: 'Mariana Costa Albuquerque (Demo IA)',
      date: today,
      time: '09:00',
      dentist: 'Dr. Agnaldo Ferreira',
      specialty: 'Odontologia Estética',
      status: 'Confirmado',
      observations: 'Prova de mock-up e cimentação de facetas 11 e 21.',
      estimatedValue: 3400,
    },
    {
      id: 'sandbox-app-2',
      patientId: 'sandbox-pat-2',
      patientName: 'Roberto Mendes Figueiredo (Demo IA)',
      date: today,
      time: '14:00',
      dentist: 'Dr. Agnaldo Ferreira',
      specialty: 'Implantodontia',
      status: 'Agendado',
      observations: 'Avaliação tomográfica e moldagem para coroa sobre implante (dente 36).',
      estimatedValue: 2500,
    },
    {
      id: 'sandbox-app-3',
      patientId: 'sandbox-pat-3',
      patientName: 'Camila Borges Vasconcelos (Demo IA)',
      date: tomorrow,
      time: '10:30',
      dentist: 'Dr. Agnaldo Ferreira',
      specialty: 'Dentística Restauradora',
      status: 'Agendado',
      observations: 'Apresentação do plano de tratamento 3D e início do clareamento.',
      estimatedValue: 1200,
    },
    {
      id: 'sandbox-app-4',
      patientId: 'sandbox-pat-4',
      patientName: 'Fernando Henrique Prado (Demo IA)',
      date: yesterday,
      time: '16:00',
      dentist: 'Dr. Agnaldo Ferreira',
      specialty: 'Prevenção',
      status: 'Atendido',
      observations: 'Profilaxia com ultrassom e aplicação tópica de flúor.',
      estimatedValue: 350,
    },
  ];

  const clinical_history = [
    {
      id: 'sandbox-hist-1',
      patientId: 'sandbox-pat-1',
      date: yesterday,
      proceduresPerformed: 'Profilaxia + Escaneamento Intraoral + Fotografias Clínicas',
      treatmentEvolution: 'Arcada superior preparada para planejamento digital do sorriso. Sem alterações periodontais.',
      recalls: 'Retorno agendado para prova estética.',
      observations: 'Paciente aprovou formato mais natural para os incisivos centrais.',
    },
    {
      id: 'sandbox-hist-2',
      patientId: 'sandbox-pat-2',
      date: lastMonth,
      proceduresPerformed: 'Instalação de Implante Cone Morse 4.0x10mm (Região do 36)',
      treatmentEvolution: 'Torque primário de 45Ncm. Sutura simples com fio 4-0. Pós-operatório sem intercorrências.',
      recalls: 'Reabertura / moldagem programada.',
      observations: 'Radiografia periapical de controle satisfatória.',
    },
  ];

  const communications = [
    {
      id: 'sandbox-comm-1',
      patientId: 'sandbox-pat-1',
      type: 'Confirmação',
      date: `${today}T08:00:00.000Z`,
      message: 'Olá, Mariana! Confirmamos sua consulta com o Dr. Agnaldo Ferreira hoje às 09:00.',
      status: 'Confirmado',
    },
    {
      id: 'sandbox-comm-2',
      patientId: 'sandbox-pat-2',
      type: 'Lembrete',
      date: `${today}T08:15:00.000Z`,
      message: 'Olá, Roberto! Lembrete de sua consulta hoje às 14:00.',
      status: 'Enviado',
    },
  ];

  const sampleSections = [
    {
      id: 'panoramic',
      title: 'Radiografia Panorâmica',
      subtitle: 'Planejamento de Implantes e Diagnósticos Gerais',
      image: DEMO_SVG_PLACEHOLDERS.panoramic,
      markers: [],
    },
    {
      id: 'upper',
      title: 'Arcada Superior',
      subtitle: 'Dentes Posteriores e Anteriores Superiores',
      image: DEMO_SVG_PLACEHOLDERS.upper,
      markers: [
        { id: 'upper-11', toothNumber: 11, x: 46.5, y: 21.0, procedures: ['p1'] },
        { id: 'upper-21', toothNumber: 21, x: 53.5, y: 21.0, procedures: ['p1'] },
        { id: 'upper-16', toothNumber: 16, x: 25.0, y: 48.0, procedures: ['p2'] },
      ],
    },
    {
      id: 'lower',
      title: 'Arcada Inferior',
      subtitle: 'Dentes Posteriores e Anteriores Inferiores',
      image: DEMO_SVG_PLACEHOLDERS.lower,
      markers: [
        { id: 'lower-36', toothNumber: 36, x: 64.0, y: 45.0, procedures: ['p5'] },
      ],
    },
    {
      id: 'smile',
      title: 'Estética do Sorriso',
      subtitle: 'Mapeamento de Dentes Anteriores e Estética',
      image: DEMO_SVG_PLACEHOLDERS.smile,
      markers: [
        { id: 'smile-11', toothNumber: 11, x: 47.0, y: 48.0, procedures: ['p1'] },
        { id: 'smile-21', toothNumber: 21, x: 53.0, y: 48.0, procedures: ['p1'] },
      ],
    },
  ];

  const sampleProposal = {
    patientName: 'Mariana Costa Albuquerque (Demo IA)',
    status: 'Em Andamento' as const,
    notes: 'Planejamento demonstrativo no Modo Sandbox para auditoria de IA. Dados 100% fictícios.',
    discountPercent: 5,
    pixDiscountLabel: '5% DESCONTO NO PIX',
    installments: 10,
    installmentsLabel: 'Parcelamento em até 10x.',
    customDiscountAmount: 0,
    showTotalBySection: true,
    markerSize: 26,
  };

  return {
    patients,
    appointments,
    clinical_history,
    communications,
    anamnese: [
      {
        id: 'sandbox-anam-1',
        patientId: 'sandbox-pat-1',
        date: lastMonth,
        allergies: 'Nenhuma alergia medicamentosa relatada.',
        medications: 'Vitamina D3',
        systemicConditions: 'Hígida',
      },
    ],
    avisos: [
      {
        id: 'sandbox-aviso-1',
        patientId: 'sandbox-pat-1',
        title: 'Preferência de horário',
        description: 'Prefere atendimento no início da manhã.',
        date: today,
      },
    ],
    documentos: [],
    galeria: [],
    pagamentos: getDefaultSandboxFinancialRecords(),
    tratamentos: [
      {
        id: 'sandbox-trat-1',
        patientId: 'sandbox-pat-1',
        date: `${today}T09:00:00.000Z`,
        proposal: sampleProposal,
      },
    ],
    odontograma: [
      {
        id: 'sandbox-odonto-1',
        patientId: 'sandbox-pat-1',
        date: `${today}T09:00:00.000Z`,
        sections: sampleSections,
      },
    ],
  };
}

export function getAiSandboxCRMDatabase() {
  if (typeof window === 'undefined') return createDefaultSandboxCRMData();
  try {
    const raw = sessionStorage.getItem(SANDBOX_CRM_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    const initial = createDefaultSandboxCRMData();
    sessionStorage.setItem(SANDBOX_CRM_KEY, JSON.stringify(initial));
    return initial;
  } catch (_) {
    return createDefaultSandboxCRMData();
  }
}

export function saveAiSandboxCRMDatabase(dataToSave: any) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SANDBOX_CRM_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.warn('Falha ao salvar dados no sessionStorage do Sandbox:', e);
  }
}

export function getAiSandboxCalendarEvents(start: Date, end: Date) {
  const crm = getAiSandboxCRMDatabase();
  const appts = crm.appointments || [];

  let customEvents: any[] = [];
  try {
    const saved = sessionStorage.getItem(SANDBOX_CALENDAR_KEY);
    if (saved) customEvents = JSON.parse(saved);
  } catch (_) {}

  const mappedFromCrm = appts.map((app: any) => {
    const patient = (crm.patients || []).find((p: any) => p.id === app.patientId);
    const phone = patient?.mobile || patient?.phone || '(31) 99811-2233';
    const startIso = `${app.date}T${app.time || '09:00'}:00`;
    const [h, m] = (app.time || '09:00').split(':').map(Number);
    const endH = String(Math.min(23, (h || 9) + 1)).padStart(2, '0');
    const endIso = `${app.date}T${endH}:${String(m || 0).padStart(2, '0')}:00`;

    return {
      id: app.id,
      summary: `${app.patientName} - ${app.specialty || 'Consulta'}`,
      description: `${app.observations || ''}\nWhatsApp: ${phone}\nStatus: ${app.status}`,
      start: { dateTime: startIso },
      end: { dateTime: endIso },
      calendarId: 'sandbox-primary',
      calendarColor: '#8B0000',
      calendarSummary: 'Agenda Clínica (Sandbox IA)',
    };
  });

  const all = [...mappedFromCrm, ...customEvents].filter((ev) => {
    const evTime = new Date(ev.start?.dateTime || ev.start?.date || Date.now()).getTime();
    return evTime >= start.getTime() - 86400000 && evTime <= end.getTime() + 86400000;
  });

  return {
    items: all,
    debugInfo: [
      {
        id: 'sandbox-primary',
        summary: 'Agenda Clínica (Sandbox IA)',
        eventCount: all.length,
        error: null,
      },
    ],
  };
}

export function createAiSandboxCalendarEvent(eventData: any) {
  const newEv = {
    ...eventData,
    id: `sandbox-cal-${Date.now()}`,
    calendarId: 'sandbox-primary',
    calendarColor: '#8B0000',
    calendarSummary: 'Agenda Clínica (Sandbox IA)',
  };
  try {
    const saved = sessionStorage.getItem(SANDBOX_CALENDAR_KEY);
    const list = saved ? JSON.parse(saved) : [];
    list.push(newEv);
    sessionStorage.setItem(SANDBOX_CALENDAR_KEY, JSON.stringify(list));
  } catch (_) {}
  return newEv;
}

export function deleteAiSandboxCalendarEvent(eventId: string) {
  try {
    const saved = sessionStorage.getItem(SANDBOX_CALENDAR_KEY);
    if (saved) {
      const list = JSON.parse(saved).filter((e: any) => e.id !== eventId);
      sessionStorage.setItem(SANDBOX_CALENDAR_KEY, JSON.stringify(list));
    }
  } catch (_) {}
  return true;
}

export function getStaticAuditFindings(): AIStaticAuditFinding[] {
  return [
    {
      id: 'ARCH-01',
      severity: 'medium',
      category: 'Architecture',
      file: 'src/lib/supabaseCrm.ts & src/context/PatientContext.tsx',
      title: 'Armazenamento Monolítico JSONB (clinic_data.crm_data)',
      description:
        'Toda a base do CRM (pacientes, agendamentos, histórico, pagamentos, odontograma, fotos base64) é lida e gravada em uma única coluna JSONB por user_id no Supabase, com backup em localStorage.',
      suggestion:
        'Para escalar acima de centenas de pacientes sem atingir o limite de 5MB do localStorage ou payload pesado de rede, migrar gradualmente coleções de alta frequência (appointments, payments, odontograma) para tabelas relacionais dedicadas no Supabase e manter imagens exclusivamente no Cloudflare R2.',
    },
    {
      id: 'PERF-01',
      severity: 'medium',
      category: 'Performance',
      file: 'src/components/DashboardView.tsx & src/components/DentalCRMView.tsx',
      title: 'Componentes de Grande Porte (>1.500 linhas) e Re-renderizações',
      description:
        'DashboardView.tsx (~2.015 linhas) e DentalCRMView.tsx concentram múltiplos sub-modais, estados de formulário e sincronizações diretas com Google Calendar + Supabase no mesmo ciclo de vida.',
      suggestion:
        'Extrair sub-componentes memorizados (React.memo) para listas de consultas, gaveta de atendimento e abas do prontuário, além de usar code-splitting (React.lazy) para o módulo 3D (Three.js / @react-three/fiber) e geração de PDF (jspdf / html2canvas).',
    },
    {
      id: 'RESIL-01',
      severity: 'low',
      category: 'Resilience',
      file: 'src/lib/calendar.ts & src/firebase.ts',
      title: 'Expiração do Access Token do Google OAuth após 60 minutos',
      description:
        'O token OAuth do Google Calendar dura 60 minutos e depende de /api/auth/google/refresh com provider_refresh_token salvo no localStorage.',
      suggestion:
        'Adicionar retry transparente dentro de listCalendarEvents/createCalendarEvent caso a API do Google retorne 401 antes dos 50 minutos previstos no timer local.',
    },
    {
      id: 'SEC-01',
      severity: 'info',
      category: 'Security',
      file: 'src/firebase.ts & src/lib/aiSandbox.ts',
      title: 'Isolamento de Autenticação e Proteção LGPD no Modo IA',
      description:
        'O bypass_auth de desenvolvimento permanece bloqueado em produção conforme regra do projeto. O Modo Sandbox IA (?ai=true / /ai-inspector) utiliza exclusivamente dados fictícios em sessionStorage.',
      suggestion:
        'Manter políticas RLS (Row Level Security) estritas na tabela clinic_data do Supabase vinculadas a auth.uid() = user_id.',
    },
  ];
}
