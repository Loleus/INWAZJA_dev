/* =========================================================================================
   Biblioteka dźwięków INWAZJA — standardowe nazwy plików.

   Każdy dźwięk ma własny plik w `public/audio/<id>.mp3`. Podmiana na własne nagranie polega
   na podmianie pliku pod tą samą nazwą (albo zmianie rozszerzenia w tym manifeście).
   Silnik jest całkowicie niezależny od Phasera: brak pliku, błąd 404 albo zablokowany
   AudioContext nie przerywa gry — dany dźwięk po prostu się nie odegra (albo skorzysta
   z proceduralnego fallbacku, jeśli jest opisany).
   ========================================================================================= */
import type { EnemyType } from '../types';

/** Ścieżka plików audio liczona od adresu strony — działa też w podkatalogu i w PWA. */
function audioFile(id: string): string {
  const base = typeof document === 'undefined' ? './' : new URL('audio/', document.baseURI).href;
  return base + id + '.mp3';
}

export type FallbackKind = 'tone' | 'noise' | 'thump' | 'arp' | 'engine' | 'alert';

/**
 * Proceduralny zapas na wypadek braku pliku. To nie jest drugi system dźwięku — tylko
 * krótki, syntezowany bufor w tym samym AudioContext, więc awaria assetów nie jest słyszalna
 * jako cisza i nie wymaga żadnego dodatkowego wczytywania.
 */
export interface AudioFallback {
  kind: FallbackKind;
  /** Częstotliwość podstawowa (Hz). */
  freq?: number;
  /** Częstotliwość końcowa dla tonów i uderzeń. */
  endFreq?: number;
  /** Długość bufora fallbacku (ms). */
  ms: number;
  wave?: 'sine' | 'square' | 'sawtooth' | 'triangle';
  /** Kolejne dźwięki arpeggio (Hz). */
  notes?: number[];
  /** Odstęp między dźwiękami arpeggio (ms). */
  stepMs?: number;
  /** Ilość szumu 0..1. */
  noise?: number;
}

export interface SoundDef {
  /** Plik w `public/audio/` (bez rozszerzenia; silnik dokłada `.mp3`). */
  id: string;
  volume: number;
  /** Dźwięk zapętlony (podkład muzyczny i silniki wrogów). */
  loop?: boolean;
  /** Minimalny odstęp między kolejnymi odtworzeniami (ochrona głosów przy tłumie wrogów). */
  minGapMs?: number;
  fallback?: AudioFallback;
}

export type SoundId =
  | 'ui-click'
  | 'ui-select'
  | 'ui-wave'
  | 'ui-blocked'
  | 'ui-start'
  | 'ui-victory'
  | 'ui-defeat'
  | 'tower-place'
  | 'tower-upgrade-1'
  | 'tower-upgrade-2'
  | 'shot-arrow'
  | 'shot-cannon'
  | 'shot-frost'
  | 'shot-lightning'
  | 'explosion-enemy'
  | 'explosion-boss'
  | 'explosion-megaboss'
  | 'base-hit'
  | 'loop-basic'
  | 'loop-fast'
  | 'loop-tank'
  | 'loop-boss'
  | 'loop-megaboss'
  | 'music-game';

/** Jeden loop na rodzaj wroga obecny na planszy — nie na pojedynczego osobnika. */
export const ENEMY_LOOPS: Record<EnemyType, SoundId> = {
  basic: 'loop-basic',
  fast: 'loop-fast',
  tank: 'loop-tank',
  boss: 'loop-boss',
  megaboss: 'loop-megaboss',
};

/** Czas zanikania/podgłaszania warstw audio (ms) — krótki, żeby nie ucinać ataków. */
export const FADE_MS = 120;

