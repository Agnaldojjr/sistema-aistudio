# Project: Real-time Sync & Financial Unification (sistema-aistudio)

## Architecture
- React + TypeScript + Supabase system for dental clinic management.
- Key views: `DashboardView.tsx` (Agenda do Dia & Cards), `CalendarView.tsx` (Agenda Principal), `DentalCRMView.tsx` (CRM & Patients/Budgets), `FinancialView.tsx` (Lançamentos Financeiros).
- Unified state / event bus: Window custom events (`appointments-updated`) + Supabase DB persistence.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Diagnosis | Map state flow between DashboardView, CalendarView, DentalCRMView, budget & financial modules using systematic-debugging | none | DONE |
| 2 | Real-time Sync & Card Reconciliation | Implement single-source-of-truth state updates for Dashboard, Calendar, CRM and card counters | M1 | DONE |
| 3 | Financial Unification | Link budget procedures with schedule appointments to prevent duplicate financial entries | M1, M2 | DONE |
| 4 | Verification & GitHub Deploy | Verify `npm run build`, forensic audit, code review, commit and push to remote GitHub repo | M2, M3 | DONE |

## Interface Contracts
- Appointments state dispatches `appointments-updated` event so changes in DashboardView, CalendarView, or DentalCRMView sync instantly without page refresh (F5).
- Card counters in DashboardView compute dynamically with normalized status matching (`Falta`/`Faltou`, `Pendente`/`Agendado`/`Reagendado`, `Atendido`).
- Financial entries generated from budgets and schedule share deterministic reference IDs (`pay-proc-${procedureId}`, `pay-appt-${appointmentId}`, `pay-budget-${budgetId}`) and relation keys (`procedureId`, `appointmentId`) to prevent duplicate entry addition.
