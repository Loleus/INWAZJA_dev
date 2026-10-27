/* =========================================================================================
   Generator 50 fal:
   - budżet HP fali rośnie gładko, a liczba wrogów wynika z budżetu i składu,
   - HP każdego typu rośnie do końca gry, bez pułapów,
   - fala wypłaca dokładnie `waveIncome(w)` złota,
   - co 10 fal boss prowadzący wchodzi na czele kolumny; na 50. fali MEGA BOSS,
   - od fali 42 (finał) wyłącznie czołgi i bossowie.
   Grupy startują równolegle i wypuszczają wrogów seriami (burst), więc fale się mieszają.
   ========================================================================================= */
import {
  BALANCE,
  DAMAGE_BY_TYPE,
  ENEMY_ORDER,
  ENEMY_SPEED,
  ENEMY_VIEW,
  GOLD_WEIGHT,
  START_GOLD,
  TOTAL_WAVES,
  WAVE,
  WAVE_SHARE_ANCHORS,
} from '../constants';
import type { EnemyType, MenuEnemy, Wave, WaveGroup } from '../types';
import { PATHS } from './board';

type Shares = { basic: number; fast: number; tank: number; boss: number };
type GroupType = keyof typeof WAVE.groups;

const AVG_PATH_LEN = PATHS.reduce((sum, p) => sum + p.length, 0) / PATHS.length;

function waveIncome(w: number): number {
  return BALANCE.incomeW1 + BALANCE.incomeStep * (w - 1);
}

function waveBonus(w: number): number {
  return Math.round(BALANCE.waveBonusStep * (w - 1));
}

/** HP bossa prowadzącego falę — 500 na 10. fali, potem wzrost. */
function bossLeaderHp(w: number): number {
  const base =
    BALANCE.bossFirstHp *
    (1 + BALANCE.hpGrowth.boss * Math.pow(Math.max(w, WAVE.bossEvery) - WAVE.bossEvery, BALANCE.hpPower));
  return Math.round(base / 50) * 50;
}

function leaderHpAt(w: number): number {
  if (w % WAVE.bossEvery !== 0) return 0;
  return w === TOTAL_WAVES ? BALANCE.megaHp : bossLeaderHp(w);
}

function enemyHpAtWave(type: EnemyType, w: number): number {
  if (type === 'boss') return Math.round((BALANCE.escortBossMult * bossLeaderHp(w)) / 10) * 10;
  const start = BALANCE.hp[type] ?? BALANCE.hp.basic;
  return Math.round(start * (1 + BALANCE.hpGrowth[type] * Math.pow(w - 1, BALANCE.hpPower)));
}

/** Interpolacja liniowa między punktami kotwiczenia [x, y]. */
function interpolate(anchors: [number, number][], x: number): number {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [ax, ay] = anchors[i];
    const [bx, by] = anchors[i + 1];
    if (x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax);
  }
  return anchors[anchors.length - 1][1];
}

function waveShares(w: number): Shares {
  const column = (index: number) =>
    interpolate(WAVE_SHARE_ANCHORS.map((a) => [a[0], a[index]] as [number, number]), w);
  return { basic: column(1), fast: column(2), tank: column(3), boss: column(4) };
}

/** Złoto gracza po fali `w`: start + wypłaty fal + premie za ukończenie. */
function goldAfterWave(w: number): number {
  let gold = START_GOLD;
  for (let i = 1; i <= w; i++) gold += waveIncome(i) + waveBonus(i);
  return gold;
}

function averageEnemyHp(w: number): number {
  const sh = waveShares(w);
  return (
    (sh.basic * enemyHpAtWave('basic', w) +
      sh.fast * enemyHpAtWave('fast', w) +
      sh.tank * enemyHpAtWave('tank', w) +
      sh.boss * enemyHpAtWave('boss', w)) /
    100
  );
}

