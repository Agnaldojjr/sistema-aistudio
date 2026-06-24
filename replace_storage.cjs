const fs = require('fs');

let code = fs.readFileSync('src/lib/supabaseStorage.ts', 'utf8');

code += `

export async function getPatientFileUrlFromSupabase(patientName: string, filename: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const patientFolder = getSafePatientPath(patientName);
  const filePath = \`\${userId}/\${patientFolder}/\${filename}\`;

  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(filePath, 3600);
  if (error) {
    console.error('Erro ao obter URL:', error);
    return null;
  }
  return data?.signedUrl;
}

export async function renamePatientFileInSupabase(patientName: string, oldFilename: string, newFilename: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const patientFolder = getSafePatientPath(patientName);
  const oldPath = \`\${userId}/\${patientFolder}/\${oldFilename}\`;
  const newPath = \`\${userId}/\${patientFolder}/\${newFilename}\`;

  const { error } = await supabase.storage.from(BUCKET_NAME).move(oldPath, newPath);
  if (error) {
    console.error('Erro ao renomear arquivo:', error);
    throw error;
  }
}
`;

fs.writeFileSync('src/lib/supabaseStorage.ts', code);
