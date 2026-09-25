import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import { App } from './App';
import { BoardPreview } from './dev/BoardPreview';

// Banc d'essai du rendu, accessible uniquement en développement.
const preview =
  import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'board';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{preview ? <BoardPreview /> : <App />}</StrictMode>,
);
