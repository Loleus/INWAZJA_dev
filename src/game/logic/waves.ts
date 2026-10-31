/* =========================================================================================
   Generator 50 fal:
   - budżet HP fali rośnie gładko, a liczba wrogów wynika z budżetu i składu,
   - HP każdego typu rośnie do końca gry, bez pułapów,
   - fala wypłaca dokładnie `waveIncome(w)` złota,
   - co 10 fal boss prowadzący wchodzi na czele kolumny; na 50. fali MEGA BOSS,
   - wszystkie typy wrogów pozostają w składzie aż do końca.
   Grupy wypuszczają pojedynczych wrogów w równych odstępach.
   ========================================================================================= */
import {
  BALANCE,
  DAMAGE_BY_TYPE,
  DAMAGE_MULT,
  ENEMY_ORDER,
  ENEMY_SPEED,
  ENEMY_VIEW,
  EFFECTIVENESS,
  GOLD_WEIGHT,
  START_GOLD,
  TOTAL_WAVES,
  TOWER_ORDER,
  TOWER_STATS,
  WAVE,
} from '../constants';
import type { EnemyType, MenuEnemy, Wave, WaveGroup } from '../types';
import { PATHS, pathLengthToBase } from './board';

type Shares = { basic: number; fast: number; tank: number; boss: number };
type GroupType = keyof typeof WAVE.groups;

const SHORTEST_PATH_LEN = Math.min(...PATHS.map(pathLengthToBase));

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

/** Skład faworyzuje wytrzymałe cele i uwzględnia DPS oraz czas potrzebny na ich ostrzał. */
function enemyShares(w: number): Shares {
  const weights = {} as Shares;
  let total = 0;
  for (const type of Object.keys(WAVE.groups) as GroupType[]) {
    if (w < BALANCE.enemyStartWave[type]) {
      weights[type] = 0;
      continue;
    }
    let bestDps = 0;
    for (const tower of TOWER_ORDER) {
      if (!EFFECTIVENESS[type][tower]) continue;
      const stats = TOWER_STATS[tower][0];
      bestDps = Math.max(
        bestDps,
        (stats.damage * (DAMAGE_MULT[type]?.[tower] ?? 1)) / stats.fireRate,
      );
    }
    const hp = enemyHpAtWave(type, w);
    const speed = ENEMY_SPEED[type];
    const weight = Math.sqrt(hp) / (bestDps * Math.sqrt(speed));
    weights[type] = weight;
    total += weight;
  }
  if (total > 0) {
    for (const type of Object.keys(weights) as GroupType[]) weights[type] /= total;
  }
  return weights;
}

/** Złoto gracza po fali `w`: start + wypłaty fal + premie za ukończenie. */
function goldAfterWave(w: number): number {
  let gold = START_GOLD;
  for (let i = 1; i <= w; i++) gold += waveIncome(i) + waveBonus(i);
  return gold;
}

function averageEnemyHp(w: number): number {
  const shares = enemyShares(w);
  return (
    shares.basic * enemyHpAtWave('basic', w) +
    shares.fast * enemyHpAtWave('fast', w) +
    shares.tank * enemyHpAtWave('tank', w) +
    shares.boss * enemyHpAtWave('boss', w)
  );
}

function averageEnemyTravelTime(w: number): number {
  const shares = enemyShares(w);
  const total = shares.basic + shares.fast + shares.tank + shares.boss;
  if (total <= 0) return SHORTEST_PATH_LEN / ENEMY_SPEED.basic;
  return (
    (SHORTEST_PATH_LEN *
      (shares.basic / ENEMY_SPEED.basic +
        shares.fast / ENEMY_SPEED.fast +
        shares.tank / ENEMY_SPEED.tank +
        shares.boss / ENEMY_SPEED.boss)) /
    total
  );
}

/**
 * Budżet HP fali z ekonomii i realiów broni:
 *   budżet = wymagana trudność × (DMG na złoto) × (złoto gracza) × (czas fali).
 * Okno spawnu zależy od liczby wrogów i indywidualnych odstępów ich grup, a liczba
 * wrogów od budżetu — rozwiązanie iteracyjne z uśrednianiem kolejnych kroków.
 */
