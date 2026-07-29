# CRM Refactoring Analysis Report: Requirements R1 & R2

## Overview
This document provides a comprehensive technical investigation of Requirements R1 and R2 for the CRM refactoring:
- **R1: Non-Overwriting & Versioned Budgets** (support multiple independent budgets per patient and versioned budgets V1, V2 without overwriting existing ones).
- **R2: Planning and Budget Integration** (fix tab switching lag/freezing between Planejamento and Orçamentos, and ensure planning data correctly populates new budget fields).

---

## 1. Budget Representation, Creation, Persistence & Overwrite Investigation (R1)

### 1.1 Current Representation
In the current codebase, a budget/proposal is represented in two main places:
1. **In-Memory / React State**:
   - `activeProposal` (`TreatmentProposal`) and `activeSections` (`PhotoSection[]`) stored in `src/context/PatientContext.tsx` (lines 90-91).
   - `TreatmentProposal` (defined in `src/types.ts:152-165`) holds fields like `patientName`, `status`, `notes`, `discountPercent`, `installments`, `customDiscountAmount`, `paymentMethod`.
   - `PhotoSection[]` (defined in `src/types.ts:44-51`) contains array of `ToothMarker` which holds `procedureInstances` and procedure references.
2. **Supabase Storage (Bucket `patient_files`)**:
   - Proposals are stored as JSON files under path: `${userId}/${patientFolder}/${filename}` (managed by `src/lib/supabaseStorage.ts:21`).
3. **Supabase Database (`crm_database` table)**:
   - Stored inside JSON blobs in `crmData.tratamentos` and `crmData.odontograma` (managed by `src/context/PatientContext.tsx:307-321`).

### 1.2 Creation & Save Mechanism
- **From NegotiationTab (`src/components/NegotiationTab.tsx:1203`)**:
  ```typescript
  // Line 1203 in src/components/NegotiationTab.tsx
  const jsonStr = JSON.stringify(stateToSave);
  const fileBlob = new Blob([jsonStr], { type: 'application/json' });
  await uploadPatientFileToSupabase(patientName, fileBlob, 'orcamento_salvo.json');
  ```
- **Storage Upload Implementation (`src/lib/supabaseStorage.ts:23-27`)**:
  ```typescript
  // Line 23-27 in src/lib/supabaseStorage.ts
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      upsert: true
    });
  ```
- **Context DB Persistence (`src/context/PatientContext.tsx:307-316`)**:
  ```typescript
  // Line 307-316 in src/context/PatientContext.tsx
  const currentOdontogramaItem = {
    id: `od-${pId}`,
    patientId: pId,
    date: new Date().toISOString(),
    sections: activeSections
  };
  const currentTratamentoItem = {
    id: `tr-${pId}`,
    patientId: pId,
    date: new Date().toISOString(),
    proposal: activeProposal
  };
  ```

### 1.3 Why New Budgets Overwrite Existing Ones (Root Cause Analysis)
1. **Hardcoded Filenames**: `NegotiationTab.tsx` always uploads budget state to the static filename `'orcamento_salvo.json'`.
2. **Upsert Flag Enabled**: `uploadPatientFileToSupabase` executes `.upload(..., { upsert: true })`. Thus, uploading to `'orcamento_salvo.json'` unconditionally overwrites any pre-existing budget file for that patient.
3. **Single Hardcoded Key in DB**: `PatientContext.tsx` uses static item IDs `od-${pId}` and `tr-${pId}` for `odontograma` and `tratamentos`. Every save replaces the single entry for the patient.
4. **Lack of Budget Versioning Schema**: There is no concept of a version counter (V1, V2), unique budget IDs (UUIDs), or multiple independent budgets associated with a patient record.

---

## 2. Required Schema & Interface Updates for Independent & Versioned Budgets (R1)

### 2.1 Interface & Type Definitions
To support multiple independent budgets and versioning (V1, V2, V3...), the following schema structures are required in `src/types.ts`:

