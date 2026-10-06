/**
 * Chargement du logo destiné au tapis central.
 *
 * La texture du tapis est peinte au Canvas en une passe, puis envoyée telle
 * quelle au GPU : elle n'est jamais repeinte. Si le logo n'est pas décodé au
 * moment de cette passe, il manquera pour toute la partie — exactement le
 * piège des polices, qui faisait dessiner le plateau entier dans une fonte de
 * repli. On le décode donc **avant** de monter la scène.
 *
 * Il ne coûte rien de plus : l'accueil et l'écran d'attente l'ont déjà
 * affiché, il est dans le cache du navigateur.
 */
const SOURCE = `${import.meta.env.BASE_URL}ui/logo.webp`;

let image: HTMLImageElement | null = null;
let attente: Promise<void> | null = null;

export const prechargerLogo = (): Promise<void> => {
  if (attente) return attente;
  attente = new Promise<void>((resolve) => {
    if (typeof Image === 'undefined') { resolve(); return; }
    let fini = false;
    const terminer = () => { if (!fini) { fini = true; resolve(); } };
    // Au-delà de deux secondes on peint sans lui : le titre dessiné prend le
    // relais, et le plateau s'affiche plutôt que d'attendre une image.
    const minuteur = setTimeout(terminer, 2000);
    const img = new Image();
    img.onload = () => { image = img; clearTimeout(minuteur); terminer(); };
    img.onerror = () => { clearTimeout(minuteur); terminer(); };
    img.src = SOURCE;
  });
  return attente;
};

/** Le logo décodé, ou `null` s'il n'est pas arrivé à temps. */
export const logoPlateau = (): HTMLImageElement | null => image;
