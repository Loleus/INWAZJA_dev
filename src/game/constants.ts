/* =========================================================================================
   INWAZJA — wszystkie parametry gry w jednym miejscu: układ ekranu, czcionki, kolory,
   nakładki, faktury, przyciski, ekonomia, fale, broń i wrogowie.
   ========================================================================================= */
import type { EnemyType, TowerLevelStats, TowerType } from './types';

const css = (color: number) => '#' + color.toString(16).padStart(6, '0');

/* ----------------------------------- układ ekranu ----------------------------------- */
/** Gęsta siatka planszy: 800 / 25 = 32 kolumny, 600 / 25 = 24 wiersze. */
export const CELL = 25;
export const COLS = 32;
export const ROWS = 24;
/** Logiczna komórka drogi = 2×2 gęste komórki. */
export const PATH_CELL = 50;

/** Pasek górny (0..60) / plansza (60..660) / pasek dolny (660..730). */
export const GAME_W = 800;
export const CENTER_X = GAME_W / 2;
export const WORLD_Y = 60;
export const BOARD_H = ROWS * CELL;
export const PLAY_BOTTOM = WORLD_Y + BOARD_H;
export const PANEL_H = 70;
export const GAME_H = PLAY_BOTTOM + PANEL_H;
export const TOP_BAR_CY = WORLD_Y / 2;
export const BOTTOM_BAR_CY = (PLAY_BOTTOM + GAME_H) / 2;
export const BOARD_CY = WORLD_Y + BOARD_H / 2;

/** Rozdzielczość renderowania tekstów i faktur — ostre także na HiDPI. */
export const UI_RESOLUTION =
  typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

export const DEPTH = {
  GRID: 0,
  PATH: 1,
  TOWER: 5,
  ENEMY: 10,
  PROJECTILE: 15,
  FX: 18,
  HEALTH: 20,
  HUD: 50,
  PANEL: 60,
} as const;

/** Menu rysuje planszę pod interfejsem (ujemne głębokości). */
export const MENU_DEPTH = {
  stars: -30,
  board: -20,
  wash: -10,
  bars: -5,
} as const;

