// Verification Script for Challenger 2
// Testing deduplicatedPayments logic in FinancialView and Dashboard counter logic in DashboardView

const assert = require('assert');

console.log('=== STARTING EMPIRICAL VERIFICATION TESTS ===\n');

// ==========================================
// TEST SUITE 1: FinancialView deduplicatedPayments
// ==========================================

function deduplicatePayments(payments) {
  const map = new Map();
  payments.forEach(p => {
    const key = p.procedureId 
      ? `proc:${p.procedureId}` 
      : p.appointmentId 
      ? `appt:${p.appointmentId}` 
      : `${(p.patientId || p.patientName || '').toLowerCase().trim()}_${(p.description || '').toLowerCase().trim()}_${p.amount}_${p.date.split('T')[0]}`;

    if (!map.has(key) || p.status === 'Pago') {
      map.set(key, p);
    }
  });
  return Array.from(map.values());
}

console.log('--- TEST 1.1: Same patient name, date, amount, description but NO patientId or procedureId/appointmentId ---');
const payments1 = [
  { id: 'pay1', patientName: 'Carlos Silva', description: 'Limpeza', amount: 200, date: '2026-07-22T10:00:00Z', status: 'Pago' },
  { id: 'pay2', patientName: 'Carlos Silva', description: 'Limpeza', amount: 200, date: '2026-07-22T14:00:00Z', status: 'Pago' }
];
const result1 = deduplicatePayments(payments1);
console.log(`Input: 2 distinct payments (10:00 and 14:00) of R$ 200 each.`);
console.log(`Output count: ${result1.length}`);
console.log(`Resulting IDs kept: ${result1.map(r => r.id).join(', ')}`);
if (result1.length === 1) {
  console.log('❌ BUG CONFIRMED: Valid separate payments were improperly deduplicated into 1 payment, losing R$ 200 revenue!\n');
} else {
  console.log('✅ Passed\n');
}

console.log('--- TEST 1.2: Date format differences (ISO vs pt-BR string) ---');
const payments2 = [
  { id: 'pay1', patientName: 'Ana Souza', description: 'Consulta', amount: 150, date: '2026-07-22T10:00:00Z', status: 'Pago' },
  { id: 'pay2', patientName: 'Ana Souza', description: 'Consulta', amount: 150, date: '22/07/2026, 10:00:00', status: 'Pago' }
];
const result2 = deduplicatePayments(payments2);
console.log(`Input: 2 duplicate payments, one with ISO date and one with pt-BR date string.`);
console.log(`Output count: ${result2.length}`);
if (result2.length === 2) {
  console.log('❌ BUG CONFIRMED: Duplicate payment was NOT deduplicated because split("T")[0] produced different keys ("2026-07-22" vs "22/07/2026, 10:00:00")!\n');
} else {
  console.log('✅ Passed\n');
}

console.log('--- TEST 1.3: Missing date field (undefined / null) ---');
try {
  const payments3 = [
    { id: 'pay1', patientName: 'Bruno', description: 'Proc', amount: 100, date: undefined, status: 'Pago' }
  ];
  deduplicatePayments(payments3);
  console.log('✅ Handled smoothly\n');
} catch (err) {
  console.log(`❌ BUG CONFIRMED: Exception thrown on missing date: ${err.message}\n`);
}

console.log('--- TEST 1.4: Special characters and accents in patientName/description ---');
const payments4 = [
  { id: 'pay1', patientName: 'João José', description: 'Restauração', amount: 300, date: '2026-07-22T10:00:00Z', status: 'Pago' },
  { id: 'pay2', patientName: 'Joao Jose', description: 'Restauracao', amount: 300, date: '2026-07-22T10:00:00Z', status: 'Pago' }
];
const result4 = deduplicatePayments(payments4);
console.log(`Input: 2 identical payments except one has accents ("João José / Restauração") and one does not.`);
console.log(`Output count: ${result4.length}`);
if (result4.length === 2) {
  console.log('❌ BUG CONFIRMED: Accents caused key mismatch, failing to deduplicate duplicates.\n');
} else {
  console.log('✅ Passed\n');
}


// ==========================================
// TEST SUITE 2: DashboardView Summary Card Counters
// ==========================================

console.log('--- TEST 2.1: Summary Card Counters with all appointment status values ---');

const allStatuses = ['Confirmado', 'Pendente', 'Cancelado', 'Falta', 'Faltou', 'Agendado', 'Reagendado', 'Atendido'];

const sampleAppointments = allStatuses.map((st, i) => ({
  id: `appt_${i}`,
  patientName: `Patient ${i}`,
  service: 'Consulta',
  status: st,
  estimatedValue: 200
}));

const totalConsultas = sampleAppointments.length;
const confirmadas = sampleAppointments.filter(a => a.status === 'Confirmado').length;
const faltas = sampleAppointments.filter(a => a.status === 'Falta' || a.status === 'Faltou').length;
const pendentes = sampleAppointments.filter(a => a.status === 'Pendente' || a.status === 'Agendado' || a.status === 'Reagendado').length;

const sumBreakdown = confirmadas + faltas + pendentes;

console.log(`Total Consultas (appointments.length): ${totalConsultas}`);
console.log(`Confirmadas: ${confirmadas}`);
console.log(`Faltas: ${faltas}`);
console.log(`Pendentes: ${pendentes}`);
console.log(`Sum of Breakdown Cards: ${sumBreakdown}`);
console.log(`Unaccounted Statuses Count: ${totalConsultas - sumBreakdown}`);

const unaccounted = sampleAppointments.filter(a => 
  a.status !== 'Confirmado' &&
  a.status !== 'Falta' &&
  a.status !== 'Faltou' &&
  a.status !== 'Pendente' &&
  a.status !== 'Agendado' &&
  a.status !== 'Reagendado'
);

console.log(`Unaccounted Statuses: ${unaccounted.map(a => a.status).join(', ')}`);

if (totalConsultas !== sumBreakdown) {
  console.log(`❌ BUG CONFIRMED: Total Consultas (${totalConsultas}) does NOT equal sum of breakdown cards (${sumBreakdown}). Statuses 'Atendido' and 'Cancelado' are completely ignored in breakdown cards!\n`);
} else {
  console.log('✅ Passed\n');
}

console.log('--- TEST 2.2: Revenue calculation vs appointment status ---');
const dailyScheduledRevenue = sampleAppointments
  .filter(a => a.status !== 'Cancelado')
  .reduce((sum, a) => sum + (a.estimatedValue || 0), 0);

console.log(`Total estimated value of all 8 appointments: ${8 * 200} = R$ 1600`);
console.log(`dailyScheduledRevenue (excluding 'Cancelado'): R$ ${dailyScheduledRevenue}`);
console.log(`Note: Appointments with status 'Falta' and 'Faltou' are INCLUDED in scheduled revenue (R$ 400). Is that intended?\n`);

console.log('=== END OF VERIFICATION TESTS ===');
