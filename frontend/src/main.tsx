import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { API_MODE, createApi } from './services';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={createApi()} mock={API_MODE === 'mock'} />
  </StrictMode>,
);
