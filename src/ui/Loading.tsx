/**
 * Écran d'attente.
 *
 * Il couvre deux moments : le chargement du moteur 3D, qui pèse l'essentiel
 * de l'application, et la reprise d'une partie après rafraîchissement. Dans
 * les deux cas le joueur attend plusieurs secondes sans rien pouvoir faire —
 * c'est le seul écran où il n'a aucune prise, donc le seul qui doit lui
 * confirmer en permanence que quelque chose avance.
 *
 * Le logo est déjà en cache : l'accueil l'affiche avant que cet écran
 * n'apparaisse jamais. Il ne coûte donc aucun téléchargement supplémentaire
 * au moment où l'on charge déjà le moteur.
 */
export const Loading = ({ label }: { label: string }) => (
  <div className="attente">
    <img className="attente__logo" src={`${import.meta.env.BASE_URL}ui/logo.webp`} alt="Fortune City" />
    <div className="attente__jauge" aria-hidden="true"><span /></div>
    <p className="attente__texte" role="status">{label}</p>
  </div>
);
