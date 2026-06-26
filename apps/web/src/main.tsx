import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initMercadoPago } from '@mercadopago/sdk-react';
import App from './App';
import './index.css';

initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY ?? 'TEST-PUBLIC-KEY', { locale: 'es-AR' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
