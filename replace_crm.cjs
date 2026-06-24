const fs = require('fs');

let code = fs.readFileSync('src/components/DentalCRMView.tsx', 'utf8');

// Replace imports block correctly
code = code.replace(/import\s*\{[^}]*?\}\s*from\s*'\.\.\/lib\/drive';/, 
  `import {
  listPatientFilesFromSupabase,
  uploadPatientFileToSupabase,
  deletePatientFileFromSupabase,
  renamePatientFileInSupabase,
  getPatientFileUrlFromSupabase
} from '../lib/supabaseStorage';`);

// Drive function calls replacements:
code = code.replace(/uploadAnamnesisPdfToDrive/g, 'uploadAnamnesisPdfToSupabase');
code = code.replace(/saveTreatmentPdfToDrive\((.*?),\s*(.*?),\s*(.*?)\)/g, 'uploadPatientFileToSupabase($1, $2, $3)');
code = code.replace(/saveTreatmentPlanToDrive\((.*?),\s*(.*?),\s*(.*?)\)/g, 'uploadPatientFileToSupabase($1, new Blob([JSON.stringify($2)], {type: "application/json"}), $3)');

code = code.replace(/listPatientProposalsFromDrive\((.*?)\)/g, 'listPatientFilesFromSupabase($1)');
code = code.replace(/listPatientImagesFromDrive\((.*?)\)/g, 'listPatientFilesFromSupabase($1)');

code = code.replace(/uploadPatientImageToDrive\((.*?),\s*(.*?),\s*(.*?)\)/g, 'uploadPatientFileToSupabase($1, $2, $3)');
code = code.replace(/deleteFileFromDrive\((.*?)\)/g, 'deletePatientFileFromSupabase(driveFolderId || selectedPatient?.name || "Unknown", $1)');
code = code.replace(/renameFileInDrive\((.*?),\s*(.*?)\)/g, 'renamePatientFileInSupabase(driveFolderId || selectedPatient?.name || "Unknown", $1, $2)');

code = code.replace(/loadPatientFromDrive\((.*?),\s*(.*?)\)/g, 
  `(async () => { const url = await getPatientFileUrlFromSupabase($1, $2); const r = await fetch(url); return await r.json(); })()`);

// Also fix `saveTreatmentPlanToDrive` without third argument if it exists
code = code.replace(/saveTreatmentPlanToDrive\((.*?),\s*(.*?)\)/g, 'uploadPatientFileToSupabase($1, new Blob([JSON.stringify($2)], {type: "application/json"}), "orcamento.json")');

// Some ui text replacements:
code = code.replace(/Google Drive/g, 'Supabase');
code = code.replace(/no Drive/g, 'no Supabase');
code = code.replace(/do Drive/g, 'do Supabase');
code = code.replace(/ao Drive/g, 'ao Supabase');
code = code.replace(/Drive/g, 'Supabase');

fs.writeFileSync('src/components/DentalCRMView.tsx', code);
