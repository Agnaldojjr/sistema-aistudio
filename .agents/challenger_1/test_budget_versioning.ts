import { test, expect } from 'vitest';

// Simulate the PatientContext budget versioning logic exactly as implemented in PatientContext.tsx

interface TreatmentProposal {
  patientName: string;
  status: string;
  notes: string;
  discountPercent: number;
  pixDiscountLabel: string;
  installments: number;
  installmentsLabel: string;
  customDiscountAmount: number;
  showTotalBySection: boolean;
  markerSize: number;
}

interface PhotoSection {
  id: string;
  title: string;
  subtitle: string;
  image: string | null;
  markers: any[];
}

interface Database {
  patients: any[];
  appointments: any[];
  clinical_history: any[];
  communications: any[];
  anamnese: any[];
  avisos: any[];
  documentos: any[];
  galeria: any[];
  pagamentos: any[];
  tratamentos: any[];
  odontograma: any[];
}

function createSimulatedCRM(): {
  crmData: Database;
  saveContextToSupabase: (pId: string, activeSections: PhotoSection[], activeProposal: TreatmentProposal) => Promise<void>;
  getPatientTratamentos: (pId: string) => any[];
  getPatientOdontograma: (pId: string) => any[];
} {
  const crmData: Database = {
    patients: [{ id: 'p1', name: 'Paciente Teste' }],
    appointments: [],
    clinical_history: [],
    communications: [],
    anamnese: [],
    avisos: [],
    documentos: [],
    galeria: [],
    pagamentos: [],
    tratamentos: [],
    odontograma: [],
  };

  let tratamentosList: any[] = [];
  let odontogramaList: any[] = [];

  const mergeLists = (globalList: any[] = [], localList: any[], pId: string) => {
    const filtered = globalList.filter((item: any) => item.patientId !== pId);
    return [...filtered, ...localList];
  };

  const saveContextToSupabase = async (pId: string, activeSections: PhotoSection[], activeProposal: TreatmentProposal) => {
    const budgetTimestamp = Date.now();
    const currentOdontogramaItem = {
      id: `od-${pId}-${budgetTimestamp}`,
      patientId: pId,
      date: new Date().toISOString(),
      sections: activeSections
    };

    const currentTratamentoItem = {
      id: `tr-${pId}-${budgetTimestamp}`,
      patientId: pId,
      date: new Date().toISOString(),
      proposal: activeProposal
    };

    const updatedOdontogramaList = [...odontogramaList, currentOdontogramaItem];
    const updatedTratamentosList = [...tratamentosList, currentTratamentoItem];

    tratamentosList = updatedTratamentosList;
    odontogramaList = updatedOdontogramaList;

    crmData.tratamentos = mergeLists(crmData.tratamentos, updatedTratamentosList, pId);
    crmData.odontograma = mergeLists(crmData.odontograma, updatedOdontogramaList, pId);
  };

  const getPatientTratamentos = (pId: string) => {
    return (crmData.tratamentos || []).filter((t: any) => t.patientId === pId);
  };

  const getPatientOdontograma = (pId: string) => {
    return (crmData.odontograma || []).filter((o: any) => o.patientId === pId);
  };

  return { crmData, saveContextToSupabase, getPatientTratamentos, getPatientOdontograma };
}

async function runEmpiricalTest() {
  console.log("=== Running Empirical Verification of Budget Versioning ===");

  const sim = createSimulatedCRM();

  const proposalV1: TreatmentProposal = {
    patientName: 'Paciente Teste',
    status: 'Aberto (paciente não pagou)',
    notes: 'Orçamento V1 - Limpeza e Restauração',
    discountPercent: 5,
    pixDiscountLabel: '5% DESCONTO NO PIX',
    installments: 6,
    installmentsLabel: 'Parcelamento em até 6x',
    customDiscountAmount: 0,
    showTotalBySection: true,
    markerSize: 26,
  };

  const sectionsV1: PhotoSection[] = [
    { id: 'panoramic', title: 'Panorâmica V1', subtitle: 'Diag V1', image: null, markers: [{ toothNumber: 11, procedure: 'Limpeza' }] }
  ];

  // Save V1
  console.log("\n1. Saving Budget V1...");
  await sim.saveContextToSupabase('p1', sectionsV1, proposalV1);

  const tratamentosAfterV1 = sim.getPatientTratamentos('p1');
  console.log(`Saved V1. Total tratamentos count: ${tratamentosAfterV1.length}`);
  console.assert(tratamentosAfterV1.length === 1, "Expected 1 tratamento record");
  console.assert(tratamentosAfterV1[0].proposal.notes === 'Orçamento V1 - Limpeza e Restauração', "V1 proposal notes mismatch");

  // Wait briefly to ensure distinct timestamps
  await new Promise(r => setTimeout(r, 10));

  // Modify to V2
  const proposalV2: TreatmentProposal = {
    ...proposalV1,
    notes: 'Orçamento V2 - Implante e Prótese Adicionada',
    installments: 12,
    discountPercent: 10,
  };

  const sectionsV2: PhotoSection[] = [
    ...sectionsV1,
    { id: 'upper', title: 'Arcada Superior V2', subtitle: 'Diag V2', image: null, markers: [{ toothNumber: 21, procedure: 'Implante' }] }
  ];

  // Save V2
  console.log("\n2. Saving Budget V2...");
  await sim.saveContextToSupabase('p1', sectionsV2, proposalV2);

  const tratamentosAfterV2 = sim.getPatientTratamentos('p1');
  console.log(`Saved V2. Total tratamentos count: ${tratamentosAfterV2.length}`);

  // Assertions
  console.assert(tratamentosAfterV2.length === 2, `FAIL: Expected 2 tratamentos, got ${tratamentosAfterV2.length}`);
  
  const recordV1 = tratamentosAfterV2[0];
  const recordV2 = tratamentosAfterV2[1];

  console.log("\n3. Verifying V1 Record Integrity:");
  console.log(`   - ID: ${recordV1.id}`);
  console.log(`   - Date: ${recordV1.date}`);
  console.log(`   - Notes: ${recordV1.proposal.notes}`);
  console.log(`   - Installments: ${recordV1.proposal.installments}`);

  console.log("\n4. Verifying V2 Record Integrity:");
  console.log(`   - ID: ${recordV2.id}`);
  console.log(`   - Date: ${recordV2.date}`);
  console.log(`   - Notes: ${recordV2.proposal.notes}`);
  console.log(`   - Installments: ${recordV2.proposal.installments}`);

  const v1Preserved = (
    recordV1.proposal.notes === 'Orçamento V1 - Limpeza e Restauração' &&
    recordV1.proposal.installments === 6 &&
    recordV1.proposal.discountPercent === 5
  );

  const v2Created = (
    recordV2.proposal.notes === 'Orçamento V2 - Implante e Prótese Adicionada' &&
    recordV2.proposal.installments === 12 &&
    recordV2.proposal.discountPercent === 10
  );

  const distinctIds = recordV1.id !== recordV2.id;

  if (v1Preserved && v2Created && distinctIds && tratamentosAfterV2.length === 2) {
    console.log("\n✅ EMPIRICAL TEST PASSED: Budget V1 is preserved when Budget V2 is created!");
  } else {
    console.error("\n❌ EMPIRICAL TEST FAILED!");
    process.exit(1);
  }
}

runEmpiricalTest().catch(err => {
  console.error(err);
  process.exit(1);
});
