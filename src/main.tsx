import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import { App } from './App';
const BoardPreview = import.meta.env.DEV ? lazy(() => import('./dev/BoardPreview').then(m => ({default:m.BoardPreview}))) : null;

// Banc d'essai du rendu, accessible uniquement en développement.
const preview =
  import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'board';

createRoot(document.getElementById('root')!).render(
  <StrictMode><Suspense fallback={null}>{preview && BoardPreview ? <BoardPreview /> : <App />}</Suspense></StrictMode>,
);
