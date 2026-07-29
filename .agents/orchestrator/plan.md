# Plan: Budget Versioning, Planning/Budget Integration, Cloud Drive Gallery & Upload Fix

## Objective
Refactor CRM's budget and cloud drive modules to support multiple independent & versioned budgets (R1), optimize Planning/Budget tab integration and eliminate UI lag (R2), segregate budget PDFs in Cloud Drive into an "Orçamentos" folder (R3), render Cloud Drive root as a visual photo gallery with document icons (R4), fix patient screen photo upload bug (3 photos -> 2 photos bug) (R5), and enforce strict CRM data preservation under Ponytail Full rules (R6).

---

## Milestone Breakdown

### Milestone 1: Exploration & Diagnosis (Parallel Explorers)
- **Goal**: Read codebase, locate components (`DentalCRMView.tsx`, `CloudDrive`, budget management logic, photo upload handlers), isolate root causes for tab lag, budget overwriting, missing PDF segregation, photo display truncation, and verify data safety boundaries.
- **Dispatch**:
  - `explorer_1`: Investigate R1 (Independent & Versioned Budgets) and R2 (Planning to Budget tab integration, freezing/lag root causes, data copying).
  - `explorer_2`: Investigate R3 (Cloud Drive "Orçamentos" folder segregation), R4 (Cloud Drive visual photo grid & doc icons), and R5 (Patient photo upload bug: 3 photos uploaded -> 2 displayed).
  - `explorer_3`: Investigate R6 (CRM Data preservation safety, database schemas/storage methods, build/test execution setup, Git state).
- **Deliverable**: Analysis reports in `.agents/explorer_1/analysis.md`, `.agents/explorer_2/analysis.md`, `.agents/explorer_3/analysis.md`.

---

### Milestone 2: Budget Versioning & Planning Tab Integration (R1, R2)
- **Goal**:
  - Allow patients to have multiple independent budgets (e.g. different procedures) without overwriting existing budgets.
  - Support budget versioning (e.g. Orçamento V1, V2), preserving previous versions.
  - Optimize tab switching between "Planejamento" and "Orçamentos" to eliminate lag or UI freezing (use memoization, lazy state compute, or unblock render loops).
  - Ensure clicking "Criar Orçamento a partir do Planejamento" (or equivalent) populates new budget fields cleanly.
- **Dispatch**:
  - `worker_m2`: Implement R1 & R2 changes in `DentalCRMView.tsx` and related state/type files.
  - `reviewer_m2`: Verify code quality, tab switching reactivity, and budget state immutability.
  - `challenger_m2`: Test multi-budget creation, versioning preservation, and tab performance empirically.

---

### Milestone 3: Cloud Drive Segregation, Visual Gallery & Photo Upload Fix (R3, R4, R5)
- **Goal**:
  - Automatically place saved budget PDFs inside a dedicated "Orçamentos" folder in Cloud Drive.
  - Render root Cloud Drive as a visual photo grid for images, displaying document icons for PDFs/Docs.
  - Fix patient screen photo upload handler so uploading $N$ photos displays exactly $N$ photos (fix off-by-one or slice truncation).
- **Dispatch**:
  - `worker_m3`: Implement R3, R4, R5 changes in Cloud Drive components and patient photo upload handlers.
  - `reviewer_m3`: Verify visual rendering, folder routing, and photo array indexing.
  - `challenger_m3`: Perform boundary tests on photo upload ($N=1, 2, 3, 5$) and cloud drive PDF routing.

---

### Milestone 4: Verification, Data Safety Audit & Git Push (R6)
- **Goal**:
  - Ensure zero deletion or overwrite of patient registration records in CRM.
  - Execute `npm run build` and test commands to verify compilation without errors.
  - Perform Forensic Integrity Audit (`teamwork_preview_auditor`).
  - Commit clean code changes and push to GitHub `origin/main`.
- **Dispatch**:
  - `auditor_m4`: Forensic integrity verification (CLEAN verdict required).
  - `worker_git_push`: Run final build checks, commit, and push to GitHub remote repository.

---

## Acceptance Criteria Checklist
- [ ] R1: Create independent budgets per patient without overwriting.
- [ ] R1: Version existing budgets (V1, V2), preserving history.
- [ ] R2: Switching Planning <-> Budgets tabs has 0 lag/freezing.
- [ ] R2: Planning data auto-populates budget fields correctly.
- [ ] R3: Saved budget PDFs automatically routed to "Orçamentos" folder.
- [ ] R4: Cloud Drive displays photos in visual grid + distinct icons for PDFs/Docs.
- [ ] R5: Uploading $N$ photos displays exactly $N$ photos.
- [ ] R6: Core patient registration data is 100% preserved and untouched.
- [ ] Verification: `npm run build` passes, Forensic Audit CLEAN, changes pushed to GitHub.
