import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// MercadoPago SDK init lives in CheckoutModal (lazy chunk) so visitors who
// never open the checkout don't download the SDK.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
