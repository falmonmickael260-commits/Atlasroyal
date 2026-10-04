/**
 * Audio entièrement synthétisé (WebAudio) : aucun fichier à télécharger,
 * donc aucun coût de chargement et aucun asset tiers. Chaque effet est
 * une petite partition programmée.
 *
 * **Le parti pris : des matières, pas des notes.**
 *
 * Les deux versions précédentes jouaient des notes — arpège à l'achat,
 * fanfare sur la cagnotte, bip au lancer. Adoucir les timbres n'y change
 * rien : une mélodie de synthèse sur un jeu de plateau sonne « petit jeu
 * mobile », et c'est la mélodie elle-même qui est en cause.
 *
 * Un jeu de plateau ne fait pas de musique, il fait du bruit : des dés qui
 * s'entrechoquent, un pion qui tape le carton, une carte qui glisse de la
 * pioche, des pièces qui tombent, une maison de bois qu'on pose. Ce sont des
 * transitoires courts avec un corps résonant — jamais des notes tenues.
 *
 * D'où l'outil central, `bois()` : une impulsion de bruit très brève envoyée
 * dans trois passe-bandes à fort facteur de qualité, légèrement inharmoniques.
 * Le filtre continue de sonner après la fin de l'impulsion, et cette queue
 * courte et bruitée est exactement ce qu'on entend quand on frappe un objet.
 * Même principe pour le métal (fréquences hautes, Q serré) et le papier
 * (bruit large, filtré haut).
 *
 * Reste un peu de réverbération pour poser le tout dans une pièce, et un
 * limiteur en sortie : pendant un déplacement les effets se superposent, et
 * la somme saturait.
 */
type Voice = 'sine' | 'triangle' | 'square' | 'sawtooth';

