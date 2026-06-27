const { execSync } = require('child_process');

try {
  console.log("Removing old env vars...");
  try { execSync('npx vercel env rm VITE_SUPABASE_URL production -y', { stdio: 'ignore' }); } catch(e) {}
  try { execSync('npx vercel env rm VITE_SUPABASE_ANON_KEY production -y', { stdio: 'ignore' }); } catch(e) {}
  
  console.log("Adding new env vars...");
  execSync('npx vercel env add VITE_SUPABASE_URL production', { input: 'https://arnrnnkfijsahwkzqnfe.supabase.co' });
  execSync('npx vercel env add VITE_SUPABASE_ANON_KEY production', { input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFybnJubmtmaWpzYWh3a3pxbmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTAzMjgsImV4cCI6MjA5NzcyNjMyOH0.TFwBy9XVO5fJzBNQX-yC6bE_WAU3DV_3jxtA1UfdHPk' });
  
  console.log("Successfully added env vars!");
} catch (error) {
  console.error("Error setting env vars", error);
}