/* ----------------------------------- czcionki ----------------------------------- */
export const FONT = {
  ui: 'Cause, Roboto, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  title: 'Audiowide, "Trebuchet MS", sans-serif',
  footer: 'Yarin, Cause, Roboto, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const;

/** Czcionki wczytywane przed startem menu. */
export const FONT_PRELOAD = [
  '46px Audiowide',
  '400 12px Cause',
  '500 14px Cause',
  '700 17px Cause',
  '900 22px Cause',
];
export const FONT_PRELOAD_TIMEOUT_MS = 1500;

export const FONT_SIZE = {
  title: 72,
  menuHeader: 22,
  menuCardName: 15,
  menuCardStat: 11,
  menuCardEffectFallback: [10, 9],
  menuEnemyHp: 12,
  startButton: 16,
  footerMark: 23,
  footerName: 18,
  exitLetter: 48,
  hudCounter: 19,
  hudCounterSmall: 17,
  hudScoreMark: 24,
  prompter: 12,
  prompterMin: 10,
  prompterStep: 0.5,
  hudGlyph: 19,
  hudMenuGlyph: 21,
  hudSpeed: 16,
  waveButton: 15,
  towerName: 14,
  towerCost: 12,
  towerHotkey: 11,
  infoTitle: 12,
  infoLevel: 9.5,
  infoClose: 13,
  infoStats: 10,
  infoSmall: 9.5,
  infoSmallFallback: 9,
  infoButton: 9.5,
  infoButtonFallback: 8.5,
  infoPrice: 9,
  infoPriceFallback: 8,
  endTitle: 52,
  endDesc: 14,
  endLabel: 15,
  endValue: 16,
  endRank: 14,
  endRating: 48,
  endHint: 13,
  endButton: 17,
} as const;

/* ----------------------------------- paleta kolorów ----------------------------------- */
export const PALETTE = {
  white: 0xffffff,
  black: 0x000000,
  night: 0x0b1220,
  slate950: 0x020617,
  slate900: 0x0f172a,
  slate800: 0x1e293b,
  slate700: 0x334155,
  slate600: 0x475569,
  slate500: 0x64748b,
  slate400: 0x94a3b8,
  slate300: 0xcbd5e1,
  slate200: 0xe2e8f0,
  slate100: 0xf1f5f9,
  slate50: 0xf8fafc,
  green600: 0x16a34a,
  green500: 0x22c55e,
  green400: 0x4ade80,
  green200: 0xbbf7d0,
  emerald300: 0x6ee7b7,
  emerald50: 0xecfdf5,
  amber500: 0xf59e0b,
  amber400: 0xfbbf24,
  amber200: 0xfde68a,
  orange300: 0xfdba74,
  red900: 0x7f1d1d,
  red500: 0xef4444,
  red400: 0xf87171,
  red300: 0xfca5a5,
  red100: 0xfee2e2,
  blue700: 0x1d4ed8,
  blue400: 0x60a5fa,
  blue300: 0x93c5fd,
  violet300: 0xc4b5fd,
  purple500: 0xa855f7,
  purple200: 0xe9d5ff,
} as const;

/** Te same kolory w zapisie CSS dla tekstów. */
export const CSS = Object.fromEntries(
  Object.entries(PALETTE).map(([name, value]) => [name, css(value)]),
) as Record<keyof typeof PALETTE, string>;

export const TEXT_COLOR = {
  primary: CSS.slate100,
  light: CSS.slate200,
  muted: CSS.slate400,
  dim: CSS.slate500,
  label: CSS.slate300,
  value: CSS.slate50,
  stat: '#a8b6c8',
  effect: '#8ea0b6',
  header: '#cccccc',
  onGreen: CSS.emerald50,
  gold: CSS.amber400,
  danger: CSS.red400,
  hotkey: '#d9e8d9',
  waveCounter: CSS.blue300,
  lives: CSS.red400,
  exitLetter: CSS.green400,
  footer: '#88bbff',
} as const;

/** Cień pod napisami na zielonych przyciskach i nagłówkach menu. */
export const TEXT_SHADOW = { color: '#022c1a', offsetY: 2, blur: 4 } as const;
export const TITLE_FALLBACK_SHADOW = { color: '#182720', offsetY: 3, blur: 8 } as const;

/* ----------------------------------- nakładki i faktury ----------------------------------- */
export const OVERLAY = {
  /** Kamienna faktura na planszy w menu. */
  boardWash: { color: 0xb8995e, alpha: 0.4, grain: 0.42, darkness: 0.12 },
  /** Przyciemnienie planszy w pauzie. */
  pause: { color: PALETTE.slate950, alpha: 0.45 },
  /** Linia oddzielająca paski od planszy. */
  barDivider: { color: PALETTE.slate700, thickness: 2 },
  /** Cień kart menu, gdy canvas jest niedostępny. */
  cardShadowFallback: { color: 0x052e16, alpha: 0.85, offsetY: 3 },
} as const;

/** Okienka menu: ciemna baza z domieszką koloru ramki. */
export const CARD = {
  base: 0x0a1119,
  tint: 0.2,
  /** Promień zaokrąglenia narożników okienek menu i przycisku startu. */
  cornerRadius: 8,
  shadowPad: 12,
  /** Cień podąża za kształtem okienka — taki sam promień jak narożniki kart. */
  shadowRadius: 8,
  shadowBlur: 9,
  shadowOffsetY: 4,
  shadowColor: 'rgba(0, 0, 0, 0.78)',
  shadowFill: 'rgba(0, 0, 0, 0.9)',
} as const;

export const TEXTURE = {
  grass: [
    { base: 0x4a7f2c, edge: 0x46792a },
    { base: 0x47792a, edge: 0x437428 },
  ],
  sand: [
    { base: 0xc9a86a, edge: 0xc4a465 },
    { base: 0xc7a669, edge: 0xc0a061 },
  ],
  cornerRadius: 9,
  /** Faktura kamienia: domyślna siła ziarna kart i siła ziarna przycisków. */
  stoneGrain: 0.28,
  buttonGrain: 0.13,
  /** Rozmiar źródła faktury pasków (okienko czołgu w menu). */
  barStoneSource: { width: 138, height: 130 },
  /** Rozmiar źródła faktury kart wież (okienko broni w menu). */
  towerStoneSource: { width: 152, height: 140 },
  /** Rozmiar źródła faktury przycisku FALA (przycisk startu w menu). */
  buttonStoneSource: { width: 210, height: 44 },
  camo: {
    base: '#dddddd',
    tones: ['#d4d8de', '#c6ccd4', '#b0b8c2', '#98a1ad'],
    accent: '#f4f6f8',
    dark: '#5a6473',
    shadow: '#0a0f14',
  },
} as const;

/* ----------------------------------- przyciski ----------------------------------- */
export const BUTTON = {
  neutral: {
    fill: PALETTE.slate800,
    hover: PALETTE.slate700,
    stroke: PALETTE.slate600,
    strokeWidth: 1.5,
    glyph: CSS.slate200,
  },
  primary: {
    fill: PALETTE.green600,
    hover: PALETTE.green500,
    stroke: PALETTE.green400,
    hoverFrame: PALETTE.green200,
    strokeWidth: 1.5,
    text: CSS.emerald50,
  },
  hoverTweenMs: 200,
} as const;

/* ----------------------------------- ekonomia i tempo gry ----------------------------------- */
export const TOTAL_WAVES = 50;
export const START_GOLD = 500;
export const START_LIVES = 30;
export const SPEEDS = [1, 2];
/** Sprzeda| zwraca 60 zainwestowanego zBota. */
export const SELL_FACTOR = 0.6;
export const MAX_TOWER_LEVEL = 2;
export const TOWER_SCALE = 0.62;

export const TIMING = {
  maxFrameMs: 50,
  waveStartDelay: 500,
  minBatchStep: 60,
  enemySpawnAnim: 240,
  hudThrottle: 120,
  hoverRefresh: 120,
  resistFxCooldown: 700,
  victoryDelay: 1600,
  recoil: 70,
  sceneFadeIn: 240,
  sceneFadeOut: 500,
  menuFadeOut: 200,
  endFadeIn: 300,
} as const;

/** Czas wyświetlania komunikatów w PROMPTERZE (ms). */
export const STATUS_HOLD = {
  default: 2600,
  intro: 5200,
  towerHover: 1600,
  wavePreview: 4500,
} as const;

/* ----------------------------------- plansza ----------------------------------- */
/** Szkic 12×16 bloków (1 blok = 50 px). 0 = trawa, litera = jezdnia:
    A — droga środkowa, B — dolna, C — górna, D — wyjście do bazy. */
export const BOARD_SKETCH = [
  '00C0000000000000',
  '00C00CCCCCCCCC00',
  '00CCCC0000000C00',
  '0000000AAAA00C00',
  'AAAAA00A00AABBBD',
  '0000A00A0000B000',
  '0000AAAA00BBB000',
  '0000000000B00000',
  '0BBBB00000BBBB00',
  '0B00B00000000B00',
  '0B00BBBBBBBBBB00',
  '0B00000000000000',
];

/** Trasy wrogów we współrzędnych logicznych (50 px); każda zaczyna się poza planszą. */
export const LANE_ROUTES: Record<string, [number, number][]> = {
  A: [
    [-2, 4], [-1, 4],
    [0, 4], [1, 4], [2, 4], [3, 4], [4, 4],
    [4, 5], [4, 6],
    [5, 6], [6, 6], [7, 6],
    [7, 5], [7, 4], [7, 3],
    [8, 3], [9, 3], [10, 3],
    [10, 4], [11, 4],
    [12, 4], [13, 4], [14, 4],
    [15, 4], [16, 4],
  ],
  B: [
    [1, 12], [1, 11], [1, 10], [1, 9], [1, 8],
    [2, 8], [3, 8], [4, 8],
    [4, 9], [4, 10],
    [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10],
    [11, 10], [12, 10], [13, 10],
    [13, 9], [13, 8],
    [12, 8], [11, 8], [10, 8],
    [10, 7], [10, 6],
    [11, 6], [12, 6],
    [12, 5], [12, 4],
    [13, 4], [14, 4],
    [15, 4], [16, 4],
  ],
  C: [
    [2, -2], [2, -1], [2, 0], [2, 1], [2, 2],
    [3, 2], [4, 2], [5, 2], [5, 1],
    [6, 1], [7, 1], [8, 1], [9, 1],
    [10, 1], [11, 1], [12, 1], [13, 1],
    [13, 2], [13, 3], [13, 4],
    [14, 4], [15, 4], [16, 4],
  ],
};
export const LANES = ['A', 'B', 'C'] as const;

export interface ArrowMarker {
  x: number;
  y: number;
  angle: number;
  dx: number;
  dy: number;
}

/** Strzałki wjazdów (A z lewej, B od dołu, C z góry) i wyjścia do bazy. */
export const LANE_ARROWS: (ArrowMarker & { id: string })[] = [
  { id: 'A', x: 12, y: 285, angle: 0, dx: 1, dy: 0 },
  { id: 'B', x: 75, y: 646, angle: -Math.PI / 2, dx: 0, dy: -1 },
  { id: 'C', x: 125, y: 76, angle: Math.PI / 2, dx: 0, dy: 1 },
];
export const EXIT_ARROW: ArrowMarker = { x: 762, y: 285, angle: 0, dx: 1, dy: 0 };
export const ARROW = {
  spacing: 15,
  hoverRadius: 18,
  alpha: [0.95, 0.5],
  scale: [1, 0.75],
  pulseAlphaFrom: [0.5, 0.25],
  pulseAlphaTo: [1, 0.6],
  pulseScaleFrom: 0.85,
  pulseScaleTo: 1.12,
  pulseMs: 620,
  pulseStepMs: 120,
  exitLetter: 'B',
  exitLetterDx: 8,
  exitLetterAlpha: 0.62,
} as const;

/* ----------------------------------- broń ----------------------------------- */
export const TOWER_ORDER: TowerType[] = ['arrow', 'cannon', 'frost', 'lightning'];

export const TOWER_INFO: Record<TowerType, { hotkey: string; color: number }> = {
  arrow: { hotkey: '1', color: 0x2ecc71 },
  cannon: { hotkey: '2', color: 0xe67e22 },
  frost: { hotkey: '3', color: 0x3498db },
  lightning: { hotkey: '4', color: 0x9b59b6 },
};

/** 4 typy × 3 poziomy. Mróz nie zadaje obrażeń — tylko spowalnia.
    Błyskawica: łańcuch na 3 cele, obrażenia maleją wzdłuż łańcucha. */
export const TOWER_STATS: Record<TowerType, TowerLevelStats[]> = {
  arrow: [
    { damage: 10, range: 130, fireRate: 500, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 50, upgradeCost: 40 },
    { damage: 13, range: 150, fireRate: 400, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 0, upgradeCost: 70 },
    { damage: 15, range: 170, fireRate: 300, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 0, upgradeCost: 0 },
  ],
  cannon: [
    { damage: 25, range: 120, fireRate: 1200, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 90, upgradeCost: 60 },
    { damage: 31, range: 135, fireRate: 1000, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 0, upgradeCost: 100 },
    { damage: 38, range: 150, fireRate: 850, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 0, upgradeCost: 0 },
  ],
  frost: [
    { damage: 0, range: 120, fireRate: 800, slow: 0.35, slowDuration: 2000, chain: 0, chainDamage: [], cost: 120, upgradeCost: 50 },
    { damage: 0, range: 140, fireRate: 700, slow: 0.4, slowDuration: 2500, chain: 0, chainDamage: [], cost: 0, upgradeCost: 85 },
    { damage: 0, range: 160, fireRate: 600, slow: 0.45, slowDuration: 3000, chain: 0, chainDamage: [], cost: 0, upgradeCost: 0 },
  ],
  lightning: [
    { damage: 25, range: 140, fireRate: 1000, slow: 0, slowDuration: 0, chain: 3, chainDamage: [25, 10, 5], cost: 150, upgradeCost: 90 },
    { damage: 30, range: 155, fireRate: 850, slow: 0, slowDuration: 0, chain: 3, chainDamage: [30, 12, 6], cost: 0, upgradeCost: 140 },
    { damage: 35, range: 175, fireRate: 700, slow: 0, slowDuration: 0, chain: 3, chainDamage: [35, 14, 7], cost: 0, upgradeCost: 0 },
  ],
};

export const PROJECTILE_SPEED: Record<TowerType, number> = {
  arrow: 460,
  cannon: 280,
  frost: 380,
  lightning: 700,
};

/** Na które typy wrogów działa broń. */
export const EFFECTIVENESS: Record<EnemyType, Record<TowerType, boolean>> = {
  basic: { arrow: true, cannon: true, frost: true, lightning: false },
  fast: { arrow: true, cannon: false, frost: true, lightning: true },
  tank: { arrow: true, cannon: true, frost: true, lightning: false },
  boss: { arrow: true, cannon: true, frost: false, lightning: true },
  megaboss: { arrow: true, cannon: true, frost: false, lightning: true },
};

/** Ułamek obrażeń zadawanych typom odpornym. */
export const DAMAGE_MULT: Partial<Record<EnemyType, Partial<Record<TowerType, number>>>> = {
  tank: { arrow: 0.25 },
  boss: { arrow: 0.5 },
  megaboss: { arrow: 0.5 },
};

export const COMBAT = {
  chainRange: 110,
  retargetRadius: 160,
  impactDistance: 8,
  recoilPx: 3,
  levelUpTint: PALETTE.amber200,
  /** Wieża „podskakuje” po ulepszeniu — skala startowa animacji, nie rozmiar pocisku. */
  upgradePopScale: 1.25,
} as const;

/** Sprite wieży: rozmiar tekstury, cień wokół korpusu i glif broni. */
export const TOWER_SPRITE = {
  size: 44,
  /** sufiksy tekstur warstw wieży (pełny sprite = korpus + głowica) */
  bodySuffix: '-body',
  headSuffix: '-head',
  body: { inset: 8, size: 28, radius: 8, fill: 0x111827 },
  glyphTop: 1,
  glyphBottom: 21,
  shadowFade: [0.65, 0.5, 0.38, 0.27, 0.17, 0.08],
  shadowStep: 0.4,
  levelDarken: 0.12,
  upgrade: PALETTE.amber200,
  /** Oko celownicze: tarcza, żrenica, rdzeń i obręcz poziomu 3. */
  eye: { outer: 9, pupil: 5.5, core: 3, ring: 21, ringWidth: 2.5, ringAlpha: 0.9, halo: 0.18 },
  /** Cieniowanie blachy korpusu — koncentryczne ramki fazowania jednakowe z czterech stron kwadratu. */
  sheet: {
    outerRim: { inset: 0.6, width: 1.2, alpha: 0.22 },
    bevelLight: { inset: 1.8, width: 1.2, alpha: 0.22 },
    bevelSoft: { inset: 2.9, width: 1, alpha: 0.1 },
    innerGroove: { inset: 4.2, width: 1, alpha: 0.14 },
  },
  /** Efekt 3D głowicy — wyłącznie kołowo-symetryczny, bo głowica się obraca:
      ciemna otoczka pod tarczą (dystans od blachy) i winieta przy brzegu kopuły. */
  headShade: {
    halo: 0.25,
    haloGrow: 1.6,
    rim: 0.16,
    rimInset: 0.7,
    rim2: 0.08,
    rim2Inset: 1.6,
  },
} as const;

/**
 * Ruchoma głowica wieży. Symbol wskazuje kierunek strzału w jednym z 8 bazowych położeń
 * (kierunki proste i po przekątnych), więc każdy pas ma 360/8 = 45 stopni: 22,5 w lewo i w prawo od lufy.
 */
export const TURRET = {
  /** Liczba bazowych położeń głowicy. */
  bases: 8,
  /** Czas pełnego obrotu dookoła; obrót między sąsiednimi bazami to tyle / bases. */
  fullTurnMs: 200,
  /** Położenie spoczynkowe: symbol patrzy w górę. */
  restAngle: 0,
  /** Głowica leży nad korpusem tej samej wieży. */
  depthStep: 0.5,
} as const;

export const TURRET_ANGLE_STEP = (Math.PI * 2) / TURRET.bases;
export const TURRET_STEP_MS = TURRET.fullTurnMs / TURRET.bases;

/* ----------------------------------- wrogowie ----------------------------------- */
export const ENEMY_ORDER: EnemyType[] = ['basic', 'fast', 'tank', 'boss', 'megaboss'];

export const ENEMY_STYLE: Record<EnemyType, { texture: string; color: number }> = {
  basic: { texture: 'enemy-basic', color: PALETTE.red500 },
  fast: { texture: 'enemy-fast', color: PALETTE.amber500 },
  tank: { texture: 'enemy-tank', color: PALETTE.slate500 },
  boss: { texture: 'enemy-boss', color: PALETTE.purple500 },
  megaboss: { texture: 'enemy-megaboss', color: 0xe11d48 },
};

/** Wymiary i skale wrogów: tekstura, plansza, menu, pasek HP, cząstki przy śmierci. */
export const ENEMY_VIEW: Record<
  EnemyType,
  { size: number; gameScale: number; menuScale: number; barW: number; barOffset: number; deathParticles: number }
> = {
  basic: { size: 30, gameScale: 1.2, menuScale: 1, barW: 30, barOffset: 26, deathParticles: 10 },
  fast: { size: 28, gameScale: 1.2, menuScale: 1, barW: 30, barOffset: 26, deathParticles: 10 },
  tank: { size: 34, gameScale: 1.2, menuScale: 1, barW: 34, barOffset: 26, deathParticles: 10 },
  boss: { size: 48, gameScale: 1.1, menuScale: 0.92, barW: 44, barOffset: 30, deathParticles: 26 },
  megaboss: { size: 64, gameScale: 1.45, menuScale: 0.68, barW: 64, barOffset: 46, deathParticles: 60 },
};

/** Prędkości: podstawowy i boss 62, czołg 56, szybki 135 (px/s). */
export const ENEMY_SPEED: Record<EnemyType, number> = { basic: 62, fast: 135, tank: 56, boss: 62, megaboss: 62 };
/** Ile żyć bazy zabiera wróg, który dotrze do końca drogi. */
export const DAMAGE_BY_TYPE: Record<EnemyType, number> = { basic: 1, fast: 1, tank: 2, boss: 5, megaboss: 10 };

/* ----------------------------------- pociski -----------------------------------
   Każdy pocisk ma trzy tony: ciemny spód (bryła), barwę bazową i rozbłysk światła.
   Kształty kierunkowe są rysowane dziobem w prawo, bo lot obraca je o atan2(dy, dx). */
export const PROJECTILE = {
  /** Pocisk wieży 3. poziomu ma dwa razy większą objętość od podstawowego.
      Skala liniowa to pierwiastek sześcienny z 2 (≈1,26), bo objętość rośnie z sześcianem skali.
      Niższe poziomy bez zmian. */
  maxLevelScale: Math.cbrt(2),
  arrow: {
    w: 18,
    h: 14,
    base: PALETTE.green200,
    shade: PALETTE.green600,
    shine: PALETTE.white,
  },
  /** Bomba typu Fat Man w barwie czołgu: bulwiasty korpus, pas równikowy i skrzynkowe stateczniki. */
  cannon: {
    w: 22,
    h: 14,
    base: ENEMY_STYLE.tank.color,
    shade: PALETTE.slate700,
    deep: PALETTE.slate800,
    shine: PALETTE.slate300,
    spark: PALETTE.white,
  },
  frost: {
    w: 16,
    h: 16,
    base: 0xbfdbfe,
    shade: PALETTE.blue300,
    deep: PALETTE.blue400,
    shine: PALETTE.white,
  },
  lightning: {
    /** Zygzak leci dziobem w prawo (oś X), więc tekstura jest szersza niż wyższa. */
    w: 19,
    h: 16,
    base: PALETTE.purple200,
    shade: PALETTE.purple500,
    shine: PALETTE.white,
  },
} as const;

/** Ruch: obrót zgodny z przebytą drogą, wejście z animacją skali. */
export const ENEMY_MOTION = {
  rotationPerPixel: Math.PI / 90,
  spawnScaleFrom: 0.3,
  backEase: 1.70158,
  waypointSnap: 2,
  slowTint: PALETTE.blue300,
} as const;

/** Cień pod wrogiem na planszy i poświata pod ikoną w menu. */
export const ENEMY_SHADOW = {
  game: { blur: 1.1, passes: 3, scale: 1, dy: 1, suffix: '-shadow' },
  menu: { blur: 2, passes: 1, scale: 1.08, dy: 1, suffix: '-glow' },
  color: PALETTE.black,
} as const;

export const HEALTH_BAR = {
  height: 5,
  bg: PALETTE.slate900,
  high: PALETTE.green400,
  mid: PALETTE.amber400,
  low: PALETTE.red500,
  highAbove: 0.5,
  midAbove: 0.25,
  minChange: 0.004,
} as const;

/** Punktacja: maksimum za wieżę poziomu 1, ulepszone dają mniej; fale skalują w górę. */
export const ENEMY_POINTS: Record<EnemyType, number> = { basic: 10, fast: 12, tank: 25, boss: 200, megaboss: 500 };
export const LEVEL_SCORE_FACTOR = [1, 0.5, 0.2];
export const SCORE_WAVE_STEP = 0.15;

/* ----------------------------------- efekty ----------------------------------- */
export const FX = {
  particleCap: 140,
  particleSize: [3, 6],
  particleDistance: [18, 52],
  particleMs: [320, 620],
  denseEnemies: 60,
  busyEnemies: 30,
  denseParticles: 4,
  busyParticles: 6,
  placeParticles: 8,
  upgradeParticles: 10,
  sellParticles: 8,
  explosionRadius: 22,
  frostRadius: 26,
  sparkRadius: 9,
  resistOffsetY: 6,
  lightningSegments: 6,
  lightningJitter: 18,
  lightningMs: 240,
  lightningWidth: 3,
  color: {
    frost: PALETTE.blue300,
    deflect: PALETTE.slate400,
    lightning: PALETTE.purple200,
    explosion: 0xe67e22,
    explosionCore: PALETTE.amber200,
    sell: PALETTE.amber500,
    upgrade: PALETTE.amber200,
  },
  shake: {
    base: { ms: 140, intensity: 0.006 },
    boss: { ms: 400, intensity: 0.012 },
    megaboss: { ms: 900, intensity: 0.02 },
  },
} as const;

/* ----------------------------------- fale ----------------------------------- */
/** Pokrętła balansu (strojone symulatorem rozgrywki). */
export const BALANCE = {
  incomeW1: 40,
  incomeStep: 19,
  waveBonusStep: 2,
  hp: { basic: 60, fast: 45, tank: 150 } as Record<string, number>,
  /** Współczynnik wzrostu HP (×6 na 50. fali). */
  hpGrowth: { basic: 0.02151, fast: 0.02151, tank: 0.02151, boss: 0.02151 } as Record<string, number>,
  /** Krzywa wzrostu: 1 = liniowo, >1 = łagodny początek i ostrzejsza końcówka. */
  hpPower: 1.4,
  bossFirstHp: 500,
  /** Zwykły boss w eskorcie = tyle × boss prowadzący. */
  escortBossMult: 0.7,
  megaHp: 5000,
  /** Od tej fali tylko czołgi i bossowie. */
  finaleStart: 42,
  /** Zmierzona wydajność standardowej obrony (obrażenia na zdobyte złoto). */
  dmgPerGold: 0.111,
  /** Fala trwa ~1,35× dłużej niż okno spawnu + marsz, bo wrogowie giną w drodze. */
  timeFactor: 1.35,
  /** Trudność fali (udział osiągalnej mocy armii) w punktach kotwiczenia. */
  difficultyAnchors: [[1, 0.1], [40, 0.55], [50, 0.85]] as [number, number][],
};

/** UdziaBy skBadu fali: [fala, podstawowy, szybki, czoBg, zwykli bossowie]. */
export const WAVE_SHARE_ANCHORS: [number, number, number, number, number][] = [
  [1, 100, 0, 0, 0],
  [2, 100, 0, 0, 0],
  [3, 82, 18, 0, 0],
  [5, 72, 28, 0, 0],
  [6, 64, 24, 12, 0],
  [9, 56, 28, 16, 0],
  [14, 48, 28, 24, 0],
  [15, 46, 27, 24, 3],
  [25, 38, 26, 26, 10],
  [32, 32, 22, 30, 16],
  [38, 20, 12, 38, 30],
  [41, 6, 4, 50, 40],
  [42, 0, 0, 58, 42],
  [50, 0, 0, 50, 50],
];

/** Wagi złota za zabicie (dzielą wypłatę fali między wrogów). */
export const GOLD_WEIGHT: Record<string, number> = { basic: 10, fast: 12, tank: 30, boss: 120 };

export const WAVE = {
  bossEvery: 10,
  minEnemies: 4,
  /** Wczesne fale (do 12.) mają gwarantowaną liczebność 3 + numer fali, najwyżej 15. */
  earlyMinimumUntil: 12,
  earlyMinimumBase: 3,
  earlyMinimumCap: 15,
  /** Budżet HP: fala 1 = 240 (4 × 60), fala 2 ≥ +22%, do 10. fali ≥ +6%. */
  firstBudget: 240,
  secondGrowth: 1.22,
  rampGrowth: 1.06,
  rampUntil: 10,
  /** Ka|da fala ma co najmniej 102 HP poprzedniej. */
  minGrowth: 1.02,
  /** Fale 1-4 wypuszczają wrogów pojedynczo i wolniej. */
  earlyUntil: 4,
  leaderGoldShare: 0.25,
  escortDelay: 60,
  escortDelayStep: 40,
  modelIterations: 4,
  modelIntervals: [110, 130, 340, 700],
  modelDelayStep: 200,
  groups: {
    basic: { interval: 110, earlyInterval: 240, burst: 2, delay: 0, min: 2 },
    fast: { interval: 130, earlyInterval: 260, burst: 2, delay: 260, min: 1 },
    tank: { interval: 340, earlyInterval: 340, burst: 1, delay: 520, min: 1 },
    boss: { interval: 700, earlyInterval: 700, burst: 1, delay: 1100, min: 1 },
  },
} as const;

/* ----------------------------------- pasek górny gry ----------------------------------- */
/**
 * Promień narożników okna PROMPTERA — wzorzec dla innych zaokrągleń w interfejsie.
 * Ten sam kształt mają przycisk startu w menu i karty broni w dolnym pasku sceny gry.
 */
const PROMPTER_RADIUS = 4;

export const TOP_BAR = {
  row1: 17,
  row2: 42,
  colB: 102,
  coin: { x: 22, scale: 0.9 },
  goldX: 42,
  heartScale: 0.86,
  waveIconScale: 1.05 - 4 / 24,
  iconDx: 8,
  textDx: 22,
  scoreMarkShrink: 4,
  scoreGap: 3,
  button: { w: 36, h: 34, gap: 5 },
  /** Grupa przycisków wyśrodkowana w pasie między prawą krawędzią a PROMPTEREM (12 px odstępu z obu stron). */
  fullscreenX: GAME_W - 30,
  /** Ikona audio w menu: ten sam przycisk co fullscreen, odsunięty o wspólny odstęp. */
  audioX: GAME_W - 30 - (36 + 5),
  pauseBar: { w: 4.5, h: 15, dx: 4 },
  wave: { w: 102, h: 38 },
  prompter: {
    height: 48,
    /** Odstęp PROMPTERA od liczników i od szarych przycisków — równy z marginesem przycisków od prawej krawędzi. */
    sideGap: 12,
    innerPad: 6,
    textGap: 8,
    radius: PROMPTER_RADIUS,
    minWrap: 40,
    textMargin: 8,
    lineSpacing: 3,
    fill: 0x315f37,
    fillAlpha: 0.5,
    stroke: PALETTE.green400,
    strokeWidth: 1,
  },
  speedActiveStroke: PALETTE.green400,
  pausedStroke: PALETTE.amber400,
  pausedStrokeWidth: 1,
} as const;

/* ----------------------------------- pasek dolny gry ----------------------------------- */
export const BOTTOM_BAR = {
  /** Narożniki kart broni — taki sam promień jak w oknie PROMPTERA. */
  radius: PROMPTER_RADIUS,
  button: { w: 160, gap: 16, paddingY: 10, border: 2 },
  icon: { dx: -50, dy: 4, scale: 0.85 },
  name: { dx: -22, dy: -17 },
  coin: { dx: -15, dy: 13, scale: 0.66 },
  cost: { dx: -5, dy: 6 },
  hotkey: { dx: 74, dy: -16, top: 5 },
  /** Najechanie: ramka tylko nieznacznie jaśniejsza i grubsza od stałego obramowania. */
  hoverFrame: { width: 2.2, brighten: 0.1 },
  /** Wybrana broń: ciemniejsze obramowanie od stałego, ale wyraźnie obecne i grubsze od niego. */
  stroke: { selectedWidth: 2.5, width: 2, selected: 1, selectedDarken: 0.15, affordable: 0.4, unaffordable: 0.18 },
  disabledAlpha: 0.45,
} as const;

/* ----------------------------------- panel wieży ----------------------------------- */
export const INFO_PANEL = {
  w: 240,
  h: 116,
  gapX: 28,
  gapY: 18,
  marginX: 8,
  marginY: 6,
  padX: 12,
  depth: { bg: 1, gfx: 4, text: 6 },
  bg: 0x07111e,
  bgAlpha: 0.42,
  strokeWidth: 1.5,
  strokeAlpha: 0.9,
  range: { fillAlpha: 0.16, width: 2.5, alpha: 0.9 },
  headY: 18,
  iconScale: 0.55,
  titleDx: 22,
  closeY: 7,
  statsY: 38,
  effectY: 53,
  targetsY: 69,
  targetsDx: 64,
  targetIcon: 15,
  targetStep: 23,
  weakAlpha: 0.45,
  button: { w: 100, h: 22, gap: 8, bottom: 16, alpha: 0.92, strokeWidth: 1.5, coin: 9, coinGap: 4, priceGap: 3, inner: 8 },
  effect: {
    single: CSS.blue300,
    slow: CSS.blue300,
    chain: CSS.violet300,
    cannon: CSS.orange300,
    arrow: CSS.red300,
  },
  upgrade: { fill: PALETTE.blue700, stroke: PALETTE.blue400, text: CSS.white },
  locked: { fill: PALETTE.slate800, stroke: PALETTE.slate600, text: CSS.slate400 },
  max: { fill: PALETTE.slate800, stroke: PALETTE.slate500, text: CSS.amber400 },
  sell: { fill: PALETTE.red900, stroke: PALETTE.red400, text: CSS.red100 },
} as const;

/** Podgląd stawiania wieży i jej zasięgu. */
export const PLACEMENT = {
  previewAlpha: 0.65,
  invalidTint: 0xff6b6b,
  validColor: PALETTE.green400,
  invalidColor: PALETTE.red500,
  cellFill: 0.25,
  cellStroke: 0.95,
  rangeFill: 0.12,
  rangeStroke: 0.55,
  lineWidth: 1.5,
  spawnScaleFrom: 0.4,
  spawnMs: 200,
  upgradeMs: 240,
} as const;

/* ----------------------------------- menu ----------------------------------- */
export const MENU = {
  stars: { count: 90, radius: [0.6, 1.6], alpha: [0.1, 0.45] },
  boardAlpha: 0.7,
  title: { cy: 124, scale: 1.2, key: 'title-camo' },
  flags: { size: 34, gap: 12, left: 20, inactiveAlpha: 0.75, hoverGrow: 3, texture: 40 },
  weapons: { cardW: 152, cardH: 140, spacing: 168, cy: 276, headerRef: 186, iconY: 244, nameY: 290, statY: 304, effectY: 324, effectMaxW: 138 },
  enemies: { cardW: 138, cardH: 130, spacing: 152, x0: 96, cy: 469, dy: 14, headerY: 384, iconY: 435, nameY: 481, hpY: 494, towersY: 516, towerStep: 24, towerScale: 0.42 },
  /** Ikona broni ma szerokość ikony BOSS (48 × 0,92). */
  weaponIconSize: ENEMY_VIEW.boss.size * ENEMY_VIEW.boss.menuScale,
  /** Narożniki przycisku startu — jak w oknie PROMPTERA. */
  start: { y: 608, w: 210, h: 44, radius: PROMPTER_RADIUS, strokeWidth: 2, strokeAlpha: 0.95, hitPadX: 18, hitPadY: 12, hoverScale: 1.035, hoverMs: 160 },
  footer: {
    mark: '©',
    name: '2026 LUKAMI',
    /** Po[wiata siga najwy|ej 90 wysoko[ci paska. */
    glowHeightShare: 0.9,
    glowRadii: [40, 30, 20, 5],
    glowPadFactor: 1.5,
  },
} as const;

/* ----------------------------------- ekran końcowy ----------------------------------- */
export const END_SCREEN = {
  stars: { count: 140, radius: [0.6, 2], alpha: [0.15, 0.8] },
  titleY: 104,
  descY: 150,
  rows: { y: 196, step: 38, w: 480, h: 36, labelX: 180, valueX: 620, fill: 0x111c2e, stroke: PALETTE.slate700 },
  coinScale: 0.85,
  coinGap: 13,
  rankDy: 48,
  ratingDy: 96,
  hintDy: 62,
  rank: { lifeWeight: 10, goldDivisor: 100, S: 330, A: 250, B: 160 },
  ratingColor: { S: CSS.amber400, A: CSS.green400, B: CSS.blue400, C: CSS.amber500 } as Record<string, string>,
  again: { x: 290, y: 560, w: 250, h: 52 },
  menu: { x: 560, y: 560, w: 200, h: 52 },
  confetti: {
    count: 70,
    colors: [PALETTE.amber400, PALETTE.green400, PALETTE.blue400, PALETTE.purple500, PALETTE.red400],
  },
} as const;
