import { useEffect, useState } from 'react';

/**
 * Écran d'attente.
 *
 * Il couvre les deux seuls moments où le joueur n'a aucune prise : le
 * chargement du moteur 3D, qui pèse l'essentiel de l'application, et la
 * reprise d'une partie après rafraîchissement. Un écran d'attente a deux
 * devoirs — prouver en permanence que quelque chose avance, et occuper
 * l'esprit pendant ce temps. D'où le reflet qui balaie le logo, et les
 * astuces qui tournent.
 */

/**
 * Astuces affichées pendant l'attente.
 *
 * Choisies parmi les règles que l'on découvre d'ordinaire en les subissant :
 * l'achat interdit au premier tour, le triple double, la contrepartie
 * obligatoire. Les lire ici évite de les apprendre à ses dépens.
 */
const ASTUCES = [
  'Aucun achat n’est possible pendant le premier tour de table.',
  'Un double rejoue — mais trois doubles de suite mènent droit en prison.',
  'Le Parc Gratuit verse la totalité de la cagnotte à qui s’y arrête.',
  'Il faut posséder tout un groupe de couleur avant de pouvoir bâtir.',
  'Un hôtel rapporte environ cinq fois le prix d’achat de la ville.',
  'Un échange exige une contrepartie de chaque côté : pas de don déguisé.',
  'Hypothéquer rapporte la moitié du prix ; la levée coûte 10 % de plus.',
  'Arriver pile sur le Départ double la prime de passage.',
];

export const Loading = ({ label }: { label: string }) => {
  // Une astuce au hasard au départ : deux chargements de suite ne doivent pas
  // afficher la même phrase, sinon on cesse de la lire.
  const [i, setI] = useState(() => Math.floor(Math.random() * ASTUCES.length));

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % ASTUCES.length), 4200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="attente">
      <div className="attente__decor" aria-hidden="true" />
      <div className="attente__halo" aria-hidden="true" />

      <div className="attente__marque">
        <span className="attente__lueur" aria-hidden="true" />
        {/* Deux niveaux : l'entrée est jouée une fois sur le conteneur, le
            balancement tourne en boucle à l'intérieur. Les mettre sur le même
            élément ferait se battre les deux transformations. */}
        <div className="attente__pivot">
          <img className="attente__logo" src={`${import.meta.env.BASE_URL}ui/logo.webp`} alt="Fortune City" />
          <span className="attente__eclat" aria-hidden="true" />
        </div>
      </div>

      <div className="attente__jauge" aria-hidden="true"><span /></div>
      <p className="attente__texte" role="status">{label}</p>

      <p className="attente__astuce" key={i}>
        <span className="attente__astuce-titre">Astuce</span>
        {ASTUCES[i]}
      </p>
    </div>
  );
};
