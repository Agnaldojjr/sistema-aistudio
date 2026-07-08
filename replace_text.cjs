const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'components');
const appPath = path.join(__dirname, 'src', 'App.tsx');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Replace references
  content = content.replace(/Google Drive/gi, 'Supabase');
  content = content.replace(/no Drive/gi, 'no Supabase');
  content = content.replace(/do Drive/gi, 'do Supabase');
  content = content.replace(/ao Drive/gi, 'ao Supabase');
  content = content.replace(/Drive corporativo/gi, 'Supabase corporativo');
  
  // Fix weird cases like 'Supabase do consultório' if it makes sense, but the above is safe.
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

// Process components
fs.readdirSync(directoryPath).forEach(file => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    replaceInFile(path.join(directoryPath, file));
  }
});

// Process App.tsx
replaceInFile(appPath);

console.log("All text references replaced!");