function waveHpBudgetModel(w: number): number {
  const leaderHp = leaderHpAt(w);
  const avgHp = averageEnemyHp(w);
  const travel = averageEnemyTravelTime(w);
  const capacityPerSecond = BALANCE.dmgPerGold * goldAfterWave(w);
  const difficulty = interpolate(BALANCE.difficultyAnchors, w);
  const shares = enemyShares(w);

  let count = Math.max(
    WAVE.minEnemies,
    Math.round((capacityPerSecond * (travel * BALANCE.timeFactor) * difficulty) / Math.max(1, avgHp)),
  );
  let budget = count * avgHp + leaderHp;
  const types: GroupType[] = ['basic', 'fast', 'tank', 'boss'];
  const early = w <= WAVE.earlyUntil;
  for (let i = 0; i < WAVE.modelIterations; i++) {
    let spawnWindow = 0;
    for (const type of types) {
      const params = WAVE.groups[type];
      if (w < BALANCE.enemyStartWave[type]) continue;
      const share = shares[type];
      const groupCount = Math.max(params.min, Math.round(count * share));
      const interval = early ? params.earlyInterval : params.interval;
      spawnWindow = Math.max(spawnWindow, params.delay + Math.max(0, groupCount - 1) * interval);
    }
    if (leaderHp > 0) {
      const boss = WAVE.groups.boss;
      const bossCount = Math.max(boss.min, Math.round(count * shares.boss));
      spawnWindow = Math.max(
        spawnWindow,
        boss.delay + bossCount * (early ? boss.earlyInterval : boss.interval),
      );
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

function buildWave(w: number, previousCounts: Record<EnemyType, number>): Wave {
  const groups: WaveGroup[] = [];
  const early = w <= WAVE.earlyUntil;
  const shares = enemyShares(w);
  const bossStart = BALANCE.enemyStartWave.boss;
  const bossCountLocked = w > bossStart && (w - bossStart) % 5 !== 0;
  if (bossCountLocked) {
    const nonBossShare = shares.basic + shares.fast + shares.tank;
    shares.basic /= nonBossShare;
    shares.fast /= nonBossShare;
    shares.tank /= nonBossShare;
    shares.boss = 0;
  }
  const leaderHp = leaderHpAt(w);
  const total = waveEnemyTotal(w, leaderHp);

  const add = (type: GroupType, share: number) => {
    const params = WAVE.groups[type];
    const previousCount = previousCounts[type];
    const targetCount = Math.max(params.min, previousCount, Math.round(total * share));
    const introCap = type === 'basic' ? targetCount : w - BALANCE.enemyStartWave[type] + 1;
    const count = Math.max(params.min, Math.min(targetCount, introCap));
    const escortCount = type === 'boss' && leaderHp > 0 ? Math.max(0, count - 1) : count;
    if (escortCount < 1) return;
    groups.push({
      config: { type, hp: enemyHpAtWave(type, w), speed: ENEMY_SPEED[type], gold: 1, damage: DAMAGE_BY_TYPE[type] },
      count: escortCount,
      interval: early ? params.earlyInterval : params.interval,
      burst: early ? 1 : params.burst,
      delay: params.delay,
    });
  };

  for (const type of Object.keys(WAVE.groups) as GroupType[]) {
    if (w >= BALANCE.enemyStartWave[type] || previousCounts[type] > 0) add(type, shares[type]);
  }

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
    const type: EnemyType = isMega ? 'megaboss' : 'boss';
    const bossEscorts = groups.find((group) => group.config.type === 'boss');
    const delay = WAVE.groups.boss.delay + (bossEscorts?.count ?? 0) * WAVE.groups.boss.interval;
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
      delay,
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
  const previousCounts: Record<EnemyType, number> = {
    basic: 0,
    fast: 0,
    tank: 0,
    boss: 0,
    megaboss: 0,
  };
  let previousHp = 0;
  for (let w = 1; w <= TOTAL_WAVES; w++) {
    const wave = buildWave(w, previousCounts);
    let totalHp = waveTotalHp(wave);
    const minimum = Math.round(previousHp * WAVE.minGrowth);
    const basic = wave.groups.find((g) => g.config.type === 'basic');
    if (totalHp < minimum && basic && basic.config.hp > 0) {
      basic.count += Math.ceil((minimum - totalHp) / basic.config.hp);
      totalHp = waveTotalHp(wave);
    }
    for (const type of ENEMY_ORDER) previousCounts[type] = 0;
    for (const group of wave.groups) {
      previousCounts[group.config.type] += group.count;
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