export const SOUNDS: Record<SoundId, SoundDef> = {
  /* ---------------------------------- interfejs ---------------------------------- */
  'ui-click': {
    id: 'ui-click',
    volume: 0.5,
    minGapMs: 30,
    fallback: { kind: 'tone', freq: 880, endFreq: 620, ms: 70, wave: 'sine' },
  },
  'ui-select': {
    id: 'ui-select',
    volume: 0.5,
    minGapMs: 40,
    fallback: { kind: 'tone', freq: 560, endFreq: 840, ms: 130, wave: 'triangle' },
  },
  'ui-wave': {
    id: 'ui-wave',
    volume: 0.35,
    minGapMs: 250,
    fallback: { kind: 'arp', notes: [392, 523, 659], stepMs: 95, ms: 380, wave: 'triangle' },
  },
  /* Censor-alert: jeden wspólny sygnał odmowy dla zablokowanych akcji.
     Brak pliku MP3 nie jest problemem — alert powstaje proceduralnie w AudioEngine. */
  'ui-blocked': {
    id: 'ui-blocked',
    volume: 0.6,
    minGapMs: 180,
    fallback: { kind: 'alert', freq: 1040, ms: 330, wave: 'square' },
  },
  'ui-start': {
    id: 'ui-start',
    volume: 0.5,
    minGapMs: 400,
    fallback: { kind: 'arp', notes: [262, 392, 523], stepMs: 120, ms: 520, wave: 'sawtooth' },
  },
  'ui-victory': {
    id: 'ui-victory',
    volume: 0.1,
    minGapMs: 500,
    fallback: { kind: 'arp', notes: [523, 659, 784, 1047], stepMs: 150, ms: 1200, wave: 'triangle' },
  },
  'ui-defeat': {
    id: 'ui-defeat',
    volume: 0.1,
    minGapMs: 500,
    fallback: { kind: 'arp', notes: [392, 330, 262, 196], stepMs: 200, ms: 1100, wave: 'sawtooth' },
  },

  /* ----------------------------------- wieże ----------------------------------- */
  'tower-place': {
    id: 'tower-place',
    volume: 0.3,
    minGapMs: 60,
    fallback: { kind: 'thump', freq: 170, endFreq: 60, ms: 220, noise: 0.25 },
  },
  'tower-upgrade-1': {
    id: 'tower-upgrade-1',
    volume: 0.1,
    minGapMs: 120,
    fallback: { kind: 'arp', notes: [620, 930], stepMs: 85, ms: 320, wave: 'triangle' },
  },
  'tower-upgrade-2': {
    id: 'tower-upgrade-2',
    volume: 0.1,
    minGapMs: 120,
    fallback: { kind: 'arp', notes: [700, 1050, 1400], stepMs: 80, ms: 380, wave: 'triangle' },
  },

  /* ---------------------------------- wystrzały ---------------------------------- */
  'shot-arrow': {
    id: 'shot-arrow',
    volume: 0.3,
    minGapMs: 45,
    fallback: { kind: 'tone', freq: 1250, endFreq: 760, ms: 80, wave: 'triangle' },
  },
  'shot-cannon': {
    id: 'shot-cannon',
    volume: 0.45,
    minGapMs: 70,
    fallback: { kind: 'thump', freq: 150, endFreq: 45, ms: 200, noise: 0.5 },
  },
  'shot-frost': {
    id: 'shot-frost',
    volume: 0.25,
    minGapMs: 55,
    fallback: { kind: 'tone', freq: 1500, endFreq: 2200, ms: 140, wave: 'sine' },
  },
  'shot-lightning': {
    id: 'shot-lightning',
    volume: 0.4,
    minGapMs: 55,
    fallback: { kind: 'noise', ms: 130, noise: 1 },
  },

  /* ---------------------------------- wybuchy ---------------------------------- */
  'explosion-enemy': {
    id: 'explosion-enemy',
    volume: 0.4,
    minGapMs: 55,
    fallback: { kind: 'noise', ms: 320, noise: 1, freq: 420 },
  },
  'explosion-boss': {
    id: 'explosion-boss',
    volume: 0.25,
    minGapMs: 150,
    fallback: { kind: 'thump', freq: 110, endFreq: 32, ms: 650, noise: 0.7 },
  },
  'explosion-megaboss': {
    id: 'explosion-megaboss',
    volume: 0.3,
    minGapMs: 300,
    fallback: { kind: 'thump', freq: 82, endFreq: 24, ms: 1000, noise: 0.85 },
  },

  /* ------------------------------ utrata punktów ------------------------------ */
  /* Wróg dotarł do bazy gracza — ciężkie uderzenie; pitch sterowany typem wroga
     w AudioEngine.baseHit(), więc jeden sample obsługuje całą skalę zagrożenia. */
  'base-hit': {
    id: 'base-hit',
    volume: 0.2,
    minGapMs: 140,
    fallback: { kind: 'thump', freq: 240, endFreq: 42, ms: 480, noise: 0.45 },
  },

  /* -------------------------------- pętle wrogów -------------------------------- */
  'loop-basic': {
    id: 'loop-basic',
    volume: 0.22,
    loop: true,
    fallback: { kind: 'engine', freq: 82, ms: 1400, wave: 'sawtooth' },
  },
  'loop-fast': {
    id: 'loop-fast',
    volume: 0.18,
    loop: true,
    fallback: { kind: 'engine', freq: 118, ms: 1200, wave: 'sawtooth' },
  },
  'loop-tank': {
    id: 'loop-tank',
    volume: 0.26,
    loop: true,
    fallback: { kind: 'engine', freq: 52, ms: 1600, wave: 'square' },
  },
  'loop-boss': {
    id: 'loop-boss',
    volume: 0.3,
    loop: true,
    fallback: { kind: 'engine', freq: 42, ms: 1700, wave: 'sawtooth' },
  },
  'loop-megaboss': {
    id: 'loop-megaboss',
    volume: 0.34,
    loop: true,
    fallback: { kind: 'engine', freq: 33, ms: 1800, wave: 'square' },
  },

  /* ---------------------------------- muzyka ---------------------------------- */
  'music-game': {
    id: 'music-game',
    volume: 0.2,
    loop: true,
    fallback: { kind: 'engine', freq: 110, ms: 4000, wave: 'triangle' },
  },
};

/** Wszystkie identyfikatory — używane przez preloader i testy. */
export const ALL_SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

/** Ścieżka pliku danego dźwięku (np. do wygenerowania paczki PWA). */
export function soundFile(id: SoundId): string {
  return audioFile(SOUNDS[id].id);
}
