/* =========================================================================================
   Silnik audio INWAZJA — Web Audio API, całkowicie niezależny od Phasera.

   Zasady:
   - zero pracy, dopóki dźwięk jest wyłączony (żadnego AudioContext, żadnych timerów),
   - jeden wspólny kontekst i trzy szyny (SFX, pętle, muzyka) + limiter na wyjściu,
   - buffory dekodowane raz i trzymane w cache; błąd pliku = cichy fallback, gra działa dalej,
   - pętle wrogów są zliczane po typie (jeden głos na typ), nie po osobnikach,
   - limit głosów i minimalne odstępy chronią wydajność przy gęstych falach.
   ========================================================================================= */
import type { EnemyType, TowerType } from '../types';
import {
  ALL_SOUND_IDS,
  ENEMY_LOOPS,
  FADE_MS,
  SOUNDS,
  soundFile,
  type AudioFallback,
  type SoundId,
} from './manifest';

const STORAGE_KEY = 'inwazja:audio-enabled';
const MAX_VOICES = 28;
const PRELOAD_CONCURRENCY = 3;

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;
type ChangeListener = (enabled: boolean) => void;

interface LoopVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

interface PlayOptions {
  /** Mnożnik głośności (np. stopień ulepszenia). */
  gain?: number;
  /** Mnożnik prędkości odtwarzania — steruje pitchem bez zmiany czasu trwania. */
  rate?: number;
}

function readStoredPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function storePreference(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* prywatny tryb / brak pamięci — preferencja po prostu nie przetrwa odświeżenia */
  }
}

/** Determinizm fallbacku: ten sam dźwięk brzmi tak samo przy każdym uruchomieniu. */
function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function noiseRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function waveSample(phase: number, wave: NonNullable<AudioFallback['wave']>): number {
  const p = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  if (wave === 'square') return p < 0.5 ? 1 : -1;
  if (wave === 'sawtooth') return p * 2 - 1;
  if (wave === 'triangle') return p < 0.5 ? p * 4 - 1 : 3 - p * 4;
  return Math.sin(phase);
}