```typescript
// New Interface for Versioned Budget/Proposal
export interface BudgetVersion {
  id: string; // e.g., "budget-uuid-1234" or "budget-1722259200000"
  patientId: string;
  versionNumber: number; // e.g., 1, 2, 3
  versionLabel: string; // e.g., "V1 - Planejamento Inicial", "V2 - Com Implantes"
  filename: string; // e.g., "orcamento_v1_inicial.json"
  createdAt: string;
  updatedAt: string;
  status: 'Aberto (paciente não pagou)' | 'Aprovado (paciente pagou)' | 'Aguardando Aprovação' | 'Em Andamento' | 'Concluído' | 'Arquivado';
  isPrimary?: boolean; // Flag to designate active budget version
  proposal: TreatmentProposal;
  sections: PhotoSection[]; // Independent snapshot of planning markers
  simulations?: any[]; // Cached calculation columns
  selectedPlanIndex?: number;
  notes?: string;
}
```

### 2.2 Naming & Storage Convention
- **Supabase Storage Filename Pattern**:
  `orcamento_v${versionNumber}_${safeLabel}.json` (e.g., `orcamento_v1_inicial.json`, `orcamento_v2_revisado.json`).
- **Internal JSON Metadata**:
  Each budget JSON file must embed `id`, `patientId`, `versionNumber`, `versionLabel`, `createdAt`, `updatedAt`, `status`, `proposal`, `sections`.

### 2.3 Context & DB Updates
- **`PatientContextData` (in `src/context/PatientContext.tsx`)**:
  - Add `budgetVersions: BudgetVersion[]`.
  - Add `activeBudgetId: string | null`.
  - Add functions: `createNewBudgetVersion(label?: string)`, `switchActiveBudgetVersion(budgetId: string)`, `deleteBudgetVersion(budgetId: string)`.
- **Database Persistence (`crmData.tratamentos`)**:
  - Replace static `tr-${pId}` with individual budget records `tr-${pId}-${budgetId}` or array of version records.

---

## 3. Tab Switching Freezing/Lag Investigation ("Planejamento" vs "Orçamentos") (R2)

### 3.1 Components & Hooks Involved
- **Tab Controller**: `src/components/DentalCRMView.tsx`
  - Sub-tab buttons (lines 5130-5151): Toggle `activeDetailTab` between `'plan_editor'` ("✨ Mapeamento Clínico") and `'plan_negotiation'` ("💰 Emissão de Orçamento").
- **Planejamento Component**: Inline JSX inside `DentalCRMView.tsx` (lines 5155-5408).
- **Orçamentos Component**: `NegotiationTab` in `src/components/NegotiationTab.tsx` (lines 5411-5423).
- **Global State Context**: `PatientContext` in `src/context/PatientContext.tsx`.

### 3.2 Root Causes of Freezing/Lag during Tab Switching
1. **Synchronous Heavy Serialization of Base64 Images**:
   - `activeSections` contains images (`PhotoSection.image`), which are often large base64 Data URLs (1-5MB each).
   - In `PatientContext.tsx` (lines 241-258), every update to `activeSections` executes:
     ```typescript
     localStorage.setItem(`agnaldo_dent_sections_${selectedPatient.id}`, JSON.stringify(activeSections));
     ```
   - In `PatientContext.tsx` (lines 140-151), a `BroadcastChannel` effect sends the complete `activeSections` array (including base64 strings) on every state change.
   - Stringifying and broadcasting megabytes of image strings synchronously blocks the main UI thread during tab toggles.

2. **Un-memoized Component Mounting & Re-renders**:
   - Toggling `activeDetailTab` conditionally unmounts `plan_editor` and mounts `NegotiationTab`.
   - On mounting, `NegotiationTab` synchronously performs:
     - 10+ `localStorage.getItem` reads.
     - Iterative procedures array mapping & recalculation (`calculatedGrossTotal`, `simulations`).
     - Canvas drawing operations (`drawMarkersOnImage` in `NegotiationTab.tsx:74-150`).
   - The lack of React code-splitting / lazy rendering or memoization causes a noticeable 300ms–1500ms freeze while `NegotiationTab` mounts.

