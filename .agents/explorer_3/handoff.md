# Handoff Report — explorer_3

**Date**: 2026-07-29  
**Agent**: `explorer_3`  
**Task**: Investigation of Requirement R6 (STRICT CRM DATA PRESERVATION under Ponytail Full principles) and System Build Infrastructure  
**Status**: Completed  

---

## 1. Observation

1. **Patient Data Structure (`src/types.ts`)**:
   - `CRMPatient` / `PatientData` interface defined in `src/types.ts` lines 61-110:
     - Demographics & Contact: `id`, `codigo_paciente`, `name`, `cpf`, `rg`, `rgIssuer`, `birthDate`, `gender`, `status`, `maritalStatus`, `photoUrl`, `medicalRecord`, `howKnewClinic`, `phone`, `mobile`, `email`, `observations`.
     - Responsible Data: `respName`, `respBirthDate`, `respPhone`, `respMobile`, `respMaritalStatus`, `respCpf`, `respRg`, `respRgIssuer`, `respProfession`.
     - Address: `cep`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`.
     - Insurance: `healthInsurance`, `healthInsuranceCard`, `healthInsuranceValidity`.
     - Audit & Sub-modules: `createdAt`, `updatedAt`, `appointments`, `clinical_history`, `communications`, `anamnese`, `avisos`, `documentos`, `galeria`, `pagamentos`, `tratamentos`, `odontograma`.

2. **Persistence Mechanics (`src/context/PatientContext.tsx` & `src/lib/supabaseCrm.ts`)**:
   - In `src/context/PatientContext.tsx:267-274`, saving context updates `crmData.patients` via:
     ```typescript
     if (crmData.patients) {
       const pIndex = crmData.patients.findIndex((p: any) => p.id === pId);
       if (pIndex !== -1) {
         crmData.patients[pIndex] = { ...crmData.patients[pIndex], ...selectedPatient };
       } else {
         crmData.patients.push(selectedPatient);
       }
     }
     ```
   - Sub-lists are merged with `mergeLists(globalList, localList)` for `appointments`, `clinical_history`, `communications`, `anamnese`, `avisos`, `documentos`, `galeria`, `pagamentos`, `tratamentos`, `odontograma`.
   - `saveSupabaseCRMDatabase` in `src/lib/supabaseCrm.ts:40-59` contains a deletion safeguard:
     `if (currentCount > 5 && newCount < currentCount - 2)` prompts confirmation to prevent bulk patient data loss.

3. **Storage & Gallery Mechanics (`src/components/PatientGallery.tsx` & `src/lib/supabaseStorage.ts`)**:
   - `uploadPatientFileToSupabase` in `src/lib/supabaseStorage.ts:20-21` uses `getSafePatientPath(patientName)`:
     `const filePath = ${userId}/${patientFolder}/${filename};`
   - `PatientGallery` receives `selectedPatient` as `string` (patient name), not `CRMPatient.id`.

4. **Build & Infrastructure Execution Commands**:
   - `npm run build` command: `vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`
     - Command Result: **PASSED**. `vite build` completed successfully, producing production assets in `dist/`, and `esbuild` generated `dist/server.cjs`.
   - `npm run lint` command: `tsc --noEmit`
     - Command Result: **FAILED** (Exit code 1).
     - Verbatim error log:
       ```
       src/components/DentalCRMView.tsx(318,29): error TS2322: Type '"geral"' is not assignable to type '"upper" | "lower" | "smile" | "panoramic"'.
       ```

5. **Git Repository State**:
   - `git status`: Branch `main`, up to date with `origin/main`. Working tree clean for source code, dirty only in `.agents/` metadata.
   - `git log -n 3`:
     - `80e20c5`: `feat: adicionar seleção de fotos da galeria no envio em lote`
     - `9738fae`: `feat: adicionar procedimento avulso, edicao inline e persistencia de orcamento`
     - `e58c238`: `feat: add date picker to 'Hoje' button in dashboard agenda`

---

## 2. Logic Chain

1. **Observation 1 & 2 -> Risk in Budget Creation**:
   - Budget saving in `PatientContext.tsx` spreads `selectedPatient` onto `crmData.patients[pIndex]`.
   - If `selectedPatient` in local state is partially initialized or missing demographic attributes, spreading `{ ...crmData.patients[pIndex], ...selectedPatient }` mutates or nullifies valid CRM demographic fields during budget creation/updating.
   - *Logic Conclusion*: Budget operations (`tratamentos` and `odontograma`) must have an isolated mutation boundary. They should execute pure `append/upsert` operations on budget lists without re-saving or spreading over `crmData.patients`.

2. **Observation 2 -> Risk in Tab Switching**:
   - Tab switching in `DentalCRMView.tsx` toggles `activeDetailTab`.
   - Edits made in `PatientRegistrationTab` reside in React component state until explicitly saved.
   - If `refreshPatientSubModules` is triggered during tab switching or background sync, uncommitted demographic form state is overwritten by the database values.
   - *Logic Conclusion*: Unsaved demographic edits should be auto-buffered in LocalStorage (`agnaldo_dent_draft_patient_${patientId}`) to prevent loss on tab switching.

3. **Observation 3 -> Risk in Photo Uploading**:
   - `uploadPatientFileToSupabase` constructs storage folder paths using `patientName` (`getSafePatientPath(patientName)`).
   - If a patient's name is edited in the CRM, their storage directory name changes, detaching previously uploaded photos.
   - *Logic Conclusion*: Storage paths must use the immutable `patientId` (`${userId}/${patientId}/${filename}`) rather than mutable `patientName`. Photo metadata must append directly to `crmData.galeria` without touching `crmData.patients`.

4. **Observation 4 -> Infrastructure Status**:
   - `npm run build` passes cleanly, confirming production bundling is working.
   - `npm run lint` fails on `DentalCRMView.tsx:318` because `'geral'` is assigned to `PhotoSection.id`, which expects `'upper' | 'lower' | 'smile' | 'panoramic'`.
   - *Logic Conclusion*: To pass `npm run lint`, either update `PhotoSection.id` type definition in `src/types.ts` to include `'geral'` or map `'geral'` to a valid enum member.

---

## 3. Caveats

- **No Source Code Modifications Made**: Under explorer read-only guidelines, no fixes were committed to `src/`. All recommendations are provided as precise actionable guidelines for implementers.
- **E2E Tests Not Executed**: `npm run test` (`playwright test`) was not run as browser binaries may require display/server environment.
- **Supabase Authentication State**: Supabase backend calls depend on active user session (`supabase.auth.getSession()`); offline behavior relies on LocalStorage fallbacks.

---

## 4. Conclusion

Requirement R6 (Strict CRM Data Preservation under Ponytail Full principles) is structurally feasible with three critical safety boundary rules:
1. **Isolated Budget Mutation Boundary**: Budget creation/edits must strictly target `crmData.tratamentos` and `crmData.odontograma` (append/upsert), removing the `crmData.patients` spread in `PatientContext.tsx:270`.
2. **Immutable Storage Path Boundary**: Photo uploads in `src/lib/supabaseStorage.ts` must use immutable `patientId` instead of `patientName` to avoid folder detachment when demographic names change.
3. **Demographic Draft Preservation Boundary**: Local edits in `PatientRegistrationTab` must be buffered in LocalStorage to prevent loss during tab switching.

System Infrastructure: `npm run build` is operational. `npm run lint` requires a single 1-line type fix at `src/components/DentalCRMView.tsx:318` (`'geral'` section ID).

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Build Infrastructure**:
   - Run `npm run build` in root: observe successful Vite build and esbuild compilation.
   - Run `npm run lint` in root: observe TypeScript error at `src/components/DentalCRMView.tsx:318`.

2. **Inspect Patient Data Preservation Boundaries**:
   - View `src/types.ts` lines 61-110 to verify `CRMPatient` fields.
   - View `src/context/PatientContext.tsx` lines 260-331 to inspect `saveContextToSupabase` and `crmData.patients` spread logic.
   - View `src/lib/supabaseStorage.ts` lines 8-27 to inspect `getSafePatientPath(patientName)` usage.
   - View `src/components/PatientGallery.tsx` lines 18-30 to verify patient prop typing.
