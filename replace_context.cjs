const fs = require('fs');
let code = fs.readFileSync('src/context/PatientContext.tsx', 'utf8');

code = code.replace(/import \{ saveTreatmentPlanToDrive \} from '\.\.\/lib\/drive';/g, 
  `import { uploadPatientFileToSupabase } from '../lib/supabaseStorage';`);

code = code.replace(/isSavingToDrive/g, 'isSavingToSupabase');
code = code.replace(/setIsSavingToDrive/g, 'setIsSavingToSupabase');
code = code.replace(/saveContextToDrive/g, 'saveContextToSupabase');

code = code.replace(/saveTreatmentPlanToDrive\((.*?),\s*(.*?)\)/g, 
  'uploadPatientFileToSupabase($1, new Blob([JSON.stringify($2)], {type: "application/json"}), "orcamento.json")');

code = code.replace(/Google Drive/g, 'Supabase');

fs.writeFileSync('src/context/PatientContext.tsx', code);
