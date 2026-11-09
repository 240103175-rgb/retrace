import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './lib/offline';
import { API_MODE, createApi } from './services';
import './styles.css';

// Only the built app works offline; the dev server must always serve fresh code.
if (import.meta.env.PROD) registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={createApi()} mock={API_MODE === 'mock'} />
  </StrictMode>,
);