/*
  Clé versionnée : elle change avec la palette sonore.

  Les préférences sont persistées ; sans nouvelle clé, un joueur qui avait
  déjà activé le son resterait sur son ancien réglage et n'entendrait jamais
  le nouveau réglage par défaut.
*/
const LS_KEY = 'atlas-royale:audio:v3';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  /** Entrée des effets : passe-bas d'adoucissement, puis départ réverbération. */
  private sfxIn: BiquadFilterNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  /*
    Effets actifs, musique coupée.

    Les bruitages font partie du jeu : c'est eux qui donnent le poids des dés
    et du pion. La nappe musicale, elle, tourne en boucle pendant toute la
    partie — c'est le genre de fond sonore dont on se lasse en trois minutes,
    et il vaut mieux que le joueur décide de l'ouvrir. Les deux bascules sont
    dans la barre du haut.
  */
  sfxOn = true;
  musicOn = false;

  constructor() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { sfx?: boolean; music?: boolean };
        this.sfxOn = p.sfx ?? true;
        this.musicOn = p.music ?? false;
      }
    } catch { /* préférences indisponibles */ }
  }

  private persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ sfx: this.sfxOn, music: this.musicOn })); }
    catch { /* ignoré */ }
  }

  /** Doit être appelé depuis un geste utilisateur (politique autoplay). */
  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();

    // Limiteur de sortie : pendant un déplacement, pas, pièces et bannières
    // se superposent — sans lui la somme écrête et ça devient agressif.
    const limiteur = this.ctx.createDynamicsCompressor();
    limiteur.threshold.value = -12;
    limiteur.knee.value = 24;
    limiteur.ratio.value = 6;
    limiteur.attack.value = 0.004;
    limiteur.release.value = 0.2;
    limiteur.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(limiteur);

    // Réverbération commune : une queue courte, juste de quoi donner une pièce.
    const reverb = this.ctx.createConvolver();
    reverb.buffer = this.impulsion(1.15, 3.2);
    const retour = this.ctx.createGain();
    retour.gain.value = 0.26;
    reverb.connect(retour);
    retour.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
    // La nappe est volontairement feutrée : elle doit se tenir sous les effets.
    const voileMusique = this.ctx.createBiquadFilter();
    voileMusique.type = 'lowpass';
    voileMusique.frequency.value = 1400;
    voileMusique.Q.value = 0.5;
    this.musicGain.connect(voileMusique);
    voileMusique.connect(this.master);
    voileMusique.connect(reverb);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? 0.42 : 0;
    this.sfxIn = this.ctx.createBiquadFilter();
    this.sfxIn.type = 'lowpass';
    this.sfxIn.frequency.value = 5200;
    this.sfxIn.Q.value = 0.7;
    this.sfxGain.connect(this.sfxIn);
    this.sfxIn.connect(this.master);
    this.sfxIn.connect(reverb);

    if (this.musicOn) this.startMusic();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(on ? 0.42 : 0, this.ctx.currentTime, 0.05);
    }
    this.persist();
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.3);
    }
    if (on) this.startMusic(); else this.stopMusic();
    this.persist();
  }

  /** Réponse impulsionnelle synthétique : bruit décroissant, stéréo. */
  private impulsion(duree: number, pente: number): AudioBuffer {
    const ctx = this.ctx!;
    const n = Math.floor(ctx.sampleRate * duree);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, pente);
    }
    return buf;
  }

  private tone(
    freq: number, dur: number, type: Voice = 'sine',
    { gain = 0.3, delay = 0, slideTo, dest, attack = 0.008 }:
      { gain?: number; delay?: number; slideTo?: number; dest?: GainNode; attack?: number } = {},
  ) {
    if (!this.ctx) return;
    const target = dest ?? this.sfxGain;
    if (!target) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    // Attaque douce plutôt qu'un saut : c'est le claquement du démarrage
    // instantané qui donnait le côté « bip » aux effets courts.
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.max(0.004, Math.min(attack, dur * 0.4)));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(target);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  /** Bruit filtré : impacts, dés, foule. */
  private noise(dur: number, { gain = 0.2, delay = 0, freq = 1400, q = 1 } = {}) {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  }

  /**
   * Corps résonant frappé.
   *
   * Une impulsion de bruit de 12 ms passe dans un passe-bande très sélectif :
   * le filtre sonne encore après la fin de l'impulsion, et c'est cette queue
   * qui fait entendre une matière plutôt qu'un clic.
   */
  private resonance(freq: number, dur: number, { gain = 0.2, q = 10, delay = 0 } = {}) {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.max(8, Math.floor(this.ctx.sampleRate * 0.012));
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filtre = this.ctx.createBiquadFilter();
    filtre.type = 'bandpass';
    filtre.frequency.value = freq;
    filtre.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, gain), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filtre); filtre.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  }

  /** Bois frappé : trois partiels légèrement inharmoniques, comme un objet réel. */
  private bois(base: number, { gain = 0.2, dur = 0.26, delay = 0 } = {}) {
    this.resonance(base, dur, { gain, q: 9, delay });
    this.resonance(base * 2.21, dur * 0.6, { gain: gain * 0.5, q: 11, delay });
    this.resonance(base * 4.6, dur * 0.28, { gain: gain * 0.26, q: 13, delay });
  }

  /** Pièce de monnaie : métal, donc partiels hauts et serrés. */
  private piece(delay = 0, gain = 0.1) {
    const f = 2200 + Math.random() * 2600;
    this.resonance(f, 0.16 + Math.random() * 0.12, { gain, q: 22, delay });
    this.resonance(f * 1.73, 0.1, { gain: gain * 0.5, q: 26, delay });
  }

  /** Papier : bruit large filtré haut, sans hauteur définie. */
  private papier(dur = 0.22, gain = 0.09, delay = 0) {
    this.noise(dur, { gain, delay, freq: 3000, q: 0.55 });
  }

  /* ----------------------- effets de jeu ----------------------- */

  diceShake() {
    // Deux dés qui s'entrechoquent dans le creux de la main : du bois sec,
    // à intervalles irréguliers — une cadence régulière sonne mécanique.
    for (let i = 0; i < 6; i++) {
      this.bois(430 + Math.random() * 420, {
        gain: 0.05 + Math.random() * 0.04,
        dur: 0.07,
        delay: i * 0.065 + Math.random() * 0.03,
      });
    }
  }
  diceLand() {
    // Deux rebonds : le choc franc, puis le dé qui se couche.
    this.bois(240, { gain: 0.26, dur: 0.3 });
    this.bois(310, { gain: 0.12, dur: 0.18, delay: 0.1 });
  }
  /**
   * Pas d'un pion. Joué jusqu'à douze fois de suite à 135 ms d'intervalle :
   * volontairement effacé, et d'une hauteur légèrement différente à chaque
   * fois — douze fois le même son devient un mitraillage.
   */
  step() {
    this.bois(360 + (Math.random() - 0.5) * 110, { gain: 0.055, dur: 0.1 });
  }
  land() {
    this.bois(185, { gain: 0.2, dur: 0.42 });
  }
  buy() {
    // L'acte d'achat : le titre de propriété qu'on détache, puis qu'on pose.
    this.papier(0.18, 0.08);
    this.bois(150, { gain: 0.2, dur: 0.45, delay: 0.09 });
  }
  coin() {
    this.piece(0, 0.09);
    this.piece(0.06, 0.06);
  }
  pay() {
    // Quelques pièces qu'on fait glisser : pas de note descendante.
    for (let i = 0; i < 4; i++) this.piece(i * 0.055 + Math.random() * 0.02, 0.075);
  }
  build() {
    // Une maison de bois posée franchement sur le carton.
    this.bois(118, { gain: 0.28, dur: 0.5 });
    this.bois(290, { gain: 0.14, dur: 0.22, delay: 0.085 });
  }
  card() {
    this.papier(0.24, 0.1);
    this.bois(520, { gain: 0.07, dur: 0.12, delay: 0.16 });
  }
  jail() {
    // Un volume lourd qui tombe, puis le claquement sec d'un verrou.
    this.bois(78, { gain: 0.3, dur: 0.8 });
    this.resonance(1750, 0.4, { gain: 0.1, q: 24, delay: 0.1 });
    this.resonance(980, 0.3, { gain: 0.07, q: 18, delay: 0.14 });
  }
  jackpot() {
    // La cagnotte : une averse de pièces, de plus en plus serrée.
    for (let i = 0; i < 16; i++) {
      this.piece(Math.pow(i / 16, 0.7) * 1.1 + Math.random() * 0.04, 0.085);
    }
  }
  alarm() {
    // Deux coups secs frappés sur la table.
    this.bois(620, { gain: 0.17, dur: 0.13 });
    this.bois(620, { gain: 0.14, dur: 0.13, delay: 0.17 });
  }
  victory() {
    // Seul moment où une note se justifie : la partie est finie, plus rien
    // ne viendra se superposer. Un accord grave et tenu, sous la pluie de pièces.
    for (let i = 0; i < 22; i++) this.piece(Math.random() * 1.4, 0.075);
    [131, 196, 262].forEach((f, i) => this.tone(f, 2.6, 'sine', { gain: 0.11, delay: i * 0.12, attack: 0.08 }));
  }
  bankrupt() {
    // L'effondrement : le bois le plus grave, prolongé, sans hauteur claire.
    this.bois(64, { gain: 0.3, dur: 1.3 });
    this.noise(0.7, { gain: 0.07, freq: 170, q: 0.5, delay: 0.05 });
  }
  click() { this.resonance(1150, 0.05, { gain: 0.05, q: 7 }); }
  hover() { this.resonance(1500, 0.03, { gain: 0.02, q: 7 }); }

  /* --------- nappe musicale : arpège lent, non répétitif --------- */

  private startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    const scale = [130.81, 155.56, 174.61, 196, 233.08, 261.63, 311.13, 349.23];
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      const i = this.musicStep++;
      const root = scale[i % scale.length];
      this.tone(root, 3.4, 'sine', { gain: 0.14, dest: this.musicGain });
      if (i % 2 === 0) this.tone(root * 1.5, 2.6, 'triangle', { gain: 0.06, delay: 0.5, dest: this.musicGain });
      if (i % 4 === 3) this.tone(root * 2, 2.2, 'sine', { gain: 0.05, delay: 1.1, dest: this.musicGain });
    };
    tick();
    this.musicTimer = window.setInterval(tick, 2600);
  }

  private stopMusic() {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}

export const audio = new AudioEngine();
