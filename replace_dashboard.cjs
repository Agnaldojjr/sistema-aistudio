const fs = require('fs');

let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

code = code.replace(/import \{ listPatientsFromDrive \} from '\.\.\/lib\/drive';/,
  `import { getSupabaseCRMDatabase } from '../lib/supabaseCrm';`);

code = code.replace(/const \{ loadPatientFromDrive \} = await import\('\.\.\/lib\/drive'\);/g,
  `const { getPatientFileUrlFromSupabase } = await import('../lib/supabaseStorage');`);

code = code.replace(/await listPatientsFromDrive\(\)/g,
  `(async () => { const db = await getSupabaseCRMDatabase(); return db.patients || []; })()`);

code = code.replace(/await loadPatientFromDrive\((.*?)\)/g,
  `await (async () => {
    const url = await getPatientFileUrlFromSupabase($1, "orcamento.json");
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  })()`);

code = code.replace(/Google Drive/g, 'Supabase');

fs.writeFileSync('src/components/DashboardView.tsx', code);
