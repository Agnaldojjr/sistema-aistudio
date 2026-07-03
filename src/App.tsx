/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardEdit,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  BookOpen,
  Coins,
  User as UserIcon,
  ExternalLink,
  Smartphone,
  Monitor,
  Settings,
  ArrowRight,
} from 'lucide-react';
import ProcedureManager from './components/ProcedureManager';
import PhotoEditor from './components/PhotoEditor';
import NegotiationTab from './components/NegotiationTab';
import PatientScreen from './components/PatientScreen';
import PatientsModal from './components/PatientsModal';
import CalendarView from './components/CalendarView';
import PatientRegistrationTab from './components/PatientRegistrationTab';
import PatientDocumentsTab from './components/PatientDocumentsTab';
import DashboardView from './components/DashboardView';
import SettingsView from './components/SettingsView';
import ClinicalAttendanceManager from './components/ClinicalAttendanceManager';
import MobileWorkspace from './components/MobileWorkspace';
import DentalCRMView from './components/DentalCRMView';
import PatientAnamnesisForm from './components/PatientAnamnesisForm';
import { PhotoSection, Procedure, TreatmentProposal, ClinicSettings } from './types';
import { DEFAULT_PROCEDURES, DEMO_SVG_PLACEHOLDERS, DEFAULT_CLINIC_SETTINGS, INITIAL_PROPOSAL, INITIAL_SECTIONS } from './constants';
import { initAuth, googleSignIn, logout } from './firebase';
import TreatmentPlanning3D from './TreatmentPlanning3D';

import type { User } from '@supabase/supabase-js';
import { usePatientContext } from './context/PatientContext';