---

## 4. Planning Data Population into New Budget Fields (R2)

### 4.1 Population Flow
- `NegotiationTab` receives `sections` (`PhotoSection[]`) and `procedures` (`Procedure[]`) from `DentalCRMView.tsx`.
- `calculatedGrossTotal` is calculated (lines 196-210) by iterating `sections` -> `markers` -> `procedureInstances` / `procedures`.
- `desiredNet` is defined as (line 218):
  ```typescript
  const desiredNet = customNetDesired !== null ? customNetDesired : calculatedGrossTotal;
  ```
- `simulations` use `desiredNet` to populate all 4 payment option columns (À Vista, 12x Credit, etc.).

### 4.2 Root Causes of Population Failure / Lag / Stale Data
1. **Stale `customNetDesired` Persisted in `localStorage`**:
   - In `NegotiationTab.tsx` (lines 213-216 & 279-283):
     `customNetDesired` is loaded from `localStorage.getItem('ag_neg_custom_net')`.
   - If a user manually modified the budget total for ANY patient or prior budget, `ag_neg_custom_net` is written to `localStorage`.
   - When switching to a new budget or adding new markers in `Planejamento`, `customNetDesired` is non-null. Therefore, `desiredNet` uses the stale `customNetDesired` value and completely ignores `calculatedGrossTotal` from the updated planning markers!
2. **Global Non-Scoped `localStorage` Keys**:
   - `NegotiationTab` stores `ag_neg_custom_net`, `ag_neg_sales_volume`, `ag_neg_selected_plan`, etc. in global `localStorage` keys without patient or budget scoping.
3. **Mount-Time Delay**:
   - Because `NegotiationTab` is not rendered while user is on `'plan_editor'`, newly added planning procedures do not compute budget fields until the user clicks the "Orçamentos" tab, triggering the laggy mount sequence.

---

## 5. Specific Fix Recommendations

### Fix 1: Implement Budget Versioning (R1)
1. **Update `src/types.ts`**: Add `BudgetVersion` interface.
2. **Update `src/lib/supabaseStorage.ts`**: Update upload/list functions to support versioned filenames (`orcamento_v${ver}_${label}.json`).
3. **Update `src/context/PatientContext.tsx`**:
   - Maintain `budgetVersions: BudgetVersion[]` state.
   - Implement version creation (V1, V2) without overwriting existing files.
4. **Update `src/components/NegotiationTab.tsx`**:
   - Update `handleSaveDrive` to save as `orcamento_v${versionNumber}.json` or prompt for version name instead of overwriting `'orcamento_salvo.json'`.

### Fix 2: Resolve Tab Switching Freezing/Lag (R2)
1. **Optimize Image Storage in `PatientContext.tsx`**:
   - Exclude heavy base64 `image` Data URLs when stringifying `activeSections` to `localStorage` or sending via `BroadcastChannel`. Store image URLs/references instead.
   - Debounce or move `localStorage` saving out of the main render loop (use `requestIdleCallback` or debounced effect).
2. **Keep Tab Components Mounted with CSS Hiding**:
   - In `DentalCRMView.tsx`, replace conditional rendering `{activeDetailTab === 'plan_negotiation' && <NegotiationTab />}` with hidden container `<div className={activeDetailTab === 'plan_negotiation' ? 'block' : 'hidden'}><NegotiationTab /></div>`. This avoids expensive remounts when switching tabs.

### Fix 3: Fix Planning Data Population (R2)
1. **Scope & Reset `customNetDesired`**:
   - Clear `customNetDesired` when opening a new budget or changing patient.
   - Key `customNetDesired` by `patientId` and `budgetId` rather than a global `localStorage` key.
2. **Auto-Sync Planning Changes**:
   - When markers change in `plan_editor`, automatically recompute `calculatedGrossTotal` and update `activeProposal` so budget columns update instantaneously.
