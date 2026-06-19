import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getGoogleDriveCRMDatabase, saveGoogleDriveCRMDatabase } from '../lib/driveCrm';
import { CRMPatient, CRMAppointment, CRMClinicalHistory, CRMCommunication, PhotoSection, TreatmentProposal } from '../types';
import { DEFAULT_PROPOSAL, DEMO_SVG_PLACEHOLDERS } from '../constants'; // we might need to export INITIAL_SECTIONS and INITIAL_PROPOSAL from constants or App.tsx

interface PatientContextData {
  selectedPatient: CRMPatient | null;
  setSelectedPatient: (patient: CRMPatient | null) => void;
  
  appointments: CRMAppointment[];
  setAppointments: (appointments: CRMAppointment[]) => void;
  
  clinicalHistory: CRMClinicalHistory[];
  setClinicalHistory: (history: CRMClinicalHistory[]) => void;
  
  communications: CRMCommunication[];
  setCommunications: (comms: CRMCommunication[]) => void;
  
  anamneseList: any[];
  setAnamneseList: (list: any[]) => void;
  
  avisosList: any[];
  setAvisosList: (list: any[]) => void;
  
  documentosList: any[];
  setDocumentosList: (list: any[]) => void;
  
  galeriaList: any[];
  setGaleriaList: (list: any[]) => void;
  
  pagamentosList: any[];
  setPagamentosList: (list: any[]) => void;
  
  tratamentosList: any[];
  setTratamentosList: (list: any[]) => void;
  
  odontogramaList: any[];
  setOdontogramaList: (list: any[]) => void;
  
  // Active Planning Tab states (Odontograma & Orçamento)
  activeSections: PhotoSection[];
  setActiveSections: (sections: PhotoSection[]) => void;
  activeProposal: TreatmentProposal;
  setActiveProposal: (proposal: TreatmentProposal) => void;
  
  // Ações baseadas em "Botões de Salvar"
  saveContextToDrive: () => Promise<void>;
  isSavingToDrive: boolean;
  
  // Função para recarregar tudo do Drive
  refreshPatientSubModules: (patientId: string) => Promise<void>;
}

const PatientContext = createContext<PatientContextData | undefined>(undefined);

// Define default initial states for Planning
const INITIAL_SECTIONS: PhotoSection[] = [
  { id: 'panoramic', title: 'Radiografia Panorâmica', subtitle: 'Planejamento de Implantes e Diagnósticos Gerais', image: null, markers: [] },
  { id: 'upper', title: 'Arcada Superior', subtitle: 'Dentes Posteriores e Anteriores Superiores', image: null, markers: [] },
  { id: 'lower', title: 'Arcada Inferior', subtitle: 'Dentes Posteriores e Anteriores Inferiores', image: null, markers: [] },
  { id: 'smile', title: 'Estética do Sorriso', subtitle: 'Mapeamento de Dentes Anteriores e Estética', image: null, markers: [] },
];

const INITIAL_PROPOSAL: TreatmentProposal = {
  patientName: '',
  status: 'Aberto (paciente não pagou)',
  notes: 'Orçamento feito sem radiografia atual pós trat. de canal, podendo haver alterações posteriores.',
  discountPercent: 5,
  pixDiscountLabel: '5% DESCONTO NO PIX',
  installments: 12,
  installmentsLabel: 'Parcelamento em até 12x (com taxas).',
  customDiscountAmount: 0,
  showTotalBySection: true,
  markerSize: 26,
};

