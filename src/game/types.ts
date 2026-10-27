export type TowerType = 'arrow' | 'cannon' | 'frost' | 'lightning';
export type EnemyType = 'basic' | 'fast' | 'tank' | 'boss' | 'megaboss';

export interface Point {
  x: number;
  y: number;
}

export interface TowerLevelStats {
  damage: number;
  range: number;
  /** Odstęp między strzałami (ms). */
  fireRate: number;
  /** Ułamek spowolnienia (0..1). */
  slow: number;
  /** Czas spowolnienia (ms). */
  slowDuration: number;
  /** Liczba celów w łańcuchu błyskawicy. */
  chain: number;
  /** Obrażenia kolejnych ogniw łańcucha. */
  chainDamage: number[];
  cost: number;
  upgradeCost: number;
}

export interface LanePath {
  id: string;
  points: Point[];
  length: number;
}

export interface EnemyConfig {
  type: EnemyType;
  hp: number;
  speed: number;
  gold: number;
  damage: number;
}

export interface WaveGroup {
  config: EnemyConfig;
  count: number;
  interval: number;
  burst: number;
  delay: number;
}

export interface Wave {
  number: number;
  groups: WaveGroup[];
  bonus: number;
}

export interface MenuEnemy {
  type: EnemyType;
  hp: string;
  scale: number;
}

export interface EndGameData {
  won: boolean;
  waves: number;
  kills: number;
  goldEarned: number;
  score: number;
  gold: number;
  lives: number;
}
