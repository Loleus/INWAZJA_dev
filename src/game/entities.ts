import Phaser from 'phaser';
import type { EnemyConfig, LanePath, TowerType } from './types';

export interface Tower {
  type: TowerType;
  level: number;
  col: number;
  row: number;
  sprite: Phaser.GameObjects.Image;
  /** Głowica obrócona w jeden z 8 bazowych kierunków; nie bierze udziału w mechanice. */
  head: Phaser.GameObjects.Image;
  headAngle: number;
  headFrom: number;
  headTo: number;
  headStartAt: number;
  headEndAt: number;
  lastFired: number;
  invested: number;
  homeX: number;
  homeY: number;
  /** Odrzut po strzale: kierunek (px) i czas gry, do którego trwa. */
  recoilDx: number;
  recoilDy: number;
  recoilUntil: number;
}

export interface Enemy {
  config: EnemyConfig;
  hp: number;
  maxHp: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Rectangle;
  barBg: Phaser.GameObjects.Rectangle;
  barW: number;
  barOffset: number;
  path: LanePath;
  pathIndex: number;
  x: number;
  y: number;
  baseSpeed: number;
  travelled: number;
  remaining: number;
  slowTimer: number;
  slowFactor: number;
  alive: boolean;
  onBoard: boolean;
  damage: number;
  lastResistFx: number;
  barPct: number;
  tinted: boolean;
  targetScale: number;
  spawnT: number;
}

/** Efekt z puli: interpolacja pozycji, skali i alfy liczona ręcznie w updateFx. */
export interface Fx {
  kind: 'rect' | 'circle';
  obj: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
  t: number;
  dur: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
  /** 0 = liniowo, 1 = Cubic.easeOut. */
  ease: number;
}

export interface Projectile {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  targetEnemy: Enemy;
  speed: number;
  towerType: TowerType;
  towerLevel: number;
  damage: number;
  slow: number;
  slowDuration: number;
  chain: number;
  chainDamage: number[];
  alive: boolean;
}

export interface SpawnEntry {
  config: EnemyConfig;
  pathId: string;
  at: number;
}
