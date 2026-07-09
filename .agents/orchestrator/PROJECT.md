# Project: Financeiro Sidebar Tab & Budget Payment Integration

## Architecture
- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons. Main app shell in `src/App.tsx`.
- **CRM / Budget Module**: Sub-components like `src/components/DentalCRMView.tsx`, `src/components/NegotiationTab.tsx`.
- **Backend / Database**: Supabase client (`src/lib/supabase.ts`) storing data in a single table `clinic_data` under the JSON column `crm_data`. CRM database helper methods in `src/lib/supabaseCrm.ts`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Codebase Exploration | Analyze how budgets are structured, saved, and retrieved. Locate sidebar layout, proposal forms, and state management. | None | DONE |
| 2 | Budget Payment Method & Backend Integration | Add payment method selection to the budget module. Update database saves to record closed budgets as payments in the backend. | 1 | DONE |
| 3 | Financeiro Tab & View Component | Add the sidebar tab "Financeiro" with `Coins` icon. Create a new `FinancialView` component showing closed budgets/payments. | 2 | DONE |
| 4 | Verification & E2E/Adversarial Testing | Run verification tests and code style audit to verify everything functions properly without integrity issues. | 3 | DONE |

## Interface Contracts
- **Supabase CRM Data Structure**:
  - Existing CRM JSON (`crm_data`) structure will be extended/utilized to hold payment records in `pagamentos` or as part of patient proposals.
  - Payment object fields: `id`, `patientName`, `amount`, `paymentMethod`, `date`, `proposalId`.