function averageEnemySpeed(w: number): number {
  const sh = waveShares(w);
  const total = sh.basic + sh.fast + sh.tank + sh.boss;
  if (total <= 0) return ENEMY_SPEED.basic;
  return (
    (sh.basic * ENEMY_SPEED.basic + sh.fast * ENEMY_SPEED.fast + sh.tank * ENEMY_SPEED.tank + sh.boss * ENEMY_SPEED.boss) /
    total
  );
}

/**
 * Budżet HP fali z ekonomii i realiów broni:
 *   budżet = wymagana trudność × (DMG na złoto) × (złoto gracza) × (czas fali).
 * Okno spawnu zależy od liczby wrogów, a liczba wrogów od budżetu — rozwiązanie iteracyjne
 * z uśrednianiem kolejnych kroków.
 */
function waveHpBudgetModel(w: number): number {
  const leaderHp = leaderHpAt(w);
  const avgHp = averageEnemyHp(w);
  const travel = AVG_PATH_LEN / Math.max(1, averageEnemySpeed(w));
  const capacityPerSecond = BALANCE.dmgPerGold * goldAfterWave(w);
  const difficulty = interpolate(BALANCE.difficultyAnchors, w);

  let count = Math.max(
    WAVE.minEnemies,
    Math.round((capacityPerSecond * (travel * BALANCE.timeFactor) * difficulty) / Math.max(1, avgHp)),
  );
  let budget = count * avgHp + leaderHp;
  const groups = WAVE.modelIntervals.length;
  for (let i = 0; i < WAVE.modelIterations; i++) {
    let spawnWindow = 0;
    for (let g = 0; g < groups; g++) {
      spawnWindow = Math.max(spawnWindow, g * WAVE.modelDelayStep + (count / groups / 2) * WAVE.modelIntervals[g]);
    }
    const duration = (spawnWindow / 1000 + travel) * BALANCE.timeFactor;
    const nextCount = Math.max(
      WAVE.minEnemies,
      Math.round((difficulty * capacityPerSecond * duration - leaderHp) / Math.max(1, avgHp)),
    );
    const blended = Math.round((count + nextCount) / 2);
    if (blended === count) break;
    count = blended;
    budget = count * avgHp + leaderHp;
  }
  return Math.max(avgHp * WAVE.minEnemies + leaderHp, budget);
}

/** Budżety fal: model ekonomii z gwarantowanym wzrostem na początku kampanii. */
const WAVE_BUDGETS: number[] = (() => {
  const budgets: number[] = [];
  let previous = 0;
  for (let w = 1; w <= TOTAL_WAVES; w++) {
    const model = waveHpBudgetModel(w);
    let value = model;
    if (w === 1) value = WAVE.firstBudget;
    else if (w === 2) value = Math.max(model, previous * WAVE.secondGrowth);
    else if (w <= WAVE.rampUntil) value = Math.max(model, previous * WAVE.rampGrowth);
    value = Math.max(value, previous, model);
    budgets.push(Math.round(value));
    previous = value;
  }
  return budgets;
})();

function waveHpBudget(w: number): number {
  return WAVE_BUDGETS[Math.min(TOTAL_WAVES, Math.max(1, Math.round(w))) - 1];
}

function waveEnemyTotal(w: number, leaderHp: number): number {
  const fromBudget = Math.max(WAVE.minEnemies, Math.round((waveHpBudget(w) - leaderHp) / averageEnemyHp(w)));
  const earlyMinimum = w <= WAVE.earlyMinimumUntil ? WAVE.earlyMinimumBase + w : 0;
  return Math.max(WAVE.minEnemies, fromBudget, Math.min(earlyMinimum, WAVE.earlyMinimumCap));
}

/** HP bossa z fali 10 i MEGA BOSSA z fali 50 — pokazywane w menu. */
let bossHpWave10 = 0;
let megaBossHp = 0;

