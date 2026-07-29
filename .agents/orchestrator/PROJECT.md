# Project: Budget Versioning, Planning Integration, Cloud Drive Gallery & Photo Upload Fix

## Architecture
- React + TypeScript + Supabase system for dental clinic management (`sistema-aistudio`).
- Key components: `DentalCRMView.tsx` (Patient detail modal, Planning tab, Budget tab, Cloud Drive tab, Patient info), `DashboardView.tsx`, `CalendarView.tsx`, `FinancialView.tsx`.
- State & Data Layer: Patient state in React (`DentalCRMView` state / custom hooks / local storage / Supabase database tables).
- File storage / Cloud Drive: Supabase storage buckets or local mock file arrays.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Diagnosis | Map existing budget structure, planning-to-budget state flow, tab lag root causes, cloud drive file handling, and photo upload array mutation logic | none | IN_PROGRESS |
| 2 | Budget Versioning & Planning Integration | Support multiple independent & versioned budgets (V1, V2) without overwriting. Optimize tab switching performance and auto-populate budget from planning data | M1 | PLANNED |
| 3 | Cloud Drive Segregation & Visual Gallery + Upload Fix | Auto-route budget PDFs into dedicated "Orçamentos" folder, render main Cloud Drive as visual photo grid with document icons, and fix patient screen 3-photo -> 2-photo upload bug | M1 | PLANNED |
| 4 | Verification, Data Safety Audit & Git Push | Run build & test validation, verify 100% CRM registration data preservation, run Forensic Audit, code review, commit and push to remote GitHub repo | M2, M3 | PLANNED |

## Interface Contracts
- Budget data model: Supports `budgets` array per patient, with distinct `id`, `version` (e.g. 1, 2 or "V1", "V2"), `parentBudgetId` (for versioning), `createdAt`, `status`, and procedure line items.
- Tab navigation in `DentalCRMView`: Zero blocking state re-renders or unneeded heavy recalculations when toggling between "Planejamento" and "Orçamentos".
- Cloud Drive folder structure: Root view segregates files by folder (`Orçamentos` folder for budget PDFs). Root displays photos in visual image grid, PDFs/Docs with icons.
- Patient photo upload state: Pure append/set operation for `photos` array preserving all $N$ uploaded photos without off-by-one truncation or slice overwrite bugs.
- CRM Data Safety: Zero destructive updates/deletes to patient registration fields (`name`, `cpf`, `phone`, `email`, `address`, `medicalHistory`, etc.). Only append/upsert budget and photo records safely.

## Code Layout
- `src/components/DentalCRMView.tsx`: Main CRM component holding patient state, tabs (Planning, Budgets, Cloud Drive, Photos).
- `src/types/index.ts` / `src/types/crm.ts`: TypeScript interfaces for Patient, Budget, Planning, CloudDriveFile.
- `src/services/` or state utilities handling persistence & budget calculations.
