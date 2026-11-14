import { Suspense, lazy, useEffect, useState } from 'react';
import { useRoom } from './net/room';
import { Home } from './ui/Home';
import { Lobby } from './ui/Lobby';
import { Toast } from './ui/Toast';
import { Loading } from './ui/Loading';
import { introAlreadySeen } from './ui/introSeen';
import { warmBoard } from './board3d/warmBoard';
import { BoardFrame } from './board3d/Scene';

/**
 * Le moteur 3D (three.js) et le lecteur Remotion pèsent l'essentiel du poids
 * de l'application. Ils ne sont chargés qu'au moment où ils servent :
 * l'accueil et le salon s'affichent sans les attendre.
 */
const Game = lazy(() => import('./ui/Game').then((m) => ({ default: m.Game })));
const Intro = lazy(() => import('./ui/Intro').then((m) => ({ default: m.Intro })));

export const App = () => {
  const screen = useRoom((s) => s.screen);
  const resume = useRoom((s) => s.resume);
  const resuming = useRoom((s) => s.resuming);
  const [intro, setIntro] = useState(() => !introAlreadySeen());

  useEffect(() => {
    if (screen === 'lobby') { warmBoard(); void import('./ui/Game'); }
  }, [screen]);

  // Rafraîchissement en pleine partie : on y retourne sans rien retaper.
  useEffect(() => {
    void resume();
  }, [resume]);

  useEffect(() => {
    document.title = screen === 'game' ? 'FORTUNE EMPIRE — en partie' : 'FORTUNE EMPIRE';
  }, [screen]);

  return (
    <>
      <BoardFrame active={screen==='lobby'||screen==='game'} visible={screen==='game'}/>
      {intro && (
        <Suspense fallback={null}>
          <Intro onDone={() => setIntro(false)} />
        </Suspense>
      )}
      {screen === 'home' && (resuming ? <Loading label="Reprise de la partie" /> : <Home />)}
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
