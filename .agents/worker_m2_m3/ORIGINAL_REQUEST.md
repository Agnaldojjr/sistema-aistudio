## 2026-07-29T13:06:45Z
You are worker_m2_m3 working in c:\Users\Agnaldo\OneDrive\Área de Trabalho\sistema-aistudio-main\.agents\worker_m2_m3.
Your task is to implement the CRM Refactoring for Requirements R1, R2, R3, R4, R5, and R6, as well as fixing the TypeScript lint error.

Read the handoff reports from the 3 Explorers:
- `.agents/explorer_1/handoff.md` (R1 & R2)
- `.agents/explorer_2/handoff.md` (R3, R4, R5)
- `.agents/explorer_3/handoff.md` (R6 & Build/Lint)

### Implementation Tasks:

1. **R1: Non-Overwriting & Versioned Budgets**:
   - In `src/types.ts`: Add `BudgetVersion` interface with `id`, `versionNumber`, `versionLabel` ("V1", "V2"), `createdAt`, `filename`, `status`, `sections`, `proposal`, `totalGross`, `totalNet`. Add `budgets?: BudgetVersion[]` to patient/odontogram records.
   - In `src/components/NegotiationTab.tsx`, `src/context/PatientContext.tsx`, and `src/lib/supabaseStorage.ts`:
     - Replace hardcoded `'orcamento_salvo.json'` with versioned filenames (`orcamento_v${versionNumber}.json` or `orcamento_${budgetId}.json`).
     - Support creating independent new budgets (separate procedures) and creating new versions of existing budgets (V1, V2). Ensure creating/editing a budget does not overwrite unrelated budgets or previous versions.

2. **R2: Planning and Budget Integration (UX & Lag Fix)**:
   - In `src/components/DentalCRMView.tsx`: Replace conditional unmounting (`activeDetailTab === 'plan_negotiation' ? <NegotiationTab /> : null`) with CSS display toggling (`hidden` vs `block` or wrapping container) so switching tabs has zero noticeable lag or freezing.
   - In `src/context/PatientContext.tsx`: Optimize `localStorage` serialization — avoid synchronous JSON stringifying of multi-megabyte base64 Data URLs during tab switching / state updates.
   - In `src/components/NegotiationTab.tsx`: Scope `customNetDesired` per patient/budget ID instead of global `localStorage.setItem('ag_neg_custom_net')`. Clear/reset `customNetDesired` when creating a new budget from planning so `calculatedGrossTotal` populates new budget fields cleanly.

3. **R3: Cloud Drive Segregation**:
   - In `src/lib/supabaseStorage.ts`: Update `uploadPatientFileToSupabase` to accept an optional `subfolder?: string` parameter (e.g. `${userId}/${patientFolder}/${subfolder}/${filename}`).
   - In `src/components/NegotiationTab.tsx`: Pass `'Orçamentos'` as the `subfolder` parameter when exporting budget PDFs so budget PDFs land inside the `"Orçamentos"` folder.
   - Update file listing in `supabaseStorage.ts` / `DentalCRMView.tsx` to handle folder segregation.

4. **R4: Cloud Drive as Visual Photo Gallery Grid with Document Icons**:
   - In `src/components/DentalCRMView.tsx`: Remove `filterSupabaseImages` restriction that excludes `.pdf` and `.doc` files from the main drive view (`drive_records` tab).
   - Render root Cloud Drive as a visual tile grid: image thumbnails for photos (`.jpg`, `.png`, etc.), red document card tiles with PDF icons for `.pdf` files, blue document tiles for `.doc`/`.docx`/`.txt` files, and gold proposal tiles for `.json` files.

5. **R5: Patient Screen Photo Upload 3->2 Display Bug**:
   - In `src/types.ts`: Add `photos?: string[]` array to `ToothMarker.procedureInstances` so procedure instances can hold any number of photos ($N$).
   - In file upload handlers (`src/components/PatientsModal.tsx`, `src/components/AppointmentClinicalDrawer.tsx`, `src/components/DentalCRMView.tsx`, `src/components/PatientGallery.tsx`): Update file input handlers to iterate over `Array.from(e.target.files)` instead of truncating at `files[0]`.
   - In `src/components/PatientScreen.tsx`: Align LocalStorage key to `agnaldo_dent_sections_${selectedPatient.id}` (matching `PatientContext.tsx:244`) so uploaded photos update reactively and display all $N$ uploaded photos without off-by-one or key mismatch truncation.

6. **R6: Strict CRM Data Preservation**:
   - In `src/context/PatientContext.tsx`: Update budget save/update logic to execute pure append/upsert operations on `crmData.tratamentos` and `crmData.odontograma` without spreading/overwriting demographic fields in `crmData.patients`.
   - In `src/lib/supabaseStorage.ts`: Use immutable `patientId` for storage folder paths (`${userId}/${patientId}/${subfolder}/${filename}`).

7. **TypeScript Lint Fix**:
   - In `src/types.ts` (or `src/components/DentalCRMView.tsx:318`), update `PhotoSection.id` type definition to include `'geral'` so `npm run lint` (`tsc --noEmit`) passes cleanly with exit code 0!

8. **Build & Test Verification**:
   - Run `npm run build` and `npm run lint` (`tsc --noEmit`) to verify zero build or type errors.