// ─── Logo SVG (AF Monogram matching the brand identity) ─────────────────────
const AFLogoSVG = ({ className = '', light = false }: { className?: string; light?: boolean }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* A letter - left stroke */}
    <path d="M 28 88 L 48 30" stroke={light ? '#FAF8F5' : '#8B0000'} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    {/* A letter - right stroke */}
    <path d="M 48 30 L 68 88" stroke={light ? '#FAF8F5' : '#8B0000'} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    {/* A crossbar */}
    <path d="M 36 62 L 60 62" stroke={light ? '#FAF8F5' : '#8B0000'} strokeWidth="7" strokeLinecap="round" />
    {/* F top bar */}
    <path d="M 48 30 L 82 30" stroke={light ? '#FAF8F5' : '#8B0000'} strokeWidth="7" strokeLinecap="round" />
    {/* F middle bar */}
    <path d="M 58 50 L 76 50" stroke={light ? '#FAF8F5' : '#8B0000'} strokeWidth="7" strokeLinecap="round" />
    {/* Dental arch (smile) */}
    <path d="M 26 72 Q 48 98 70 72" stroke={light ? '#C09553' : '#C09553'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// ─── Initial State ─────────────────────────────────────────────────────────

// ─── Navigation Config ──────────────────────────────────────────────────────
type AppView = 'dashboard' | 'calendar' | 'crm' | 'settings' | '3d-planning';

const NAV_ITEMS = [
  { id: 'dashboard' as AppView, label: 'Painel', icon: LayoutDashboard, section: 'principal' },
  { id: 'crm'       as AppView, label: 'Pacientes', icon: Users,           section: 'principal' },
  { id: 'calendar'  as AppView, label: 'Agenda',    icon: Calendar,        section: 'principal' },
  { id: '3d-planning' as AppView, label: 'Arcada 3D', icon: Layers,        section: 'principal' },
  { id: 'settings'  as AppView, label: 'Ajustes',   icon: Settings,        section: 'principal' },
];

// ─── Sidebar ────────────────────────────────────────────────────────────────
interface SidebarProps {
  currentView: AppView;
  onChangeView: (v: AppView) => void;
  onLogout: () => void;
  clinicSettings: ClinicSettings;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function Sidebar({
  currentView, onChangeView, onLogout, clinicSettings,
  collapsed, onToggleCollapse, mobileOpen, onCloseMobile,
}: SidebarProps) {
  const handleNav = (v: AppView) => {
    onChangeView(v);
    onCloseMobile();
  };

  const sidebarCls = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={onCloseMobile}
      />

      <aside className={sidebarCls} aria-label="Navegação principal">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/10 border border-white/20">
              <AFLogoSVG className="w-7 h-7" light />
            </div>
            {!collapsed && (
              <div className="overflow-hidden animate-fade-in">
                <p className="text-white font-bold text-[13px] leading-tight tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Dr. Agnaldo Ferreira
                </p>
                <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#C09553' }}>
                  Odontologia Restauradora
                </p>
              </div>
            )}
          </div>

          {/* Collapse toggle — desktop only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex mt-4 w-full items-center justify-center gap-1.5 text-white/40 hover:text-white/80 text-[10px] font-medium transition-colors"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {!collapsed && (
            <p className="nav-section-label">Módulos</p>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`nav-item w-full ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="nav-item-icon flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {!collapsed ? (
            <div className="mb-3 px-2">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-1">Conectado como</p>
              <p className="text-[12px] text-white/70 font-medium truncate">{clinicSettings.doctorName}</p>
              <p className="text-[10px] text-white/40 truncate">{clinicSettings.cro}</p>
            </div>
          ) : null}
          <button
            onClick={onLogout}
            className={`nav-item w-full text-red-300/70 hover:text-red-200 hover:bg-red-900/30 ${collapsed ? 'justify-center px-0' : ''}`}
            title="Sair"
          >
            <LogOut className="nav-item-icon flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── TopBar ─────────────────────────────────────────────────────────────────
interface TopBarProps {
  currentView: AppView;
  proposal: TreatmentProposal;
  onChangeView: (view: AppView) => void;
  onOpenMobileMenu: () => void;
  isMobileOptimized: boolean;
  setIsMobileOptimized: (v: boolean) => void;
}

function TopBar({ currentView, proposal, onChangeView, onOpenMobileMenu, isMobileOptimized, setIsMobileOptimized }: TopBarProps) {
  const VIEW_LABELS: Record<AppView, string> = {
    dashboard: 'Painel Geral',
    crm: 'Gestão de Pacientes',
    calendar: 'Agenda',
    settings: 'Configurações',
    '3d-planning': 'Planejamento 3D',
  };

  return (
    <header className="topbar print:hidden">
      {/* Mobile menu toggle */}
      <button
        onClick={onOpenMobileMenu}
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-600"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h2 className="text-[15px] font-semibold text-zinc-800 truncate">
          {VIEW_LABELS[currentView]}
        </h2>
        {/* Header Action Button */}
        {currentView === 'dashboard' && (
          <button onClick={() => onChangeView('calendar')} className="btn-primary w-full shadow-sm group">
            <span className="flex-1 text-center font-semibold text-[13px] tracking-wide">NOVA CONSULTA</span>
            <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>
        )}
        {currentView === 'crm' && proposal.patientName && (
          <div className="bg-[#FAF8F5] border border-[#E6DEC9] p-3 rounded-lg shadow-sm">
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1 flex items-center justify-between">
              Plano Ativo
              <span className={`px-1.5 py-0.5 rounded text-[9px] ${proposal.status === 'Em Andamento' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {proposal.status}
              </span>
            </p>
            <p className="text-sm font-bold text-[#8B0000] truncate">{proposal.patientName}</p>
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setIsMobileOptimized(!isMobileOptimized)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-colors"
          title={isMobileOptimized ? 'Modo Desktop' : 'Modo Celular'}
        >
          {isMobileOptimized ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
          {isMobileOptimized ? 'Desktop' : 'Celular'}
        </button>
      </div>
    </header>
  );
}



// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, isLoggingIn }: { onLogin: () => void; isLoggingIn: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #5C0000 0%, #8B0000 50%, #3D0000 100%)' }}>
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: '#C09553', filter: 'blur(80px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-10"
          style={{ background: '#C09553', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Top band */}
          <div className="px-8 pt-10 pb-8 text-center"
            style={{ background: 'linear-gradient(180deg, #8B0000 0%, #6B0000 100%)' }}>
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center animate-pulse-gold">
              <AFLogoSVG className="w-13 h-13" light />
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              Dr. Agnaldo Ferreira
            </h1>
            <p className="text-[11px] font-semibold tracking-widest uppercase mt-1" style={{ color: '#C09553' }}>
              Odontologia Restauradora
            </p>
          </div>

          <div className="px-8 py-8 space-y-6">
            <div className="text-center">
              <h2 className="text-zinc-800 font-bold text-base">Portal Clínico</h2>
              <p className="text-zinc-500 text-sm mt-1">Faça login com sua conta Google para acessar o sistema.</p>
            </div>

            <button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-zinc-200 rounded-xl px-4 py-3.5 shadow-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              <span className="font-semibold text-zinc-700">
                {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
              </span>
            </button>

            <p className="text-center text-[10px] text-zinc-400">
              Seus dados são salvos no Google Drive de forma privada e segura.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // --- AUTH STATE ---
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // --- URL PARAMS ---
  const urlMode = new URLSearchParams(window.location.search).get('mode');

  // --- APP STATE ---
  const [procedures, setProcedures] = useState<Procedure[]>(() => {
    const cached = localStorage.getItem('agnaldo_dent_procedures');
    return cached ? JSON.parse(cached) : DEFAULT_PROCEDURES;
  });

  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(() => {
    const cached = localStorage.getItem('agnaldo_dent_clinic_settings');
    return cached ? JSON.parse(cached) : DEFAULT_CLINIC_SETTINGS;
  });

  const [activeTab, setActiveTab] = useState<'registration' | 'editor' | 'negotiation' | 'documents'>('registration');
  const [showPatientsModal, setShowPatientsModal] = useState(false);
  const [currentAppView, setCurrentAppView] = useState<AppView>('dashboard');
  const [appointmentPatientName, setAppointmentPatientName] = useState<string | undefined>();
  const [crmPatientName, setCrmPatientName] = useState<string | undefined>();
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('agnaldo_dent_theme') || 'padrao';
    if (saved === 'bordo-escuro') return 'bordo-nobre';
    if (saved === 'preto-ouro') return 'bege-real';
    if (saved === 'azul-noturno') return 'bordo-imperial';
    return saved;
  });
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);

  const { activeSections: sections, setActiveSections: setSections, activeProposal: proposal, setActiveProposal: setProposal } = usePatientContext();


  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [isMobileOptimized, setIsMobileOptimized] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('agnaldo_dent_mobile_opt');
      if (stored) return stored === 'true';
      return window.innerWidth < 1024;
    }
    return false;
  });

  const [isAutosaving] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    const unsubscribe = initAuth(
      (usr) => { setUser(usr); setNeedsAuth(false); },
      () => setNeedsAuth(true)
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => { localStorage.setItem('agnaldo_dent_procedures', JSON.stringify(procedures)); }, [procedures]);
  // sections and proposal are now managed globally via PatientContext

  useEffect(() => { localStorage.setItem('agnaldo_dent_clinic_settings', JSON.stringify(clinicSettings)); }, [clinicSettings]);
  useEffect(() => { localStorage.setItem('agnaldo_dent_mobile_opt', isMobileOptimized.toString()); }, [isMobileOptimized]);
  useEffect(() => {
    localStorage.setItem('agnaldo_dent_theme', currentTheme);
    document.body.className = currentTheme === 'padrao' ? '' : `theme-${currentTheme}`;
  }, [currentTheme]);

  // --- ACTIONS ---
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) { setUser(result.user); setNeedsAuth(false); }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try { await logout(); setNeedsAuth(true); setUser(null); }
    catch (err) { console.error('Logout failed:', err); }
  };

  const handleUpdateSection = (updated: PhotoSection) => {
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleResetProcedures = () => {
    if (confirm('Deseja restaurar a tabela de termos e valores para as definições originais do sistema?')) {
      setProcedures(DEFAULT_PROCEDURES);
    }
  };

  const handleResetAll = () => {
    setSections(INITIAL_SECTIONS);
    setProposal(INITIAL_PROPOSAL);
    setCurrentFileId(null);
    setActiveTab('editor');
  };

  const handleNewProposalForPatient = (patientName: string) => {
    setSections(INITIAL_SECTIONS);
    setProposal({ ...INITIAL_PROPOSAL, patientName });
    setCurrentFileId('NEW_FILE');
    setCurrentAppView('crm');
    setActiveTab('registration');
    setShowPatientsModal(false);
  };

  const handleLoadPatientData = (data: any) => {
    if (data.procedures) setProcedures(data.procedures);
    if (data.sections) {
      const merged = INITIAL_SECTIONS.map((initSec) => {
        const existing = data.sections.find((s: PhotoSection) => s.id === initSec.id);
        return existing || initSec;
      });
      setSections(merged);
    }
    if (data.proposal) setProposal(data.proposal);
    if (data.__fileId) setCurrentFileId(data.__fileId);
    if (data.selectedPlanIndex !== undefined) {
      localStorage.setItem('ag_neg_selected_plan', data.selectedPlanIndex.toString());
    }
    setCurrentAppView('crm');
    setActiveTab('editor');
    setShowPatientsModal(false);
  };

  const handleLoadSamplePlan = () => {
    setProcedures(DEFAULT_PROCEDURES);
    setProposal({
      patientName: 'VALDERMON DA SILVA LOPES',
      notes: 'Orçamento feito sem radiografia atual pós trat. de canal, podendo haver alterações posteriores.',
      discountPercent: 5,
      pixDiscountLabel: '5% DESCONTO NO PIX',
      installments: 12,
      installmentsLabel: 'Parcelamento em até 12x (com taxas).',
      customDiscountAmount: 0,
      showTotalBySection: true,
      markerSize: 26,
    });
    const mockSections: PhotoSection[] = [
      { id: 'upper', title: 'Arcada Superior', subtitle: 'Dentes Posteriores e Anteriores Superiores', image: DEMO_SVG_PLACEHOLDERS.upper, markers: [
        { id: 'upper-14', toothNumber: 14, x: 50.5, y: 25.5, procedures: ['p2'] },
        { id: 'upper-15', toothNumber: 15, x: 53.5, y: 35.5, procedures: ['p2'] },
        { id: 'upper-16', toothNumber: 16, x: 54.8, y: 46.5, procedures: ['p4'] },
        { id: 'upper-17', toothNumber: 17, x: 58.5, y: 56.5, procedures: ['p5'] },
        { id: 'upper-24', toothNumber: 24, x: 30.2, y: 26.5, procedures: ['p2'] },
        { id: 'upper-26', toothNumber: 26, x: 23.5, y: 52.5, procedures: ['p5'] },
      ]},
      { id: 'lower', title: 'Arcada Inferior', subtitle: 'Dentes Posteriores e Anteriores Inferiores', image: DEMO_SVG_PLACEHOLDERS.lower, markers: [
        { id: 'lower-47', toothNumber: 47, x: 34.5, y: 28.5, procedures: ['p1'] },
        { id: 'lower-45', toothNumber: 45, x: 41.5, y: 42.5, procedures: ['p2'] },
        { id: 'lower-44', toothNumber: 44, x: 43.5, y: 49.5, procedures: ['p4'] },
        { id: 'lower-34', toothNumber: 34, x: 58.5, y: 49.5, procedures: ['p5'] },
        { id: 'lower-35', toothNumber: 35, x: 60.5, y: 42.5, procedures: ['p5'] },
        { id: 'lower-37', toothNumber: 37, x: 64.5, y: 28.5, procedures: ['p5'] },
      ]},
      { id: 'smile', title: 'Estética do Sorriso', subtitle: 'Mapeamento de Dentes Anteriores e Estética', image: DEMO_SVG_PLACEHOLDERS.smile, markers: [
        { id: 'smile-12', toothNumber: 12, x: 27.2, y: 26.5, procedures: ['p1'] },
        { id: 'smile-11', toothNumber: 11, x: 32.5, y: 27.0, procedures: ['p1'] },
        { id: 'smile-21', toothNumber: 21, x: 37.2, y: 27.0, procedures: ['p1'] },
        { id: 'smile-22', toothNumber: 22, x: 42.0, y: 26.5, procedures: ['p1'] },
        { id: 'smile-23', toothNumber: 23, x: 45.8, y: 26.0, procedures: ['p1', 'p5'] },
        { id: 'smile-43', toothNumber: 43, x: 27.2, y: 32.5, procedures: ['p1'] },
        { id: 'smile-42', toothNumber: 42, x: 30.5, y: 32.5, procedures: ['p1'] },
        { id: 'smile-41', toothNumber: 41, x: 34.5, y: 32.5, procedures: ['p1'] },
        { id: 'smile-31', toothNumber: 31, x: 38.5, y: 32.5, procedures: ['p1'] },
      ]},
    ];
    setSections(mockSections);
    setActiveTab('negotiation');
  };

  const hasAnyMarkers = sections.some((s) => s.markers.length > 0);

  // --- RENDER: Special URL modes ---
  if (urlMode === 'patient_mapping' || urlMode === 'patient') {
    return <PatientScreen hideSimulation={false} />;
  }

  if (urlMode === 'anamnese') {
    return <PatientAnamnesisForm />;
  }

  // --- RENDER: Login Screen ---
  if (needsAuth) {
    return <LoginScreen onLogin={handleLogin} isLoggingIn={isLoggingIn} />;
  }

  // --- RENDER: Mobile-optimized workspace ---
  if (isMobileOptimized) {
    return (
      <div className="app-shell">
        <Sidebar
          currentView={currentAppView}
          onChangeView={setCurrentAppView}
          onLogout={handleLogout}
          clinicSettings={clinicSettings}
          collapsed={false}
          onToggleCollapse={() => {}}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="main-content">
          <TopBar
            currentView={currentAppView}
            proposal={proposal}
            onChangeView={setCurrentAppView}
            onOpenMobileMenu={() => setMobileSidebarOpen(true)}
            isMobileOptimized={isMobileOptimized}
            setIsMobileOptimized={setIsMobileOptimized}
          />
          <main className="flex-1 mx-auto w-full max-w-md px-2 py-4">
            <MobileWorkspace
              sections={sections}
              onUpdateSection={handleUpdateSection}
              procedures={procedures}
              proposal={proposal}
              setProposal={setProposal}
              clinicSettings={clinicSettings}
              onExitMobile={() => setIsMobileOptimized(false)}
              onNewProposalForPatient={handleNewProposalForPatient}
            />
          </main>
        </div>
      </div>
    );
  }

  // --- RENDER: Main Desktop App ---
  return (
    <div className="app-shell">
      <Sidebar
        currentView={currentAppView}
        onChangeView={setCurrentAppView}
        onLogout={handleLogout}
        clinicSettings={clinicSettings}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <TopBar
          currentView={currentAppView}
          proposal={proposal}
          onChangeView={setCurrentAppView}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          isMobileOptimized={isMobileOptimized}
          setIsMobileOptimized={setIsMobileOptimized}
        />

        {/* ── Dashboard ───────────────────────────────────────── */}
        {currentAppView === 'dashboard' && (
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8 max-w-7xl w-full mx-auto animate-fade-in-up">
            <DashboardView
              clinicSettings={clinicSettings}
              proposal={proposal}
              onNavigateToPlanning={(patientName, status) => {
                if (patientName) {
                  setProposal((prev) => ({ ...prev, patientName, status: (status || 'Em Andamento') as any }));
                }
                setCurrentAppView('crm');
              }}
              onOpenPatient={(patientName) => {
                setCrmPatientName(patientName);
                setCurrentAppView('crm');
              }}
              onOpenRegistry={() => { 
                setCurrentAppView('crm'); 
              }}
              onOpenPatientsList={() => { setCurrentAppView('crm'); }}
              onOpenCalendar={() => setCurrentAppView('calendar')}
              isMobileOptimized={isMobileOptimized}
              setIsMobileOptimized={setIsMobileOptimized}
            />
          </main>
        )}

        {/* ── CRM ─────────────────────────────────────────────── */}
        {currentAppView === 'crm' && (
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8 w-full animate-fade-in-up">
            <DentalCRMView
              onLoadPatientData={handleLoadPatientData}
              onNewProposal={handleNewProposalForPatient}
              onChangeView={setCurrentAppView}
              clinicSettings={clinicSettings}
              setClinicSettings={setClinicSettings}
              initialPatientName={crmPatientName}
              onClearInitialPatient={() => setCrmPatientName(undefined)}
              onNewAppointment={(patientName) => {
                setAppointmentPatientName(patientName);
                setCurrentAppView('calendar');
              }}
              procedures={procedures}
              setProcedures={setProcedures}
              currentFileId={currentFileId}
              setCurrentFileId={setCurrentFileId}
            />
          </main>
        )}

        {/* ── Calendar ─────────────────────────────────────────── */}
        {currentAppView === 'calendar' && (
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8 w-full h-[calc(100vh-60px)] animate-fade-in-up">
            <CalendarView
              onNewPatient={() => { handleResetAll(); setCurrentAppView('crm'); }}
              initialPatientName={appointmentPatientName}
              onClearInitialPatient={() => setAppointmentPatientName(undefined)}
            />
          </main>
        )}

        {/* ── Settings ────────────────────────────────────────── */}
        {currentAppView === 'settings' && (
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8 max-w-7xl w-full mx-auto animate-fade-in-up">
            <SettingsView
              currentTheme={currentTheme}
              onChangeTheme={setCurrentTheme}
              clinicSettings={clinicSettings}
            />
          </main>
        )}

        {/* ── 3D Planning Module (Sprint 1) ────────────────────── */}
        {currentAppView === '3d-planning' && (
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8 w-full animate-fade-in-up">
            <TreatmentPlanning3D />
          </main>
        )}

        {/* Footer */}
        <footer className="bg-white border-t border-[#E6DEC9] py-4 px-6 print:hidden mt-auto">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <AFLogoSVG className="w-6 h-6" />
              <div>
                <p className="text-[11px] font-bold text-[#8B0000] tracking-wider uppercase" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Dr. Agnaldo Ferreira
                </p>
                <p className="text-[9px] text-zinc-400 font-mono tracking-widest">
                  ODONTOLOGIA RESTAURADORA
                </p>
              </div>
            </div>
            <p className="text-[10px] text-zinc-400">
              {new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </footer>
      </div>

      {showPatientsModal && (
        <PatientsModal
          onClose={() => setShowPatientsModal(false)}
          onLoadPatient={handleLoadPatientData}
          onNewProposal={handleNewProposalForPatient}
          clinicSettings={clinicSettings}
          onNewAppointment={(patientName) => {
            setShowPatientsModal(false);
            setAppointmentPatientName(patientName);
            setCurrentAppView('calendar');
          }}
        />
      )}
    </div>
  );
}
