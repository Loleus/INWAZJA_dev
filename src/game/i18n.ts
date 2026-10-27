/* =========================================================================================
   Słownik gry: polski (domyślny) i angielski. Język wybiera się flagami w menu;
   wybór jest zapamiętywany w localStorage i stosowany we wszystkich scenach.
   ========================================================================================= */

import type { EnemyType, TowerType } from './types';

export type Lang = 'pl' | 'en';

const STORAGE_KEY = 'obrona-bazy-lang';

function readStored(): Lang {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return v === 'en' ? 'en' : 'pl';
  } catch {
    return 'pl';
  }
}

let current: Lang = readStored();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* brak localStorage (np. tryb prywatny) — język działa do odświeżenia */
  }
  applyDocumentLang();
}

/** Tytuł karty przeglądarki i atrybut lang dokumentu zgodne z wybranym językiem. */
function applyDocumentLang() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = current;
  document.title = DICT[current].title + ' — tower defense';
}

const DICT = {
  pl: {
    // menu
    title: 'INWAZJA',
    weaponsHeader: 'ARSENAŁ',
    enemiesHeader: 'PRZECIWNICY',
    range: 'zasięg',
    startButton: 'ROZPOCZNIJ OBRONĘ',
    // wieże
    towerArrow: 'Strzała',
    towerCannon: 'Armata',
    towerFrost: 'Mróz',
    towerLightning: 'Błyskawica',
    effectArrow: 'pojedynczy cel',
    effectCannon: 'mocny · bez szybkich',
    effectFrost: 'spowalnia wroga',
    effectLightning: 'łańcuch 3 · bez czołgów',
    // wrogowie
    enemyBasic: 'PODSTAWOWY',
    enemyFast: 'SZYBKI',
    enemyTank: 'CZOŁG',
    enemyBoss: 'BOSS',
    enemyMegaboss: 'MEGA BOSS',
    tank: 'czołg',
    bossMega: 'boss/mega',
    noFast: 'bez szybkich',
    noTank: 'bez czołgów',
    // HUD
    wave: 'FALA ▸',
    scoreMark: 'P',
    shortcuts: 'Aktywna walka: buduj i ulepszaj w trakcie fali · 1-4 wieże · U ulepsz · S sprzedaj · F tempo · P pauza',
    intro: 'Gotowość bojowa: buduj, ulepszaj i sprzedawaj także w trakcie trwania fali! (FALA ▸ lub SPACJA)',
    nextWaveHover: '{lane}Fala {n}: {count} wrogów ({details}) · {lanes} drogi: {split}',
    laneA: 'A (środkowa)',
    laneB: 'B (dolna)',
    laneC: 'C (górna)',
    noGoldTower: 'BRAK ZŁOTA (WIEŻA: {cost} 🪙)',
    noGoldUpgrade: 'BRAK ZŁOTA (ULEPSZENIE: {cost} 🪙)',
    cannotBuild: 'NIE MOŻNA TU BUDOWAĆ',
    sold: 'Sprzedano wieżę · +{refund} 🪙',
    waveRunning: 'FALA JUŻ TRWA',
    waveLocked: 'POCZEKAJ NA KONIEC FALI',
    waveStart: 'Fala {n}/{total} · {count} wrogów',
    waveDone: 'Fala {n} OK · +{bonus} 🪙',
    bossKilled: 'BOSS pokonany · +{gold} 🪙 · +{points} pkt',
    megaKilled: 'MEGA BOSS pokonany · +{gold} 🪙 · +{points} pkt',
    bossInBase: '{boss} w bazie: -{dmg} życia',
    enemyInBase: 'WRÓG W BAZIE ❤ -{dmg}',
    // podpowiedź po najechaniu na wieżę
    hoverLevel: 'poziom',
    hoverEvery: 'co',
    hoverUpgrade: 'ulepszenie: {cost} 🪙 (klik lub U)',
    hoverMax: 'maks. poziom · sprzedaż zwraca 60%',
    // panel wieży
    level: 'POZIOM',
    slow: 'spowolnienie',
    chain: 'łańcuch',
    singleTarget: 'pojedynczy cel',
    worksOn: 'działa na:',
    upgradeBtn: 'ULEPSZ [U]',
    maxLevel: 'MAKS. POZIOM',
    sellBtn: 'SPRZEDAJ [S]',
    // ekran końcowy
    victory: 'ZWYCIĘSTWO!',
    defeat: 'BAZA UPADŁA',
    victoryDesc: 'Odpierałeś ataki przez wszystkie 50 fal i pokonałeś MEGA BOSSA.',
    defeatDesc: 'Wrogowie przedarli się do bazy. Raport z kampanii:',
    livesLeft: 'Pozostałe życia',
    goldLeft: 'Pozostałe złoto',
    kills: 'Zestrzeleni wrogowie',
    score: 'Punkty',
    rank: 'RANGA KAMPANII (życia + złoto = {pts} pkt)',
    hint: 'Wskazówka: mieszaj typy wież i ulepszaj je do 3. poziomu przed falami bossów.',
    playAgain: 'ZAGRAJ PONOWNIE',
    mainMenu: 'MENU GŁÓWNE',
  },
  en: {
    title: 'INVASION',
    weaponsHeader: 'ARSENAL',
    enemiesHeader: 'ENEMIES',
    range: 'range',
    startButton: 'START DEFENSE',
    towerArrow: 'Arrow',
    towerCannon: 'Cannon',
    towerFrost: 'Frost',
    towerLightning: 'Lightning',
    effectArrow: 'single target',
    effectCannon: 'heavy · not vs fast',
    effectFrost: 'slows enemies',
    effectLightning: 'chain 3 · not vs tanks',
    enemyBasic: 'BASIC',
    enemyFast: 'FAST',
    enemyTank: 'TANK',
    enemyBoss: 'BOSS',
    enemyMegaboss: 'MEGA BOSS',
    tank: 'tank',
    bossMega: 'boss/mega',
    noFast: 'not vs fast',
    noTank: 'not vs tanks',
    wave: 'WAVE ▸',
    scoreMark: 'S',
    shortcuts: 'Active combat: build & upgrade during waves · 1-4 towers · U upgrade · S sell · F speed · P pause',
    intro: 'Combat ready: build, upgrade, and sell anytime during active waves! (WAVE ▸ or SPACE)',
    nextWaveHover: '{lane}Wave {n}: {count} enemies ({details}) · {lanes} lanes: {split}',
    laneA: 'A (mid)',
    laneB: 'B (bottom)',
    laneC: 'C (top)',
    noGoldTower: 'NOT ENOUGH GOLD (TOWER: {cost} 🪙)',
    noGoldUpgrade: 'NOT ENOUGH GOLD (UPGRADE: {cost} 🪙)',
    cannotBuild: 'CANNOT BUILD HERE',
    sold: 'Tower sold · +{refund} 🪙',
    waveRunning: 'WAVE ALREADY IN PROGRESS',
    waveLocked: 'WAIT FOR THE WAVE TO END',
    waveStart: 'Wave {n}/{total} · {count} enemies',
    waveDone: 'Wave {n} cleared · +{bonus} 🪙',
    bossKilled: 'BOSS defeated · +{gold} 🪙 · +{points} pts',
    megaKilled: 'MEGA BOSS defeated · +{gold} 🪙 · +{points} pts',
    bossInBase: '{boss} reached the base: -{dmg} lives',
    enemyInBase: 'ENEMY IN THE BASE ❤ -{dmg}',
    hoverLevel: 'level',
    hoverEvery: 'shot every',
    hoverUpgrade: 'upgrade: {cost} 🪙 (click or U)',
    hoverMax: 'max level · selling returns 60%',
    level: 'LEVEL',
    slow: 'slow',
    chain: 'chain',
    singleTarget: 'single target',
    worksOn: 'Targets:',
    upgradeBtn: 'UPGRADE [U]',
    maxLevel: 'MAX LEVEL',
    sellBtn: 'SELL [S]',
    victory: 'VICTORY!',
    defeat: 'BASE HAS FALLEN',
    victoryDesc: 'You held off all 50 waves and defeated the MEGA BOSS.',
    defeatDesc: 'Enemies broke through to the base. Campaign report:',
    livesLeft: 'Lives left',
    goldLeft: 'Gold left',
    kills: 'Enemies destroyed',
    score: 'Score',
    rank: 'CAMPAIGN RANK (lives + gold = {pts} pts)',
    hint: 'Tip: mix tower types and upgrade them to level 3 before boss waves.',
    playAgain: 'PLAY AGAIN',
    mainMenu: 'MAIN MENU',
  },
} as const;

type TextKey = keyof (typeof DICT)['pl'];

// tytuł karty i atrybut lang zgodne z językiem zapamiętanym z poprzedniej sesji
applyDocumentLang();

/** Tłumaczenie z opcjonalnym podstawieniem {nazwa} → wartość. */
export function t(key: TextKey, vars?: Record<string, string | number>): string {
  let s: string = DICT[current][key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
  }
  return s;
}

export function towerName(type: TowerType): string {
  const map: Record<TowerType, TextKey> = {
    arrow: 'towerArrow',
    cannon: 'towerCannon',
    frost: 'towerFrost',
    lightning: 'towerLightning',
  };
  return t(map[type]);
}

export function towerEffect(type: TowerType): string {
  const map: Record<TowerType, TextKey> = {
    arrow: 'effectArrow',
    cannon: 'effectCannon',
    frost: 'effectFrost',
    lightning: 'effectLightning',
  };
  return t(map[type]);
}

export function enemyName(type: EnemyType): string {
  const map: Record<EnemyType, TextKey> = {
    basic: 'enemyBasic',
    fast: 'enemyFast',
    tank: 'enemyTank',
    boss: 'enemyBoss',
    megaboss: 'enemyMegaboss',
  };
  return t(map[type]);
}