export function PatientProvider({ children }: { children: ReactNode }) {
  const [selectedPatient, setSelectedPatient] = useState<CRMPatient | null>(null);
  const [appointments, setAppointments] = useState<CRMAppointment[]>([]);
  const [clinicalHistory, setClinicalHistory] = useState<CRMClinicalHistory[]>([]);
  const [communications, setCommunications] = useState<CRMCommunication[]>([]);
  const [anamneseList, setAnamneseList] = useState<any[]>([]);
  const [avisosList, setAvisosList] = useState<any[]>([]);
  const [documentosList, setDocumentosList] = useState<any[]>([]);
  const [galeriaList, setGaleriaList] = useState<any[]>([]);
  const [pagamentosList, setPagamentosList] = useState<any[]>([]);
  const [tratamentosList, setTratamentosList] = useState<any[]>([]);
  const [odontogramaList, setOdontogramaList] = useState<any[]>([]);
  const [activeSections, setActiveSections] = useState<PhotoSection[]>(INITIAL_SECTIONS);
  const [activeProposal, setActiveProposal] = useState<TreatmentProposal>(INITIAL_PROPOSAL);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);

  const refreshPatientSubModules = useCallback(async (patientId: string) => {
    if (!patientId) return;
    try {
      const crmData = await getGoogleDriveCRMDatabase();
      
      setAppointments((crmData.appointments || []).filter((a: any) => a.patientId === patientId));
      setClinicalHistory((crmData.clinical_history || []).filter((h: any) => h.patientId === patientId));
      setCommunications((crmData.communications || []).filter((c: any) => c.patientId === patientId));
      setAnamneseList((crmData.anamnese || []).filter((a: any) => a.patientId === patientId));
      setAvisosList((crmData.avisos || []).filter((a: any) => a.patientId === patientId));
      setDocumentosList((crmData.documentos || []).filter((d: any) => d.patientId === patientId));
      setGaleriaList((crmData.galeria || []).filter((g: any) => g.patientId === patientId));
      setPagamentosList((crmData.pagamentos || []).filter((p: any) => p.patientId === patientId));
      setTratamentosList((crmData.tratamentos || []).filter((t: any) => t.patientId === patientId));
      setOdontogramaList((crmData.odontograma || []).filter((o: any) => o.patientId === patientId));

      // Auto-load Active Sections and Proposal for this patient
      const latestOdontograma = (crmData.odontograma || []).filter((o: any) => o.patientId === patientId).pop();
      if (latestOdontograma && latestOdontograma.sections) {
        setActiveSections(latestOdontograma.sections);
      } else {
        setActiveSections(INITIAL_SECTIONS);
      }

      const latestTratamento = (crmData.tratamentos || []).filter((t: any) => t.patientId === patientId).pop();
      if (latestTratamento && latestTratamento.proposal) {
        setActiveProposal(latestTratamento.proposal);
      } else {
        const pName = (crmData.patients || []).find((p: any) => p.id === patientId)?.name || '';
        setActiveProposal({ ...INITIAL_PROPOSAL, patientName: pName });
      }
    } catch (err) {
      console.error("Falha ao recarregar dados do paciente:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      refreshPatientSubModules(selectedPatient.id);
    } else {
      setAppointments([]);
      setClinicalHistory([]);
      setCommunications([]);
      setAnamneseList([]);
      setAvisosList([]);
      setDocumentosList([]);
      setGaleriaList([]);
      setPagamentosList([]);
      setTratamentosList([]);
      setOdontogramaList([]);
      setActiveSections(INITIAL_SECTIONS);
      setActiveProposal(INITIAL_PROPOSAL);
    }
  }, [selectedPatient, refreshPatientSubModules]);

  const saveContextToDrive = async () => {
    if (!selectedPatient) return;
    setIsSavingToDrive(true);
    try {
      const crmData = await getGoogleDriveCRMDatabase();
      const pId = selectedPatient.id;

      // Atualiza o paciente global
      if (crmData.patients) {
        const pIndex = crmData.patients.findIndex((p: any) => p.id === pId);
        if (pIndex !== -1) {
          crmData.patients[pIndex] = { ...crmData.patients[pIndex], ...selectedPatient };
        } else {
          crmData.patients.push(selectedPatient);
        }
      }

      // Substitui as listas deste paciente no banco global
      const mergeLists = (globalList: any[] = [], localList: any[]) => {
        const filtered = globalList.filter((item: any) => item.patientId !== pId);
        return [...filtered, ...localList];
      };

      crmData.appointments = mergeLists(crmData.appointments, appointments);
      crmData.clinical_history = mergeLists(crmData.clinical_history, clinicalHistory);
      crmData.communications = mergeLists(crmData.communications, communications);
      crmData.anamnese = mergeLists(crmData.anamnese, anamneseList);
      crmData.avisos = mergeLists(crmData.avisos, avisosList);
      crmData.documentos = mergeLists(crmData.documentos, documentosList);
      crmData.galeria = mergeLists(crmData.galeria, galeriaList);
      crmData.pagamentos = mergeLists(crmData.pagamentos, pagamentosList);
      
      // Upsert the current activeSections into odontogramaList
      const currentOdontogramaItem = {
        id: `od-${pId}`,
        patientId: pId,
        date: new Date().toISOString(),
        sections: activeSections
      };
      
      // Upsert the current activeProposal into tratamentosList
      const currentTratamentoItem = {
        id: `tr-${pId}`,
        patientId: pId,
        date: new Date().toISOString(),
        proposal: activeProposal
      };

      const updatedOdontogramaList = odontogramaList.filter((o: any) => o.id !== `od-${pId}`).concat([currentOdontogramaItem]);
      const updatedTratamentosList = tratamentosList.filter((t: any) => t.id !== `tr-${pId}`).concat([currentTratamentoItem]);

      setOdontogramaList(updatedOdontogramaList);
      setTratamentosList(updatedTratamentosList);

      crmData.tratamentos = mergeLists(crmData.tratamentos, updatedTratamentosList);
      crmData.odontograma = mergeLists(crmData.odontograma, updatedOdontogramaList);

      await saveGoogleDriveCRMDatabase(crmData);
      console.log('Salvo com sucesso no Drive via Context API!');
    } catch (err) {
      console.error("Erro ao salvar no Drive:", err);
      throw err; // Permite que a UI exiba o erro
    } finally {
      setIsSavingToDrive(false);
    }
  };

  return (
    <PatientContext.Provider value={{
      selectedPatient, setSelectedPatient,
      appointments, setAppointments,
      clinicalHistory, setClinicalHistory,
      communications, setCommunications,
      anamneseList, setAnamneseList,
      avisosList, setAvisosList,
      documentosList, setDocumentosList,
      galeriaList, setGaleriaList,
      pagamentosList, setPagamentosList,
      tratamentosList, setTratamentosList,
      odontogramaList, setOdontogramaList,
      activeSections, setActiveSections,
      activeProposal, setActiveProposal,
      saveContextToDrive,
      isSavingToDrive,
      refreshPatientSubModules
    }}>
      {children}
    </PatientContext.Provider>
  );
}

export function usePatientContext() {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatientContext deve ser usado dentro de um PatientProvider');
  }
  return context;
}
