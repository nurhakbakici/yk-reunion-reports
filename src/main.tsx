import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Latin + Latin Extended only: Turkish needs the extended set (ğ, ş, ı, İ).
// The fonts are inlined into the single-file build, so exports look the same
// on every machine and the app works offline.
import '@fontsource/oxanium/latin-500.css';
import '@fontsource/oxanium/latin-ext-500.css';
import '@fontsource/oxanium/latin-700.css';
import '@fontsource/oxanium/latin-ext-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-ext-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-ext-700.css';
import '@fontsource/ibm-plex-serif/latin-400.css';
import '@fontsource/ibm-plex-serif/latin-ext-400.css';
import '@fontsource/ibm-plex-serif/latin-600.css';
import '@fontsource/ibm-plex-serif/latin-ext-600.css';
import '@fontsource/ibm-plex-serif/latin-600-italic.css';
import '@fontsource/ibm-plex-serif/latin-ext-600-italic.css';

import './styles/app.css';
import './styles/document.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
