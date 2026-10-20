import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { watchForUpdates } from './lib/version';
import './styles/global.css';
import './styles/pixel-icons.css';

watchForUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
