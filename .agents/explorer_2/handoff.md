# Handoff Report — CRM Refactoring Requirements (R3, R4, R5)

## 1. Observation

Direct observations from codebase inspection (`src/lib/supabaseStorage.ts`, `src/components/DentalCRMView.tsx`, `src/components/NegotiationTab.tsx`, `src/components/PatientsModal.tsx`, `src/components/PatientScreen.tsx`, `src/context/PatientContext.tsx`, `src/types.ts`):

1. **Storage Path Construction (`src/lib/supabaseStorage.ts:15-35`)**:
   - `uploadPatientFileToSupabase` function signature:
     ```typescript
     export async function uploadPatientFileToSupabase(patientName: string, file: File | Blob, filename: string) {
       const userId = session.user.id;
       const patientFolder = getSafePatientPath(patientName);
       const filePath = `${userId}/${patientFolder}/${filename}`;
       ...
     ```
   - Observed that `filePath` is hardcoded to `${userId}/${patientFolder}/${filename}` without any subfolder parameter or automatic subfolder placement.

2. **Budget PDF Export (`src/components/NegotiationTab.tsx:1109-1111`)**:
   - Budget PDF upload execution:
     ```typescript
     const cleanFileName = `Orcamento_${safePatientName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
     await uploadPatientFileToSupabase(safePatientName, pdfBlob, cleanFileName);
     ```
   - Observed that `cleanFileName` is generated without any subfolder prefix (`Orcamento_...pdf`).

3. **Cloud Drive Non-Image Filtering (`src/components/DentalCRMView.tsx:1295`)**:
   - Image filter definition:
     ```typescript
     const filterSupabaseImages = (files: any[]) => {
       const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
       return (files || []).filter(f => imageExtensions.some(ext => f.name.toLowerCase().endsWith(ext)));
     };
     ```
   - Observed that `filterSupabaseImages` excludes `.pdf`, `.doc`, `.docx`, and `.txt` files from being loaded into `driveImages`.

4. **Cloud Drive Tab Render Loop (`src/components/DentalCRMView.tsx:5717-6150`)**:
   - `activeDetailTab === 'drive_records'` renders `driveProposals` (`.json` files) in Part 1 and `driveImages` (image files only) in Part 2.
   - Observed that PDFs (like `Orcamento_...pdf`) and documents are not rendered in either Part 1 or Part 2.

5. **Procedure Instance Photo Slots Schema (`src/types.ts:36-37`)**:
   - `ToothMarker.procedureInstances` fields:
     ```typescript
     photoAntesUrl?: string;
     photoDepoisUrl?: string;
     ```
   - In `DentalCRMView.tsx:526-530` (`handleUploadTimelinePhoto`):
     ```typescript
     if (type === 'antes') {
       inst.photoAntesUrl = storageFilename;
     } else {
       inst.photoDepoisUrl = storageFilename;
     }
     ```
   - Observed that there are only two string properties (`photoAntesUrl` and `photoDepoisUrl`) available per procedure instance.

6. **File Input Single-File Truncation (`src/components/PatientsModal.tsx:309`)**:
   - File upload change handler:
     ```typescript
     const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
       const files = e.target.files;
       if (!files || files.length === 0 || !selectedPatient) return;
       const file = files[0];
     ```
   - Observed that `files[0]` extracts only the first file from `e.target.files`, ignoring remaining files.

7. **PatientScreen LocalStorage Key Mismatch (`src/components/PatientScreen.tsx:70` vs `src/context/PatientContext.tsx:244`)**:
   - `PatientScreen.tsx:70`:
     ```typescript
     const sections = useReactiveLocalStorage<PhotoSection[]>('agnaldo_dent_sections', []);
     ```
   - `PatientContext.tsx:244`:
     ```typescript
     localStorage.setItem(`agnaldo_dent_sections_${selectedPatient.id}`, JSON.stringify(activeSections));
     ```
   - Observed that `PatientScreen.tsx` listens to key `'agnaldo_dent_sections'` while `PatientContext.tsx` writes to `agnaldo_dent_sections_${selectedPatient.id}`.

---

## 2. Logic Chain

1. **R3 (Cloud Drive Segregation)**:
   - Observation 1 shows `uploadPatientFileToSupabase` constructs `filePath` as `${userId}/${patientFolder}/${filename}` with no subfolder logic.
   - Observation 2 shows `NegotiationTab.tsx:1111` calls `uploadPatientFileToSupabase` passing `cleanFileName` (`Orcamento_...pdf`) without an `'Orçamentos'` subfolder prefix or parameter.
   - **Step Reasoning**: Because no subfolder parameter or prefix is provided, Supabase Storage places budget PDFs directly in the patient's root directory (`${userId}/${patientFolder}/Orcamento_...pdf`), failing to segregate them into an `"Orçamentos"` folder.

2. **R4 (Cloud Drive Photo Gallery Grid & Doc Icons)**:
   - Observation 3 shows `filterSupabaseImages` filters files strictly by image extensions (`.jpg`, `.png`, `.webp`, etc.).
   - Observation 4 shows `DentalCRMView.tsx:5717-6150` renders `.json` proposals in Part 1 and image files in Part 2.
   - **Step Reasoning**: Because non-image files like PDFs and Word documents are stripped out by `filterSupabaseImages`, they are never passed to the render loop. To display non-images in the visual grid, the fetching filter must be updated and grid tile render components added for PDFs (red document tile), Word/text files (blue document tile), and JSON proposals (gold tile).

3. **R5 (Patient Screen Photo Upload Bug - 3 Photos -> 2 Displayed)**:
   - Observation 5 shows `procedureInstances` in `types.ts` contains only 2 string fields (`photoAntesUrl` and `photoDepoisUrl`). When uploading 3 photos for a procedure record, the 3rd upload overwrites one of the existing slots because no 3rd slot or array exists.
   - Observation 6 shows file input handlers like `PatientsModal.tsx:309` take `files[0]`, discarding files index `1` and `2` when selecting 3 files in the OS file browser.
   - Observation 7 shows `PatientScreen.tsx` listens to LocalStorage key `'agnaldo_dent_sections'` while `PatientContext.tsx` writes to `agnaldo_dent_sections_${selectedPatient.id}`.
   - **Step Reasoning**: The combination of 2-slot schema bounds (`photoAntesUrl`/`photoDepoisUrl`), single-file array indexing (`files[0]`), and LocalStorage key mismatch causes multi-photo uploads of 3 photos to truncate to 2 photos (or 1 photo) on the patient screen.

---

## 3. Caveats

- **Existing Storage Data**: Budget PDFs already saved to Supabase Storage prior to this refactoring reside at the root patient directory (`${userId}/${patientFolder}/Orcamento_...pdf`). A migration helper or fallback lookup may be needed to display legacy PDFs inside the `"Orçamentos"` folder.
- **LocalStorage Quota**: Data URLs (base64 images) stored in `activeSections` in `localStorage` can hit the 5MB browser quota if multiple high-resolution photos are uploaded. Compressing images or storing Supabase Storage URLs is strongly recommended.

---

## 4. Conclusion

1. **R3 Solution**:
   - Add `subfolder?: string` parameter to `uploadPatientFileToSupabase` in `src/lib/supabaseStorage.ts`.
   - Update `NegotiationTab.tsx:1111` to pass `'Orçamentos'` as the `subfolder` argument when exporting budget PDFs.
2. **R4 Solution**:
   - Replace restrictive `filterSupabaseImages` in `src/components/DentalCRMView.tsx` with unified file listing.
   - Render grid tiles in the `drive_records` view with representative icons: PDF icon for `.pdf`, Document icon for `.doc`/`.docx`, and Proposal icon for `.json`.
3. **R5 Solution**:
   - Add `photos?: string[]` to `ToothMarker.procedureInstances` in `src/types.ts`.
   - Update file upload handlers (`PatientsModal.tsx:309`, `AppointmentClinicalDrawer.tsx:158`, `DentalCRMView.tsx`) to iterate over `Array.from(e.target.files)`.
   - Align `PatientScreen.tsx:70` LocalStorage key to `agnaldo_dent_sections_${selectedPatientId}`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify R3 (Cloud Drive Segregation)**:
   - Open `src/lib/supabaseStorage.ts:15-35` and `src/components/NegotiationTab.tsx:1109-1111`.
   - Confirm `filePath` is constructed without `Orçamentos/` prefix.
2. **Verify R4 (Cloud Drive Photo Gallery)**:
   - Open `src/components/DentalCRMView.tsx:1295` and inspect `filterSupabaseImages`.
   - Confirm non-image extensions (`.pdf`, `.doc`) are excluded.
3. **Verify R5 (Photo Upload Bug)**:
   - Inspect `src/types.ts:36-37` to verify only `photoAntesUrl` and `photoDepoisUrl` exist on procedure instances.
   - Inspect `src/components/PatientsModal.tsx:309` to confirm `e.target.files[0]` truncates multi-file selections.
   - Inspect `src/components/PatientScreen.tsx:70` vs `src/context/PatientContext.tsx:244` to verify key mismatch.
