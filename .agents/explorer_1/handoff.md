# Handoff Report: CRM Refactoring Requirements R1 & R2 Investigation

## 1. Observation
1. **Hardcoded Budget Filename & Overwrite (R1)**:
   - `src/components/NegotiationTab.tsx:1203`:
     `await uploadPatientFileToSupabase(patientName, fileBlob, 'orcamento_salvo.json');`
   - `src/lib/supabaseStorage.ts:23-27`:
     `await supabase.storage.from(BUCKET_NAME).upload(filePath, file, { upsert: true });`
   - `src/context/PatientContext.tsx:307-316`:
     Hardcoded DB record keys `od-${pId}` and `tr-${pId}` overwrite previous treatment and odontogram records upon every context save.
2. **Tab Switching Rendering & Performance Bottlenecks (R2)**:
   - `src/components/DentalCRMView.tsx:5126-5425`: Sub-tabs conditionally mount/unmount `<NegotiationTab />` based on `activeDetailTab === 'plan_negotiation'`.
   - `src/context/PatientContext.tsx:140-151 & 241-258`: Synchronous `localStorage.setItem` and `BroadcastChannel.postMessage` serialize full `activeSections` (including multi-megabyte base64 images) on every state update, freezing the main thread.
3. **Planning Data Copying & Stale Price Calculations (R2)**:
   - `src/components/NegotiationTab.tsx:213-218`:
     `const desiredNet = customNetDesired !== null ? customNetDesired : calculatedGrossTotal;`
   - `src/components/NegotiationTab.tsx:279-283`:
     `localStorage.setItem('ag_neg_custom_net', customNetDesired.toString());`
     Stale `customNetDesired` in global `localStorage` overrides `calculatedGrossTotal` when new planning markers are added or when switching patients/budgets.

---

## 2. Logic Chain
1. **From Observation 1 to R1 Conclusion**:
   - Because saving a budget always targets the static filename `'orcamento_salvo.json'` with `{ upsert: true }`, any subsequent save overwrites the previous budget file.
   - Because the data model lacks a versioned budget interface (`BudgetVersion` with `versionNumber`, `budgetId`, `createdAt`), multiple independent budgets cannot coexist for a patient.
2. **From Observation 2 to R2 Lag Conclusion**:
   - Conditionally mounting `NegotiationTab` forces full component initialization, 10+ synchronous `localStorage` reads, and canvas marker rendering on tab click.
   - Synchronous serialization of base64 images in `PatientContext` during tab state updates blocks main thread execution, causing 300ms–1500ms freezes.
3. **From Observation 3 to R2 Data Population Conclusion**:
   - `calculatedGrossTotal` properly aggregates marker prices, but `desiredNet` prioritizes `customNetDesired`.
   - Because `customNetDesired` persists globally in `localStorage`, any manual price edit on a prior budget blocks updated planning data from populating new budget fields.

---

## 3. Caveats
- Storage backend assumes Supabase bucket `patient_files` with user-folder RLS policies.
- Investigation was read-only; no code was modified outside `.agents/explorer_1/`.
- 3D planning (`src/TreatmentPlanning3D`) shares `activeSections` via `PatientContext` but relies on FDI tooth numbers; 3D marker synchronization depends on `PatientContext` reactivity.

---

## 4. Conclusion
To fully resolve Requirements R1 and R2:
1. **R1 Fix**: Introduce `BudgetVersion` interface in `src/types.ts`. Update `NegotiationTab.tsx` and `supabaseStorage.ts` to save files under versioned paths (e.g. `orcamento_v1.json`, `orcamento_v2.json`) and manage an array of budget versions in `PatientContext`.
2. **R2 Lag Fix**: Keep `plan_editor` and `plan_negotiation` mounted using CSS display toggling (`hidden` vs `block`), and strip base64 Data URLs from `localStorage` sync / `BroadcastChannel` messages.
3. **R2 Population Fix**: Scope `customNetDesired` per patient/budget ID and clear it when populating a new budget from planning data so `calculatedGrossTotal` correctly drives new budget fields.

---

## 5. Verification Method
1. **Inspect Code Files**:
   - Check `src/types.ts` for `BudgetVersion` interface.
   - Check `src/components/NegotiationTab.tsx` around line 1203 for non-overwriting versioned filenames.
   - Check `src/components/DentalCRMView.tsx` around line 5126 for non-unmounting CSS tab toggling.
   - Check `src/context/PatientContext.tsx` around line 241 for optimized serialization.
2. **Runtime / Manual Verification**:
   - Open CRM -> Patient -> "✨ Mapeamento Clínico" -> Add 2 procedures -> Switch to "💰 Emissão de Orçamento". Confirm tab switch is instantaneous (< 50ms) and budget total matches planning procedures.
   - Click "Salvar no Drive" -> Save V1. Create a second budget V2. Verify both `orcamento_v1.json` and `orcamento_v2.json` exist in patient files and neither was overwritten.
