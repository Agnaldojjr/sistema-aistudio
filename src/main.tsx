import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PatientProvider } from './context/PatientContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PatientProvider>
      <App />
    </PatientProvider>
  </StrictMode>,
);
