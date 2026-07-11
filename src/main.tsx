import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PatientProvider } from './context/PatientContext';
import './index.css';

// ==========================================
// SENTINELA DE BUGS (FRONTEND ERROR LISTENER)
// ==========================================
window.addEventListener('error', (event) => {
  if (event.message?.includes('Extension') || event.filename?.includes('extension')) return;
  fetch('/api/sentinel/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: event.message,
      stack: event.error?.stack || '',
      url: window.location.href,
      userAgent: navigator.userAgent
    })
  }).catch(err => console.warn('Falha ao reportar erro ao Sentinel:', err));
});

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  fetch('/api/sentinel/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: error?.message || 'Unhandled Promise Rejection',
      stack: error?.stack || '',
      url: window.location.href,
      userAgent: navigator.userAgent
    })
  }).catch(err => console.warn('Falha ao reportar rejeição ao Sentinel:', err));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PatientProvider>
      <App />
    </PatientProvider>
  </StrictMode>,
);
