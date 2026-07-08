const fs = require('fs');
const https = require('https');
const path = require('path');

const token = 'bab70b42d0ec4ab98b8fa3f979c9530e';
const headers = { 'Authorization': 'Token ' + token };

// Mapeamento de UID para os nomes dos arquivos que o sistema espera
const mapping = {
  // Incisivos Centrais
  'c8a7c2d9280d4c92bc651cfa1459866a': ['dente_11_anatomic.glb', 'dente_21_anatomic.glb'],
  '90dcbf474e5a4d97b8783b7eb2b9c4b7': ['dente_31_anatomic.glb', 'dente_41_anatomic.glb'],
  // Incisivos Laterais
  '5e89ddbfc6454e2e8e09c645574b8932': ['dente_12_anatomic.glb', 'dente_22_anatomic.glb'],
  '00fa4f74e10b4769830bf60469c65e27': ['dente_32_anatomic.glb', 'dente_42_anatomic.glb'],
  // Caninos
  'bd930c9b9da14f2a9a8c9b130b0e08a2': ['dente_13_anatomic.glb', 'dente_23_anatomic.glb'],
  '1082011ab5aa46bb96b2af6a02a4ec0c': ['dente_33_anatomic.glb', 'dente_43_anatomic.glb'],
  // Pré-molares
  'f9b48a29d34f4923b683433f030c5c70': ['dente_14_anatomic.glb', 'dente_24_anatomic.glb'],
  '69f3142830064588b000b04bea0ee09f': ['dente_15_anatomic.glb', 'dente_25_anatomic.glb'],
  '935637a703dc49eb9eeec9b15a8a5c4c': ['dente_34_anatomic.glb', 'dente_44_anatomic.glb'],
  'fe59fe04725446479bc1115bb12d0ad8': ['dente_35_anatomic.glb', 'dente_45_anatomic.glb'],
  // Molares
  'e719a474ef7e4bd7abec508f85f1e984': ['dente_16_anatomic.glb', 'dente_26_anatomic.glb'],
  '9481d0b5150b44f2bfbbb53b688cdf87': ['dente_16_endodontic.glb', 'dente_26_endodontic.glb'],
  'e035713849d1438791306e25235ac452': ['dente_17_anatomic.glb', 'dente_27_anatomic.glb'],
  '1b3c50ded70c4b6297d4526a733a9cf1': ['dente_18_anatomic.glb', 'dente_28_anatomic.glb'],
  'e1c919d6603846eca873154eeededdd6': ['dente_36_anatomic.glb', 'dente_46_anatomic.glb'],
  'b77dcbc5052e4740b87cdb1964649742': ['dente_37_anatomic.glb', 'dente_47_anatomic.glb'],
  '561bb06b3b084b84978163906de1c2b5': ['dente_38_anatomic.glb', 'dente_48_anatomic.glb'],
};

const outputDir = path.join(__dirname, '..', 'public', 'models');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function run() {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  for (const [uid, filenames] of Object.entries(mapping)) {
    console.log(`Buscando URL de download para ${uid}...`);
    try {
      const url = `https://api.sketchfab.com/v3/models/${uid}/download`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      
      if (data.glb && data.glb.url) {
        console.log(`Baixando e salvando como ${filenames.join(', ')}...`);
        const tempPath = path.join(outputDir, `temp_${uid}.glb`);
        await downloadFile(data.glb.url, tempPath);
        
        for (const fname of filenames) {
          fs.copyFileSync(tempPath, path.join(outputDir, fname));
        }
        fs.unlinkSync(tempPath);
      } else {
        console.log(`Erro/Não disponível em GLB para ${uid}:`, data);
      }
    } catch (err) {
      console.error(`Erro ao processar ${uid}:`, err);
    }
  }
  console.log('Download finalizado!');
}

run();
