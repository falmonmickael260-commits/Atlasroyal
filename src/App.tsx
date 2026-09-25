import { Suspense, lazy, useEffect, useState } from 'react';
import { useRoom } from './net/room';
import { Home } from './ui/Home';
import { Lobby } from './ui/Lobby';
import { Toast } from './ui/Toast';
import { introAlreadySeen } from './ui/introSeen';

/**
 * Le moteur 3D (three.js) et le lecteur Remotion pèsent l'essentiel du poids
 * de l'application. Ils ne sont chargés qu'au moment où ils servent :
 * l'accueil et le salon s'affichent sans les attendre.
 */
const Game = lazy(() => import('./ui/Game').then((m) => ({ default: m.Game })));
const Intro = lazy(() => import('./ui/Intro').then((m) => ({ default: m.Intro })));

const Loading = ({ label }: { label: string }) => (
  <div
    style={{
      position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
      background: '#04070E', color: 'var(--fg-muted)', fontSize: 14, letterSpacing: '.16em',
      textTransform: 'uppercase',
    }}
  >
    {label}
  </div>
);

export const App = () => {
  const screen = useRoom((s) => s.screen);
  const [intro, setIntro] = useState(() => !introAlreadySeen());

  useEffect(() => {
    document.title = screen === 'game' ? 'ATLAS ROYALE — en partie' : 'ATLAS ROYALE';
  }, [screen]);

  return (
    <>
      {intro && (
        <Suspense fallback={null}>
          <Intro onDone={() => setIntro(false)} />
        </Suspense>
      )}
      {screen === 'home' && <Home />}
      {screen === 'lobby' && <Lobby />}
      {screen === 'game' && (
        <Suspense fallback={<Loading label="Chargement du plateau" />}>
          <Game />
        </Suspense>
      )}
      <Toast />
    </>
  );
};