function buildWave(w: number): Wave {
  const groups: WaveGroup[] = [];
  const early = w <= WAVE.earlyUntil;
  const shares = waveShares(w);
  const leaderHp = leaderHpAt(w);
  const total = waveEnemyTotal(w, leaderHp);

  const add = (type: GroupType, share: number) => {
    const params = WAVE.groups[type];
    const count = Math.max(params.min, Math.round((total * share) / 100));
    if (count < 1) return;
    groups.push({
      config: { type, hp: enemyHpAtWave(type, w), speed: ENEMY_SPEED[type], gold: 1, damage: DAMAGE_BY_TYPE[type] },
      count,
      interval: early ? params.earlyInterval : params.interval,
      burst: early ? 1 : params.burst,
      delay: params.delay,
    });
  };

  if (w < BALANCE.finaleStart) {
    add('basic', shares.basic);
    if (shares.fast > 0.5) add('fast', shares.fast);
  }
  if (shares.tank > 0.5) add('tank', shares.tank);
  if (shares.boss > 0.5) add('boss', shares.boss);

  const bonus = waveBonus(w);
  const killBudget = Math.max(1, waveIncome(w) - bonus);
  const weightSum = groups.reduce((sum, g) => sum + g.count * GOLD_WEIGHT[g.config.type], 0);
  for (const g of groups) {
    g.config.gold = Math.max(1, Math.round((killBudget * GOLD_WEIGHT[g.config.type]) / weightSum));
  }

  if (leaderHp > 0) {
    const isMega = w === TOTAL_WAVES;
    if (w === WAVE.bossEvery) bossHpWave10 = leaderHp;
    if (isMega) megaBossHp = leaderHp;
    groups.forEach((g, gi) => {
      g.delay = WAVE.escortDelay + gi * WAVE.escortDelayStep;
    });
    const type: EnemyType = isMega ? 'megaboss' : 'boss';
    groups.push({
      config: {
        type,
        hp: leaderHp,
        speed: ENEMY_SPEED.boss,
        gold: Math.round(killBudget * WAVE.leaderGoldShare),
        damage: DAMAGE_BY_TYPE[type],
      },
      count: 1,
      interval: 1000,
      burst: 1,
      delay: 0,
    });
  }

  return { number: w, groups, bonus };
}

function waveTotalHp(wave: Wave): number {
  return wave.groups.reduce((sum, g) => sum + g.count * g.config.hp, 0);
}

/** Komplet fal; żadna fala nie jest słabsza od poprzedniej (+2%). */
function buildAllWaves(): Wave[] {
  const waves: Wave[] = [];
  let previousHp = 0;
  for (let w = 1; w <= TOTAL_WAVES; w++) {
    const wave = buildWave(w);
    let totalHp = waveTotalHp(wave);
    const minimum = Math.round(previousHp * WAVE.minGrowth);
    const basic = wave.groups.find((g) => g.config.type === 'basic');
    if (totalHp < minimum && basic && basic.config.hp > 0) {
      basic.count += Math.ceil((minimum - totalHp) / basic.config.hp);
      totalHp = waveTotalHp(wave);
    }
    previousHp = totalHp;
    waves.push(wave);
  }
  return waves;
}

let wavesCache: Wave[] | null = null;

/** Fale są deterministyczne — budowane raz i trzymane w pamięci. */
export function makeWaves(): Wave[] {
  if (!wavesCache) wavesCache = buildAllWaves();
  return wavesCache;
}

export function waveHasBoss(wave: Wave): EnemyType | null {
  for (const g of wave.groups) {
    if (g.config.type === 'boss' || g.config.type === 'megaboss') return g.config.type;
  }
  return null;
}

function formatHp(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' HP';
}

/** Opisy wrogów na ekran tytułowy (HP zgodne z generatorem fal). */
export function menuEnemies(): MenuEnemy[] {
  makeWaves();
  const hp: Record<EnemyType, number> = {
    basic: BALANCE.hp.basic,
    fast: BALANCE.hp.fast,
    tank: BALANCE.hp.tank,
    boss: bossHpWave10,
    megaboss: megaBossHp,
  };
  return ENEMY_ORDER.map((type) => ({ type, hp: formatHp(hp[type]), scale: ENEMY_VIEW[type].menuScale }));
}