/**
 * Jeden egzemplarz na całą grę. Importują go sceny i komponenty UI — także po restarcie
 * sceny zostaje ten sam kontekst, więc nie ma przerywania muzyki ani wycieków pamięci.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private loopsBus: GainNode | null = null;
  private musicBus: GainNode | null = null;

  private buffers = new Map<SoundId, AudioBuffer>();
  private fallbacks = new Map<SoundId, AudioBuffer>();
  private failed = new Set<SoundId>();
  private loading = new Map<SoundId, Promise<AudioBuffer | null>>();
  private pendingPlays = new Map<SoundId, PlayOptions>();
  private preloadQueue: SoundId[] = [];
  private preloadActive = 0;
  private lastPlayedAt = new Map<SoundId, number>();
  private oneShots = 0;

  private loopVoices = new Map<SoundId, LoopVoice>();
  private wantedLoops = new Set<SoundId>();
  private musicVoice: LoopVoice | null = null;
  private musicWanted = false;

  private listeners = new Set<ChangeListener>();
  private enabled: boolean;
  private unlockArmed = false;
  private readonly unlockHandler = () => {
    if (!this.enabled) return;
    this.ensureContext();
    void this.ctx?.resume().catch(() => undefined);
    // Po odświeżeniu strony preferencja jest zapamiętana, ale pliki wczytujemy dopiero
    // po geście użytkownika — wtedy wolno już odtwarzać dźwięk.
    this.preload();
    this.syncLoops();
  };

  constructor() {
    this.enabled = this.isSupported() && readStoredPreference();
    if (this.enabled) this.armUnlock();
  }

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Włączenie/wyłączenie dźwięku; zwraca faktyczny stan (false, gdy WebAudio nie istnieje). */
  setEnabled(next: boolean): boolean {
    if (next && !this.isSupported()) {
      this.enabled = false;
      this.emit();
      return false;
    }
    if (next === this.enabled) return this.enabled;
    this.enabled = next;
    storePreference(next);

    if (next) {
      this.ensureContext();
      this.armUnlock();
      void this.ctx?.resume().catch(() => undefined);
      this.setMaster(1);
      this.preload();
      this.syncLoops();
    } else {
      this.pendingPlays.clear();
      this.setMaster(0);
      this.stopAllLoops();
    }
    this.emit();
    return this.enabled;
  }

  toggle(): boolean {
    return this.setEnabled(!this.enabled);
  }

  /* ----------------------------------- budowa grafu ----------------------------------- */

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (!this.isSupported()) return null;
    const ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!ctor) return null;
    try {
      const ctx = new ctor({ latencyHint: 'interactive' });
      const master = ctx.createGain();
      master.gain.value = this.enabled ? 1 : 0;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.knee.value = 20;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      const sfx = ctx.createGain();
      const loops = ctx.createGain();
      const music = ctx.createGain();
      sfx.connect(master);
      loops.connect(master);
      music.connect(master);
      master.connect(limiter);
      limiter.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.sfxBus = sfx;
      this.loopsBus = loops;
      this.musicBus = music;
      return ctx;
    } catch {
      return null;
    }
  }

  private armUnlock() {
    if (this.unlockArmed || typeof window === 'undefined') return;
    this.unlockArmed = true;
    window.addEventListener('pointerdown', this.unlockHandler, { capture: true, passive: true });
    window.addEventListener('keydown', this.unlockHandler, { capture: true, passive: true });
    window.addEventListener('touchend', this.unlockHandler, { capture: true, passive: true });
  }

  private setMaster(value: number) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(value, now + 0.06);
  }

  private emit() {
    for (const listener of this.listeners) listener(this.enabled);
  }

  /* ----------------------------------- wczytywanie ----------------------------------- */

  /** Wczytuje wszystkie pliki w tle; brak plików kończy się fallbackiem, nie błędem gry. */
  preload() {
    if (!this.enabled) return;
    for (const id of ALL_SOUND_IDS) {
      if (this.buffers.has(id) || this.failed.has(id) || this.loading.has(id)) continue;
      if (!this.preloadQueue.includes(id)) this.preloadQueue.push(id);
    }
    this.pumpPreload();
  }

  private pumpPreload() {
    if (!this.enabled || !this.ctx) return;
    while (this.preloadActive < PRELOAD_CONCURRENCY && this.preloadQueue.length) {
      const id = this.preloadQueue.shift();
      if (!id) break;
      this.preloadActive++;
      void this.loadBuffer(id).finally(() => {
        this.preloadActive--;
        this.syncLoops();
        this.pumpPreload();
      });
    }
  }

  private requestLoad(id: SoundId) {
    if (!this.enabled || !this.ctx || this.buffers.has(id) || this.failed.has(id) || this.loading.has(id)) return;
    void this.loadBuffer(id).finally(() => this.syncLoops());
  }

  private loadBuffer(id: SoundId): Promise<AudioBuffer | null> {
    const ready = this.buffers.get(id);
    if (ready) return Promise.resolve(ready);
    const running = this.loading.get(id);
    if (running) return running;
    const ctx = this.ensureContext();
    if (!ctx) return Promise.resolve(null);

    const promise = (async () => {
      try {
        const response = await fetch(soundFile(id));
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.arrayBuffer();
        const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
          ctx.decodeAudioData(data, resolve, reject);
        });
        this.buffers.set(id, buffer);
        return buffer;
      } catch {
        // Brak pliku albo uszkodzone nagranie: zapamiętujemy porażkę i korzystamy z fallbacku.
        this.failed.add(id);
        return null;
      } finally {
        this.loading.delete(id);
      }
    })();
    this.loading.set(id, promise);
    return promise;
  }

  /* ----------------------------------- odtwarzanie ----------------------------------- */

  /** Odtwarza efekt. Brak pliku nie rzuca wyjątku — gra toczy się dalej. */
  play(id: SoundId, options: PlayOptions = {}) {
    if (!this.enabled) return;
    const def = SOUNDS[id];
    if (!def) return;
    const ctx = this.ctx ?? this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.lastPlayedAt.get(id) ?? 0;
    if (def.minGapMs && now - last < def.minGapMs) return;
    this.lastPlayedAt.set(id, now);

    const buffer = this.buffers.get(id);
    if (!buffer && !this.failed.has(id)) {
      // Nie zastępujemy sampla syntezatorem podczas ładowania. Odtwarzamy ostatnie
      // żądanie po zakończeniu pobierania albo używamy fallbacku dopiero po błędzie.
      this.pendingPlays.set(id, options);
      void this.loadBuffer(id).then((loaded) => {
        const pending = this.pendingPlays.get(id);
        if (!pending) return;
        this.pendingPlays.delete(id);
        const ready = loaded ?? this.fallbackBuffer(id);
        if (this.enabled && ready) this.playBuffer(id, ready, pending);
      });
      return;
    }
    this.playBuffer(id, buffer ?? this.fallbackBuffer(id), options);
  }

  private playBuffer(id: SoundId, buffer: AudioBuffer | null, options: PlayOptions) {
    if (!buffer) return;
    const def = SOUNDS[id];
    const ctx = this.ctx ?? this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    if (this.oneShots >= MAX_VOICES) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = Math.min(2, Math.max(0.5, options.rate ?? 1));
      const gain = ctx.createGain();
      gain.gain.value = Math.min(1.2, Math.max(0, def.volume * (options.gain ?? 1)));
      source.connect(gain);
      gain.connect(this.sfxBus ?? ctx.destination);
      source.onended = () => {
        this.oneShots = Math.max(0, this.oneShots - 1);
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          /* węzeł mógł zostać rozłączony przez zamknięcie kontekstu */
        }
      };
      this.oneShots++;
      source.start();
    } catch {
      /* np. limit sprzętowych źródeł — pomijamy pojedynczy efekt */
    }
  }

  /* ------------------------------------ publiczne API ----------------------------------- */

  uiClick() {
    this.play('ui-click');
  }

  /** Jeden wspólny censor-alert dla wszystkich zablokowanych akcji. */
  blocked() {
    this.play('ui-blocked');
  }

  towerSelect() {
    this.play('ui-select');
  }

  wave() {
    this.play('ui-wave');
  }

  startGame() {
    this.play('ui-start');
  }

  placeTower() {
    this.play('tower-place');
  }

  upgradeTower(level: number) {
    this.play(level >= 2 ? 'tower-upgrade-2' : 'tower-upgrade-1');
  }

  /** Każda broń ma własny sample; poziom steruje pitchem i głośnością. */
  shot(type: TowerType, level: number) {
    this.play(`shot-${type}` as SoundId, {
      rate: 1 + level * 0.06,
      gain: 0.9 + level * 0.08,
    });
  }

  /** Zwykli wrogowie dzielą jeden sample (pitch/głośność), bossy mają własne wybuchy. */
  enemyDeath(type: EnemyType) {
    if (type === 'megaboss') {
      this.play('explosion-megaboss', { rate: 0.85, gain: 1 });
      return;
    }
    if (type === 'boss') {
      this.play('explosion-boss', { rate: 0.95, gain: 0.95 + Math.random() * 0.05 });
      return;
    }
    this.play('explosion-enemy', {
      rate: 0.9 + Math.random() * 0.2,
      gain: 0.82 + Math.random() * 0.2,
    });
  }

  /** Wróg dotarł do bazy — gracz traci punkty; im groźniejszy wróg, tym niższe i głośniejsze uderzenie. */
  baseHit(type: EnemyType) {
    if (type === 'megaboss') {
      this.play('base-hit', { rate: 0.78, gain: 1.15 });
      return;
    }
    if (type === 'boss') {
      this.play('base-hit', { rate: 0.88, gain: 1.05 });
      return;
    }
    this.play('base-hit', { rate: 1, gain: 0.95 });
  }

  /** Plansza zwycięstwa lub porażki. */
  result(won: boolean) {
    this.play(won ? 'ui-victory' : 'ui-defeat');
  }

  /* -------------------------------------- pętle -------------------------------------- */

  /** Główny loop gry — gra tak długo, jak długo dźwięk jest włączony i trwa rozgrywka. */
  startMusic() {
    this.musicWanted = true;
    this.syncLoops();
  }

  stopMusic() {
    this.musicWanted = false;
    this.stopMusicVoice();
  }

  /**
   * Jeden loop na rodzaj wroga obecny na planszy. Powtarzane wywołania z tym samym
   * zbiorem nic nie robią — dlatego można je bezpiecznie odpalać po każdej zmianie składu.
   */
  setEnemyLoops(types: readonly EnemyType[]) {
    const wanted = new Set<SoundId>();
    for (const type of types) wanted.add(ENEMY_LOOPS[type]);
    for (const id of this.wantedLoops) {
      if (!wanted.has(id)) this.stopLoop(id);
    }
    this.wantedLoops = wanted;
    this.syncLoops();
  }

  /** Wyjście z gry: gasi muzykę i wszystkie silniki, ale nie zmienia preferencji dźwięku. */
  stopGame() {
    this.stopMusic();
    this.wantedLoops.clear();
    this.stopAllLoops();
  }

  private syncLoops() {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

    for (const id of this.wantedLoops) {
      if (this.loopVoices.has(id)) continue;
      const def = SOUNDS[id];
      const buffer = this.buffers.get(id) ?? (this.failed.has(id) ? this.fallbackBuffer(id) : null);
      if (!buffer) {
        this.requestLoad(id);
        continue;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.linearRampToValueAtTime(def.volume, ctx.currentTime + FADE_MS / 1000);
      source.connect(gain);
      gain.connect(this.loopsBus ?? ctx.destination);
      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          /* kontekst zamknięty */
        }
      };
      source.start();
      this.loopVoices.set(id, { source, gain });
    }

    if (this.musicWanted && !this.musicVoice) {
      const buffer = this.buffers.get('music-game') ?? (this.failed.has('music-game') ? this.fallbackBuffer('music-game') : null);
      if (buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        gain.gain.linearRampToValueAtTime(SOUNDS['music-game'].volume, ctx.currentTime + FADE_MS / 1000);
        source.connect(gain);
        gain.connect(this.musicBus ?? ctx.destination);
        source.onended = () => {
          try {
            source.disconnect();
            gain.disconnect();
          } catch {
            /* kontekst zamknięty */
          }
        };
        source.start();
        this.musicVoice = { source, gain };
      } else {
        this.requestLoad('music-game');
      }
    }
  }

  private stopLoop(id: SoundId) {
    const voice = this.loopVoices.get(id);
    if (!voice) return;
    this.loopVoices.delete(id);
    this.fadeOut(voice);
  }

  private stopMusicVoice() {
    const voice = this.musicVoice;
    if (!voice) return;
    this.musicVoice = null;
    this.fadeOut(voice, 200);
  }

  private stopAllLoops() {
    for (const id of [...this.loopVoices.keys()]) this.stopLoop(id);
    this.stopMusicVoice();
  }

  private fadeOut(voice: LoopVoice, fadeMs = FADE_MS) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
      voice.gain.gain.linearRampToValueAtTime(0.0001, now + fadeMs / 1000);
      voice.source.stop(now + fadeMs / 1000 + 0.02);
    } catch {
      try {
        voice.source.stop();
      } catch {
        /* źródło już zatrzymane */
      }
    }
  }

  /* ------------------------------------ fallback ------------------------------------ */

  /**
   * Krótki, syntezowany bufor zastępczy. Tworzony leniwie i cache'owany, wyłącznie gdy
   * pliku naprawdę brakuje — normalna rozgrywka korzysta z plików i nie płaci za ten kod.
   */
  private fallbackBuffer(id: SoundId): AudioBuffer | null {
    const cached = this.fallbacks.get(id);
    if (cached) return cached;
    const spec = SOUNDS[id].fallback;
    const ctx = this.ctx;
    if (!spec || !ctx) return null;
    try {
      const rate = ctx.sampleRate;
      const length = Math.max(1, Math.round((spec.ms / 1000) * rate));
      const buffer = ctx.createBuffer(1, length, rate);
      const data = buffer.getChannelData(0);
      const rnd = noiseRandom(seedFrom(id));
      const twoPi = Math.PI * 2;
      const wave = spec.wave ?? 'sine';

      if (spec.kind === 'alert') {
        // Censor-alert: kilka krótkich, ostrych sygnałów z ciszą pomiędzy nimi.
        const base = spec.freq ?? 1000;
        const beepSamples = Math.max(1, Math.round(rate * 0.078));
        const gapSamples = Math.max(1, Math.round(rate * 0.055));
        let start = 0;
        let beep = 0;
        while (start < length) {
          const end = Math.min(length, start + beepSamples);
          const freq = beep % 2 === 0 ? base : base * 0.82;
          for (let i = start; i < end; i++) {
            const local = (i - start) / rate;
            const attack = Math.min(1, local / 0.003);
            const release = Math.min(1, (end - i) / Math.max(1, rate * 0.008));
            data[i] += waveSample(twoPi * freq * local, wave) * Math.min(attack, release) * 0.42;
          }
          start = end + gapSamples;
          beep++;
        }
      } else if (spec.kind === 'arp') {
        const notes = spec.notes?.length ? spec.notes : [440];
        const step = Math.max(1, Math.round((spec.stepMs ?? 100) * rate / 1000));
        for (let n = 0; n < notes.length; n++) {
          const start = n * step;
          for (let i = start; i < length; i++) {
            const t = (i - start) / rate;
            const attack = Math.min(1, t / 0.006);
            const env = attack * Math.exp(-3.2 * t);
            data[i] += waveSample(twoPi * notes[n] * t, wave) * env * 0.5;
          }
        }
      } else if (spec.kind === 'engine') {
        const base = spec.freq ?? 90;
        const duration = length / rate;
        // Częstotliwości kwantyzowane do pełnych okresów w buforze → pętla bez kliknięcia.
        const cycles = (freq: number) => Math.max(1, Math.round(freq * duration)) / duration;
        const f1 = cycles(base);
        const f2 = cycles(base * 2.01);
        const f3 = cycles(base * 3.02);
        const lfoRate = cycles(2.5);
        for (let i = 0; i < length; i++) {
          const t = i / rate;
          const lfo = 0.72 + 0.28 * Math.sin(twoPi * lfoRate * t);
          const tone =
            waveSample(twoPi * f1 * t, wave) * 0.42 +
            waveSample(twoPi * f2 * t, wave) * 0.18 +
            waveSample(twoPi * f3 * t, 'sine') * 0.1;
          data[i] = tone * lfo;
        }
      } else {
        // Jednorazowe efekty: krótkie wejście/wyjście eliminuje trzaski.
        const startFreq = spec.freq ?? 220;
        const endFreq = spec.endFreq ?? startFreq;
        const attackSamples = Math.round(rate * 0.006);
        const releaseSamples = Math.round(rate * 0.02);
        let phase = 0;
        let low = 0;
        for (let i = 0; i < length; i++) {
          const k = i / length;
          const freq = startFreq + (endFreq - startFreq) * k;
          phase += (twoPi * freq) / rate;
          const edge = Math.min(1, i / Math.max(1, attackSamples), (length - i) / Math.max(1, releaseSamples));
          let sample = 0;
          if (spec.kind === 'noise') {
            const cutoff = Math.min(0.9, (spec.freq ?? 900) / rate);
            low += ((rnd() * 2 - 1) - low) * cutoff;
            sample = low * Math.exp(-3.4 * k);
          } else if (spec.kind === 'thump') {
            sample = waveSample(phase, 'sine') * Math.exp(-3.8 * k) * 0.95;
            if (spec.noise) {
              low += ((rnd() * 2 - 1) - low) * 0.25;
              sample += low * spec.noise * Math.exp(-5.5 * k) * 0.7;
            }
          } else {
            sample = waveSample(phase, wave) * Math.exp(-3.2 * k);
            if (spec.noise) sample += (rnd() * 2 - 1) * spec.noise * Math.exp(-6 * k) * 0.3;
          }
          data[i] += sample * edge;
        }
      }

      let peak = 0;
      for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(data[i]));
      // Szum po filtrze dolnoprzepustowym (rodzaj 'noise') ma z natury małą amplitudę —
      // bez podbicia wybuchy zwykłych wrogów (~0.09 szczytu) ginęły ok. 15 dB pod pętlami
      // silników wrogów. Dlatego jednorazowe efekty normalizujemy do stałego szczytu 0.8,
      // tak jak generator WAV normalizuje sample do 0.85. Pętle 'engine' zostają tylko
      // przycięte przy 0.8 — ich niższa głośność względem efektów jest celowa.
      const scale = peak <= 0 ? 1 : spec.kind === 'engine' ? Math.min(1, 0.8 / peak) : 0.8 / peak;
      for (let i = 0; i < length; i++) data[i] *= scale;

      this.fallbacks.set(id, buffer);
      return buffer;
    } catch {
      return null;
    }
  }
}

/** Singleton całej gry — audio nie należy do żadnej sceny. */
export const gameAudio = new AudioEngine();
