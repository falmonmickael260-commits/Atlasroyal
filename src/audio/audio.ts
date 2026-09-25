/**
 * Audio entièrement synthétisé (WebAudio) : aucun fichier à télécharger,
 * donc aucun coût de chargement et aucun asset tiers. Chaque effet est
 * une petite partition programmée.
 */
type Voice = 'sine' | 'triangle' | 'square' | 'sawtooth';

const LS_KEY = 'atlas-royale:audio';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  sfxOn = true;
  musicOn = true;

  constructor() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { sfx?: boolean; music?: boolean };
        this.sfxOn = p.sfx ?? true;
        this.musicOn = p.music ?? true;
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
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? 0.5 : 0;
    this.sfxGain.connect(this.master);
    if (this.musicOn) this.startMusic();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
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

  private tone(
    freq: number, dur: number, type: Voice = 'sine',
    { gain = 0.3, delay = 0, slideTo, dest }: { gain?: number; delay?: number; slideTo?: number; dest?: GainNode } = {},
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
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.2));
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

  /* ----------------------- effets de jeu ----------------------- */

  diceShake() {
    for (let i = 0; i < 7; i++) this.noise(0.05, { gain: 0.1, delay: i * 0.055, freq: 900 + Math.random() * 700, q: 2 });
  }
  diceLand() {
    this.noise(0.09, { gain: 0.26, freq: 500, q: 0.8 });
    this.noise(0.07, { gain: 0.18, delay: 0.1, freq: 700, q: 1 });
    this.tone(180, 0.1, 'triangle', { gain: 0.12, delay: 0.02 });
  }
  step() { this.tone(440, 0.05, 'triangle', { gain: 0.1, slideTo: 620 }); }
  land() { this.tone(300, 0.14, 'sine', { gain: 0.2, slideTo: 420 }); }
  buy() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'triangle', { gain: 0.22, delay: i * 0.07 }));
  }
  coin() {
    this.tone(1180, 0.08, 'square', { gain: 0.1 });
    this.tone(1560, 0.12, 'square', { gain: 0.08, delay: 0.05 });
  }
  pay() { this.tone(360, 0.22, 'sawtooth', { gain: 0.16, slideTo: 150 }); }
  build() {
    this.noise(0.14, { gain: 0.16, freq: 300, q: 0.6 });
    [330, 415, 523, 659].forEach((f, i) => this.tone(f, 0.22, 'triangle', { gain: 0.18, delay: 0.1 + i * 0.09 }));
  }
  card() {
    this.noise(0.18, { gain: 0.12, freq: 2600, q: 0.7 });
    this.tone(880, 0.16, 'sine', { gain: 0.14, delay: 0.12, slideTo: 1320 });
  }
  jail() {
    this.tone(220, 0.5, 'square', { gain: 0.14, slideTo: 90 });
    this.noise(0.3, { gain: 0.18, delay: 0.05, freq: 220, q: 1.4 });
  }
  jackpot() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this.tone(f, 0.5, 'triangle', { gain: 0.2, delay: i * 0.08 }));
    for (let i = 0; i < 10; i++) this.tone(1200 + Math.random() * 900, 0.1, 'square', { gain: 0.06, delay: 0.3 + i * 0.05 });
  }
  alarm() {
    [0, 0.18, 0.36].forEach((d) => this.tone(740, 0.14, 'square', { gain: 0.14, delay: d }));
  }
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.7, 'triangle', { gain: 0.24, delay: i * 0.14 }));
    [131, 165, 196, 262].forEach((f, i) => this.tone(f, 1.4, 'sine', { gain: 0.16, delay: i * 0.14 }));
  }
  bankrupt() {
    this.tone(330, 1.1, 'sawtooth', { gain: 0.18, slideTo: 60 });
    this.noise(0.6, { gain: 0.12, freq: 180, q: 0.5 });
  }
  click() { this.tone(680, 0.04, 'sine', { gain: 0.1 }); }
  hover() { this.tone(900, 0.03, 'sine', { gain: 0.04 }); }

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
