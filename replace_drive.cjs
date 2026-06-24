const fs = require('fs');

let code = fs.readFileSync('src/components/DentalCRMView.tsx', 'utf8');

// Replace imports
code = code.replace(/import \{(.|\n)*?\} from '\.\.\/lib\/drive';/gm, 
  `import {
  listPatientFilesFromSupabase,
  uploadPatientFileToSupabase,
  deletePatientFileFromSupabase,
  renamePatientFileInSupabase,
  getPatientFileUrlFromSupabase
} from '../lib/supabaseStorage';`);

// Replace strings
code = code.replace(/Google Drive/g, 'Supabase');
code = code.replace(/no Drive/g, 'no Supabase');
code = code.replace(/do Drive/g, 'do Supabase');
code = code.replace(/ao Drive/g, 'ao Supabase');
code = code.replace(/Drive/g, 'Supabase');

// Save Treatment Plan
code = code.replace(/await saveTreatmentPlanToDrive\((.*?), (.*?), (.*?)\)/g, 
  `await uploadPatientFileToSupabase($1, new Blob([JSON.stringify($2)], { type: 'application/json' }), $3 || 'orcamento_salvo.json')`);
code = code.replace(/await saveTreatmentPlanToDrive\((.*?), (.*?)\)/g, 
  `await uploadPatientFileToSupabase($1, new Blob([JSON.stringify($2)], { type: 'application/json' }), 'orcamento_salvo.json')`);

// Delete File
code = code.replace(/await deleteFileFromSupabase\((.*?)\)/g, 
  `await deletePatientFileFromSupabase(driveFolderId || selectedPatient?.name || 'Unknown', $1)`);

// Rename File
code = code.replace(/await renameFileInSupabase\((.*?), (.*?)\)/g, 
  `await renamePatientFileInSupabase(driveFolderId || selectedPatient?.name || 'Unknown', $1, $2)`);

// Save Pdf
code = code.replace(/await saveTreatmentPdfToSupabase\((.*?), (.*?), (.*?)\)/g, 
  `await uploadPatientFileToSupabase($1, $2, $3)`);

// Upload Image
code = code.replace(/await uploadPatientImageToSupabase\((.*?), (.*?), (.*?)\)/g, 
  `await uploadPatientFileToSupabase($1, $2, $3)`);

// List Proposals
code = code.replace(/await listPatientProposalsFromSupabase\((.*?)\)/g, 
  `await listPatientFilesFromSupabase($1)`);

// List Images
code = code.replace(/await listPatientImagesFromSupabase\((.*?)\)/g, 
  `await listPatientFilesFromSupabase($1)`);

// Load Patient From Drive
code = code.replace(/await loadPatientFromSupabase\((.*?), (.*?)\)/g, 
  `await (async () => {
      const url = getPatientFileUrlFromSupabase($1, $2);
      const res = await fetch(url);
      return await res.json();
  })()`);

fs.writeFileSync('src/components/DentalCRMView.tsx', code);
