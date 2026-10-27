import { DAMAGE_MULT, EFFECTIVENESS, ENEMY_SPEED } from '../constants';
import type { EnemyType, TowerLevelStats, TowerType } from '../types';

export function canAffect(towerType: TowerType, enemyType: EnemyType): boolean {
  return EFFECTIVENESS[enemyType][towerType];
}

export function damageFactor(towerType: TowerType, enemyType: EnemyType): number {
  return DAMAGE_MULT[enemyType]?.[towerType] ?? 1;
}

export function isBossType(type: EnemyType): boolean {
  return type === 'boss' || type === 'megaboss';
}

export function damageLabel(stats: TowerLevelStats): string {
  return `${Math.round(stats.damage * 10) / 10} DMG`;
}

/** Minimalny opis kandydata na cel — spełnia go obiekt wroga ze sceny gry (bez alokacji). */
export interface TargetCandidate {
  hp: number;
  slowFactor: number;
  remaining: number;
  config: { type: EnemyType };
}

/**
 * Priorytet celu, taki sam dla całej broni:
 *   1. najniższe aktualne HP,
 *   2. przy równym HP — szybszy wróg (spowolnienie obniża prędkość),
 *   3. remis — wróg najbliżej bazy.
 */
export function isBetterTarget(a: TargetCandidate, b: TargetCandidate): boolean {
  if (a.hp !== b.hp) return a.hp < b.hp;
  const sa = ENEMY_SPEED[a.config.type] * (1 - a.slowFactor);
  const sb = ENEMY_SPEED[b.config.type] * (1 - b.slowFactor);
  if (Math.abs(sa - sb) > 1e-9) return sa > sb;
  return a.remaining < b.remaining;
}
