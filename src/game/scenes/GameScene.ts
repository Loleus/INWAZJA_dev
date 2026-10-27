import Phaser from 'phaser';
import { gameAudio } from '../audio';
import {
  BOARD_CY,
  BOARD_H,
  CELL,
  CENTER_X,
  COLS,
  COMBAT,
  DEPTH,
  ENEMY_MOTION,
  ENEMY_ORDER,
  ENEMY_POINTS,
  ENEMY_SHADOW,
  ENEMY_STYLE,
  ENEMY_VIEW,
  FX,
  GAME_W,
  HEALTH_BAR,
  LANES,
  LEVEL_SCORE_FACTOR,
  MAX_TOWER_LEVEL,
  OVERLAY,
  PALETTE,
  PLACEMENT,
  PROJECTILE,
  PROJECTILE_SPEED,
  ROWS,
  SCORE_WAVE_STEP,
  SELL_FACTOR,
  SPEEDS,
  START_GOLD,
  START_LIVES,
  STATUS_HOLD,
  TIMING,
  TOTAL_WAVES,
  TURRET,
  TURRET_ANGLE_STEP,
  TURRET_STEP_MS,
  TOWER_INFO,
  TOWER_ORDER,
  TOWER_SCALE,
  TOWER_STATS,
  WORLD_Y,
} from '../constants';
import type { Enemy, Fx, Projectile, SpawnEntry, Tower } from '../entities';
import { towerBodyKey, towerHeadKey, towerSpriteKey } from '../gfx/sprites';
import { makeIconShadowTexture } from '../gfx/surfaces';
import { enemyName, t, towerName } from '../i18n';
import {
  cellCenter,
  getPathById,
  isAdjacentToPath,
  isInsideGrid,
  isPath,
  laneEntryArrowAt,
  onBoard,
  pointerCell,
  pointerOnBoard,
} from '../logic/board';
import { canAffect, damageFactor, damageLabel, isBetterTarget, isBossType } from '../logic/combat';
import { makeWaves, waveHasBoss } from '../logic/waves';
import type { EnemyConfig, EnemyType, LanePath, TowerLevelStats, TowerType, Wave } from '../types';
import { drawExitArrows, drawLaneArrows, drawMap } from '../ui/board';
import { toggleFullscreen } from '../ui/common';
import { GameBottomBar } from '../ui/game/GameBottomBar';
import { GameTopBar } from '../ui/game/GameTopBar';
import { TowerInfoPanel } from '../ui/game/TowerInfoPanel';

/* =========================================================================================
   Scena gry: pasek górny (liczniki, PROMPTER z przyciskiem FALA, sterowanie), plansza 32×24
   i pasek dolny z kartami broni. Cała komunikacja z graczem idzie przez PROMPTER.
   ========================================================================================= */
export class GameScene extends Phaser.Scene {
  private waves: Wave[] = [];
  private waveNumber = 0;
  private waveActive = false;
  private gold = START_GOLD;
  private lives = START_LIVES;
  private score = 0;
  private kills = 0;
  private goldEarned = 0;
  private clock = 0;
  private gameSpeed = 1;
  private speedIndex = 0;
  private paused = false;
  private gameEnded = false;
  private finished = false;

  private towers: Tower[] = [];
  private gridTowers: (Tower | null)[][] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private spawnQueue: SpawnEntry[] = [];
  private spawnCursor = 0;
  private enemiesAliveInWave = 0;
  private waveGoldEarned = 0;
  private pendingWaveComplete: Phaser.Time.TimerEvent | null = null;

  private selectedTowerType: TowerType | null = null;
  private selectedTower: Tower | null = null;
  private uiGuard = false;

  private topBar!: GameTopBar;
  private bottomBar!: GameBottomBar;
  private infoPanel!: TowerInfoPanel;
  private pauseShade!: Phaser.GameObjects.Rectangle;
  private previewGfx!: Phaser.GameObjects.Graphics;
  private placementPreview!: Phaser.GameObjects.Image;
  private hoveredLaneEntry: string | null = null;
  private hoveredTowerKey = '';
  private lastHoverRefreshAt = 0;
  private previewHidden = true;
  private previewCellKey = '';
  /** HUD i karty broni są przerysowywane najwyżej raz na klatkę i tylko po zmianie stanu. */
  private hudDirty = true;
  private buttonsDirty = true;
  /** Maska widocznych typów wrogów — audio dostaje nową listę tylko po zmianie składu. */
  private audioLoopMask = 0;
  private nextAudioLoopSync = 0;

  constructor() {
    super('GameScene');
  }

  create() {
    this.waves = makeWaves();
    this.waveNumber = 0;
    this.waveActive = false;
    this.gold = START_GOLD;
    this.lives = START_LIVES;
    this.score = 0;
    this.kills = 0;
    this.goldEarned = 0;
    this.clock = 0;
    this.speedIndex = 0;
    this.gameSpeed = SPEEDS[0];
    this.paused = false;
    this.gameEnded = false;
    this.finished = false;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    // Po restarcie sceny obiekty z pul są już zniszczone przez Phaser.
    this.projectilePool = [];
    this.fxPool = [];
    this.fxActive = [];
    this.lightningPool = [];
    this.lightningActive = [];
    this.spawnQueue = [];
    this.spawnCursor = 0;
    this.enemiesAliveInWave = 0;
    this.waveGoldEarned = 0;
    if (this.pendingWaveComplete) {
      this.pendingWaveComplete.remove(false);
      this.pendingWaveComplete = null;
    }
    this.selectedTowerType = null;
    this.selectedTower = null;
    this.uiGuard = false;
    this.hoveredLaneEntry = null;
    this.hoveredTowerKey = '';
    this.lastHoverRefreshAt = 0;
    this.previewHidden = true;
    this.previewCellKey = '';
    this.gridTowers = Array.from({ length: COLS }, () => Array<null>(ROWS).fill(null));

    this.buildEnemyShadows();
    drawMap(this, 1);
    drawLaneArrows(this, 1, true);
    drawExitArrows(this, 1, true);
    this.topBar = new GameTopBar(this, {
      pause: () => this.togglePause(),
      speed: () => this.toggleSpeed(),
      restart: () => this.restartGame(),
      menu: () => this.exitToMenu(),
      fullscreen: () => toggleFullscreen(this),
      sendWave: () => this.sendWave(),
    });
    this.bottomBar = new GameBottomBar(this, (type) => this.selectTowerType(type));
    this.infoPanel = new TowerInfoPanel(this, {
      guard: () => {
        this.uiGuard = true;
      },
      upgrade: () => this.upgradeSelected(),
      sell: () => this.sellSelected(),
      close: () => this.closeInfoPanel(),
    });

    this.previewGfx = this.add.graphics().setDepth(DEPTH.TOWER + 2);
    this.placementPreview = this.add
      .image(0, 0, 'tower-arrow')
      .setAlpha(PLACEMENT.previewAlpha)
      .setVisible(false)
      .setDepth(DEPTH.TOWER + 1)
      .setScale(TOWER_SCALE);
    this.pauseShade = this.add
      .rectangle(CENTER_X, BOARD_CY, GAME_W, BOARD_H, OVERLAY.pause.color, OVERLAY.pause.alpha)
      .setDepth(DEPTH.PANEL + 5)
      .setVisible(false);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handleHover(pointer));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleClick(pointer));
    this.bindKeys();

    this.cameras.main.fadeIn(TIMING.sceneFadeIn, 0, 0, 0);
    this.setStatus(t('intro'), STATUS_HOLD.intro);
    this.refreshHud();
    this.refreshTowerButtons();

    /* Audio jest niezależne od sceny: muzyka rusza razem z grą, a wyjście (menu, restart,
       ekran końcowy) gasi muzykę i silniki wrogów przez to samo sprzątanie. */
    this.audioLoopMask = 0;
    this.nextAudioLoopSync = 0;
    gameAudio.setEnemyLoops([]);
    gameAudio.startMusic();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => gameAudio.stopGame());
  }

  /** Cień pod wrogiem: rozmyta sylwetka tego samego sprite'a, nałożona kilka razy. */
  private buildEnemyShadows() {
    const cfg = ENEMY_SHADOW.game;
    for (const type of ENEMY_ORDER) {
      const texture = ENEMY_STYLE[type].texture;
      makeIconShadowTexture(this, texture, texture + cfg.suffix, cfg.blur, ENEMY_SHADOW.color, 1, cfg.passes);
    }
  }

  private bindKeys() {
    const kb = this.input.keyboard;
    if (!kb) return;
    TOWER_ORDER.forEach((type, i) => {
      kb.on('keydown-' + ['ONE', 'TWO', 'THREE', 'FOUR'][i], () => this.selectTowerType(type));
    });
    kb.on('keydown-SPACE', () => this.sendWave());
    kb.on('keydown-U', () => this.upgradeSelected());
    kb.on('keydown-S', () => this.sellSelected());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-F', () => this.toggleSpeed());
    kb.on('keydown-R', () => this.restartGame());
    kb.on('keydown-M', () => this.exitToMenu());
    kb.on('keydown-ESC', () => {
      this.selectedTowerType = null;
      this.placementPreview.setVisible(false);
      this.previewGfx.clear();
      this.closeInfoPanel();
      this.refreshTowerButtons();
    });
  }

  /* ------------------------------- HUD ------------------------------- */
  private refreshHud() {
    this.hudDirty = true;
  }

  private refreshTowerButtons() {
    this.buttonsDirty = true;
  }

  /**
   * Jeden loop na rodzaj wroga widoczny na planszy: 6 czołgów daje nadal jeden silnik.
   * Zestaw typów liczymy najwyżej co 120 ms gry i przekazujemy tylko po zmianie składu,
   * więc audio nie wykonuje żadnej pracy w klatkach, w których nic się nie zmieniło.
   */
  private syncEnemyLoops(force = false) {
    if (!force && this.clock < this.nextAudioLoopSync) return;
    this.nextAudioLoopSync = this.clock + 120;
    let mask = 0;
    const enemies = this.enemies;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.alive || !onBoard(enemy.x, enemy.y)) continue;
      const index = ENEMY_ORDER.indexOf(enemy.config.type);
      if (index >= 0) mask |= 1 << index;
    }
    if (!force && mask === this.audioLoopMask) return;
    this.audioLoopMask = mask;
    const types: EnemyType[] = [];
    for (let i = 0; i < ENEMY_ORDER.length; i++) {
      if (mask & (1 << i)) types.push(ENEMY_ORDER[i]);
    }
    gameAudio.setEnemyLoops(types);
  }

  private flushHud() {
    if (this.hudDirty) {
      this.hudDirty = false;
      this.topBar.updateCounters(this.gold, Math.max(0, this.lives), this.waveNumber, this.score, this.waveActive);
    }
    if (this.buttonsDirty) {
      this.buttonsDirty = false;
      this.bottomBar.refresh(this.gold, this.selectedTowerType);
    }
  }

  private setStatus(message: string, holdMs?: number, tone: 'default' | 'danger' = 'default') {
    this.topBar.showStatus(message, holdMs, tone);
  }

  /** Komunikat o zablokowanej akcji: jeden wspólny dźwięk alertu i czerwony PROMPTER. */
  private showBlocked(message: string) {
    gameAudio.blocked();
    this.setStatus(message, STATUS_HOLD.default, 'danger');
  }

  /* ------------------------------- sterowanie ------------------------------- */
  private toggleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    this.gameSpeed = SPEEDS[this.speedIndex];
    this.topBar.setSpeed(this.gameSpeed);
  }

  private togglePause() {
    this.paused = !this.paused;
    this.pauseShade.setVisible(this.paused);
    this.topBar.setPaused(this.paused);
    /* Pauza zatrzymuje wyłącznie pętle wrogów. Główna pętla gry i muzyka grają dalej,
       dzięki czemu można ją zdjąć w dowolnym momencie. */
    if (this.paused) {
      gameAudio.setEnemyLoops([]);
      return;
    }
    this.audioLoopMask = -1;
    this.syncEnemyLoops(true);
  }

  /** Wyjście do menu jest zablokowane do końca aktywnej fali. */
  private exitToMenu(): boolean {
    if (this.waveActive) {
      this.showBlocked(t('waveLocked'));
      return false;
    }
    this.scene.start('MenuScene');
    return true;
  }

  /** Restart jest zablokowany do końca aktywnej fali. */
  private restartGame(): boolean {
    if (this.waveActive) {
      this.showBlocked(t('waveLocked'));
      return false;
    }
    this.scene.restart();
    return true;
  }

  /* ------------------------------- budowanie wież ------------------------------- */
  private selectTowerType(type: TowerType) {
    if (this.gameEnded) return;
    const stats = TOWER_STATS[type][0];
    if (this.selectedTowerType === type) {
      this.selectedTowerType = null;
      this.placementPreview.setVisible(false);
      if (!this.previewHidden) this.previewGfx.clear();
      this.previewHidden = true;
      this.previewCellKey = '';
    } else {
      if (this.gold < stats.cost) {
        this.showBlocked(t('noGoldTower', { cost: stats.cost }));
        return;
      }
      this.selectedTowerType = type;
      this.closeInfoPanel();
      this.placementPreview.setTexture(towerSpriteKey(type)).setVisible(true);
      this.previewCellKey = '';
      this.previewHidden = true;
      gameAudio.towerSelect();
    }
    this.refreshTowerButtons();
  }

  private canPlaceTower(col: number, row: number): boolean {
    if (!isInsideGrid(col, row)) return false;
    if (isPath(col, row)) return false;
    if (!isAdjacentToPath(col, row)) return false;
    if (this.gridTowers[col][row]) return false;
    if (!this.selectedTowerType) return false;
    return this.gold >= TOWER_STATS[this.selectedTowerType][0].cost;
  }

  private handleHover(pointer: Phaser.Input.Pointer) {
    if (this.gameEnded) {
      if (!this.previewHidden) this.previewGfx.clear();
      this.previewHidden = true;
      this.placementPreview.setVisible(false);
      return;
    }
    if (!this.selectedTowerType) {
      // Tekst w Phaserze to nowa tekstura na canvasie, więc podpowiedzi są odświeżane
      // najwyżej raz na TIMING.hoverRefresh, a nie przy każdym ruchu myszy.
      const now = this.time.now;
      const canRefresh = now - this.lastHoverRefreshAt >= TIMING.hoverRefresh;
      if (!this.previewHidden) {
        this.previewGfx.clear();
        this.previewHidden = true;
      }
      // Strzałki wejścia: najechanie pokazuje skład i punkty wejścia następnej fali.
      const laneId = laneEntryArrowAt(pointer.x, pointer.y);
      if (laneId) {
        if (this.isOverActiveLaneArrow(pointer)) {
          if (this.hoveredLaneEntry !== laneId && canRefresh) {
            this.hoveredLaneEntry = laneId;
            this.lastHoverRefreshAt = now;
            this.showWavePreviewStatus(laneId);
          }
        } else {
          this.hoveredLaneEntry = null;
        }
        return;
      }
      this.hoveredLaneEntry = null;
      // najechanie na postawioną wieżę: krótki opis w pasku statusu
      if (pointerOnBoard(pointer.x, pointer.y) && canRefresh) {
        const cell = pointerCell(pointer.x, pointer.y);
        const towerThere = this.gridTowers[cell.col]?.[cell.row];
        if (towerThere && !this.infoPanel.isOpen) {
          const key = towerThere.col + ',' + towerThere.row + ':' + towerThere.level;
          if (key !== this.hoveredTowerKey) {
            this.hoveredTowerKey = key;
            this.lastHoverRefreshAt = now;
            const st = TOWER_STATS[towerThere.type][towerThere.level];
            const line1 = `${towerName(towerThere.type)} · ${t('hoverLevel')} ${towerThere.level + 1}/${MAX_TOWER_LEVEL + 1}`;
            const line2 = `${damageLabel(st)} · ${t('range')} ${st.range}px · ${t('hoverEvery')} ${st.fireRate} ms`;
            const line3 =
              towerThere.level < MAX_TOWER_LEVEL
                ? t('hoverUpgrade', { cost: st.upgradeCost })
                : t('hoverMax');
            this.setStatus(`${line1}\n${line2}\n${line3}`, STATUS_HOLD.towerHover);
          }
        } else {
          this.hoveredTowerKey = '';
        }
      }
      return;
    }
    this.hoveredTowerKey = '';

    if (!pointerOnBoard(pointer.x, pointer.y)) {
      if (!this.previewHidden) this.previewGfx.clear();
      this.previewHidden = true;
      this.previewCellKey = '';
      this.placementPreview.setVisible(false);
      return;
    }
    // Scalar cell lookup avoids allocating a temporary {col,row} on every pointermove.
    const col = Math.floor(pointer.x / CELL);
    const row = Math.floor((pointer.y - WORLD_Y) / CELL);
    const canPlace = this.canPlaceTower(col, row);
    const selectedType = this.selectedTowerType;
    if (!selectedType) return;
    const cellKey = `${selectedType}:${col}:${row}:${canPlace ? 1 : 0}`;
    // The green/red build preview and range ring only change when the hovered cell/state changes.
    if (cellKey === this.previewCellKey && !this.previewHidden) return;
    this.previewCellKey = cellKey;
    const center = cellCenter(col, row);
    const stats = TOWER_STATS[selectedType][0];
    const color = TOWER_INFO[selectedType].color;

    if (!this.placementPreview.visible) this.placementPreview.setVisible(true);
    this.previewHidden = false;
    this.placementPreview.setPosition(center.x, center.y);
    this.placementPreview.setTint(canPlace ? PALETTE.white : PLACEMENT.invalidTint);

    const cellX = col * CELL + 1;
    const cellY = WORLD_Y + row * CELL + 1;
    this.previewGfx.clear();
    this.previewGfx.fillStyle(canPlace ? PLACEMENT.validColor : PLACEMENT.invalidColor, PLACEMENT.cellFill);
    this.previewGfx.fillRect(cellX, cellY, CELL - 2, CELL - 2);
    this.previewGfx.lineStyle(PLACEMENT.lineWidth, canPlace ? PLACEMENT.validColor : PLACEMENT.invalidColor, PLACEMENT.cellStroke);
    this.previewGfx.strokeRect(cellX, cellY, CELL - 2, CELL - 2);
    this.previewGfx.fillStyle(color, PLACEMENT.rangeFill);
    this.previewGfx.fillCircle(center.x, center.y, stats.range);
    this.previewGfx.lineStyle(PLACEMENT.lineWidth, color, PLACEMENT.rangeStroke);
    this.previewGfx.strokeCircle(center.x, center.y, stats.range);
  }

  private handleClick(pointer: Phaser.Input.Pointer) {
    if (this.gameEnded || this.paused) return;
    if (this.uiGuard) {
      this.uiGuard = false;
      return;
    }
    if (!pointerOnBoard(pointer.x, pointer.y)) return;
    const { col, row } = pointerCell(pointer.x, pointer.y);

    const existing = this.gridTowers[col]?.[row];
    if (existing) {
      this.openInfoPanel(existing);
      return;
    }
    if (!this.selectedTowerType) {
      this.closeInfoPanel();
      return;
    }
    const selectedStats = TOWER_STATS[this.selectedTowerType][0];
    if (this.gold < selectedStats.cost) {
      this.showBlocked(t('noGoldTower', { cost: selectedStats.cost }));
      return;
    }
    if (!this.canPlaceTower(col, row)) {
      this.showBlocked(t('cannotBuild'));
      return;
    }

    const type = this.selectedTowerType;
    const stats = TOWER_STATS[type][0];
    const center = cellCenter(col, row);
    this.gold -= stats.cost;

    const sprite = this.add
      .image(center.x, center.y, towerBodyKey(type, 0))
      .setDepth(DEPTH.TOWER)
      .setScale(TOWER_SCALE);
    const head = this.add
      .image(center.x, center.y, towerHeadKey(type, 0))
      .setDepth(DEPTH.TOWER + TURRET.depthStep)
      .setScale(TOWER_SCALE);
    const tower: Tower = {
      type,
      level: 0,
      col,
      row,
      sprite,
      head,
      headAngle: TURRET.restAngle,
      headFrom: TURRET.restAngle,
      headTo: TURRET.restAngle,
      headStartAt: 0,
      headEndAt: 0,
      lastFired: 0,
      invested: stats.cost,
      homeX: center.x,
      homeY: center.y,
      recoilDx: 0,
      recoilDy: 0,
      recoilUntil: 0,
    };
    this.towers.push(tower);
    this.gridTowers[col][row] = tower;
    this.tweens.add({
      targets: [sprite, head],
      scale: { from: TOWER_SCALE * PLACEMENT.spawnScaleFrom, to: TOWER_SCALE },
      duration: PLACEMENT.spawnMs,
      ease: 'Back.easeOut',
    });
    this.spawnParticles(center.x, center.y, TOWER_INFO[type].color, FX.placeParticles);
    gameAudio.placeTower();
    this.refreshHud();
    this.refreshTowerButtons();
    this.handleHover(pointer);
  }

  /* ------------------------------- panel informacji o wieży ------------------------------- */
  private closeInfoPanel() {
    this.infoPanel.clear();
    this.selectedTower = null;
    this.refreshTowerButtons();
  }

  private openInfoPanel(tower: Tower) {
    this.selectedTower = tower;
    this.selectedTowerType = null;
    this.placementPreview.setVisible(false);
    this.previewGfx.clear();
    this.refreshTowerButtons();
    this.infoPanel.open(tower, this.gold);
  }

  /* ------------------------------- wrogowie ------------------------------- */
  private spawnEnemy(config: EnemyConfig, path: LanePath) {
    const style = ENEMY_STYLE[config.type];
    const view = ENEMY_VIEW[config.type];
    const cfg = ENEMY_SHADOW.game;
    const spawn = path.points[0];
    const shadowKey = style.texture + cfg.suffix;
    const shadow = this.add
      .image(spawn.x, spawn.y + cfg.dy, this.textures.exists(shadowKey) ? shadowKey : style.texture)
      .setTint(ENEMY_SHADOW.color)
      .setDepth(DEPTH.ENEMY - 1);
    const sprite = this.add.image(spawn.x, spawn.y, style.texture).setDepth(DEPTH.ENEMY);
    const barBg = this.add
      .rectangle(spawn.x, spawn.y - view.barOffset, view.barW, HEALTH_BAR.height, HEALTH_BAR.bg)
      .setDepth(DEPTH.HEALTH);
    const bar = this.add
      .rectangle(spawn.x - view.barW / 2, spawn.y - view.barOffset, view.barW, HEALTH_BAR.height, HEALTH_BAR.high)
      .setDepth(DEPTH.HEALTH + 1)
      .setOrigin(0, 0.5);
    const visible = onBoard(spawn.x, spawn.y);
    for (const obj of [sprite, shadow, bar, barBg]) obj.setVisible(visible);
    // Animacja wejścia liczona w updateEnemies — bez tweena na każdego wroga.
    sprite.setScale(view.gameScale * ENEMY_MOTION.spawnScaleFrom);
    shadow.setScale(sprite.scaleX * cfg.scale);

    this.enemies.push({
      config,
      hp: config.hp,
      maxHp: config.hp,
      sprite,
      shadow,
      bar,
      barBg,
      barW: view.barW,
      barOffset: view.barOffset,
      path,
      pathIndex: 1,
      x: spawn.x,
      y: spawn.y,
      baseSpeed: config.speed,
      travelled: 0,
      remaining: path.length,
      slowTimer: 0,
      slowFactor: 0,
      alive: true,
      onBoard: visible,
      damage: config.damage,
      lastResistFx: 0,
      barPct: 1,
      tinted: false,
      targetScale: view.gameScale,
      spawnT: 0,
    });
  }

  /** Ruch po trasie; obrót zgodny z ruchem wskazówek zegara, proporcjonalny do przebytej drogi. */
  private updateEnemies(dt: number) {
    const M = ENEMY_MOTION;
    const cfg = ENEMY_SHADOW.game;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.alive) continue;
      if (enemy.spawnT < TIMING.enemySpawnAnim) {
        enemy.spawnT += dt;
        const k = Math.min(1, enemy.spawnT / TIMING.enemySpawnAnim);
        // Back.easeOut: lekkie przestrzelenie, potem powrót do skali docelowej.
        const eased = 1 + (M.backEase + 1) * Math.pow(k - 1, 3) + M.backEase * Math.pow(k - 1, 2);
        enemy.sprite.setScale(enemy.targetScale * (M.spawnScaleFrom + (1 - M.spawnScaleFrom) * eased));
        enemy.shadow.setScale(enemy.sprite.scaleX * cfg.scale);
      }

      if (enemy.slowTimer > 0) {
        enemy.slowTimer -= dt;
        if (enemy.slowTimer <= 0) {
          enemy.slowTimer = 0;
          enemy.slowFactor = 0;
          enemy.tinted = false;
          enemy.sprite.clearTint();
        }
      }
      const speed = enemy.baseSpeed * (1 - enemy.slowFactor);
      if (enemy.slowFactor > 0 && !enemy.tinted) {
        enemy.tinted = true;
        enemy.sprite.setTint(M.slowTint);
      }

      const target = enemy.path.points[enemy.pathIndex];
      if (!target) {
        this.enemyReachedBase(enemy);
        continue;
      }
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = (speed * dt) / 1000;
      const travelledBeforeMove = enemy.travelled;
      if (dist <= Math.max(step, M.waypointSnap)) {
        enemy.x = target.x;
        enemy.y = target.y;
        enemy.travelled += dist;
        enemy.pathIndex++;
        if (enemy.pathIndex >= enemy.path.points.length) {
          this.enemyReachedBase(enemy);
          continue;
        }
      } else {
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
        enemy.travelled += step;
      }
      enemy.remaining = Math.max(0, enemy.path.length - enemy.travelled);

      const visible = onBoard(enemy.x, enemy.y);
      if (visible !== enemy.onBoard) {
        enemy.onBoard = visible;
        for (const obj of [enemy.sprite, enemy.shadow, enemy.bar, enemy.barBg]) obj.setVisible(visible);
      }
      if (enemy.x > GAME_W) {
        this.enemyReachedBase(enemy);
        continue;
      }

      enemy.sprite.setPosition(enemy.x, enemy.y);
      enemy.sprite.setRotation(enemy.sprite.rotation + (enemy.travelled - travelledBeforeMove) * M.rotationPerPixel);
      enemy.shadow.setPosition(enemy.x, enemy.y + cfg.dy);
      enemy.shadow.setRotation(enemy.sprite.rotation);

      // Pozycja paska HP co klatkę, rozmiar i kolor tylko po zmianie HP.
      enemy.barBg.setPosition(enemy.x, enemy.y - enemy.barOffset);
      enemy.bar.setPosition(enemy.x - enemy.barW / 2, enemy.y - enemy.barOffset);
      const pct = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
      if (Math.abs(pct - enemy.barPct) > HEALTH_BAR.minChange) {
        enemy.barPct = pct;
        enemy.bar.setSize(Math.max(1, enemy.barW * pct), HEALTH_BAR.height);
        enemy.bar.setFillStyle(
          pct > HEALTH_BAR.highAbove ? HEALTH_BAR.high : pct > HEALTH_BAR.midAbove ? HEALTH_BAR.mid : HEALTH_BAR.low,
        );
      }
    }
  }

  private removeEnemy(enemy: Enemy) {
    enemy.sprite.destroy();
    enemy.shadow.destroy();
    enemy.bar.destroy();
    enemy.barBg.destroy();
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) this.enemies.splice(index, 1);
  }

  /* ------------------------------- efekty ------------------------------- */
  private spawnParticles(x: number, y: number, color: number, count: number) {
    // Twardy sufit aktywnych cząstek chroni płynność przy dużych falach.
    if (this.fxActive.length >= FX.particleCap) return;
    const allowed = Math.min(count, FX.particleCap - this.fxActive.length);
    const [minSize, maxSize] = FX.particleSize;
    const [minDist, maxDist] = FX.particleDistance;
    const [minMs, maxMs] = FX.particleMs;
    for (let i = 0; i < allowed; i++) {
      const fx = this.acquireFx('rect');
      const size = minSize + Math.random() * (maxSize - minSize);
      (fx.obj as Phaser.GameObjects.Rectangle).setSize(size, size).setFillStyle(i % 3 === 0 ? PALETTE.white : color);
      const angle = Math.random() * Math.PI * 2;
      const distance = minDist + Math.random() * (maxDist - minDist);
      const dur = minMs + Math.random() * (maxMs - minMs);
      this.startFx(fx, x, y, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 1, 0.2, 1, 0, dur, 1, DEPTH.FX);
    }
  }

  private drawLightning(x1: number, y1: number, x2: number, y2: number) {
    const g = this.lightningPool.pop() ?? this.add.graphics().setDepth(DEPTH.FX + 2);
    g.clear().setVisible(true).setAlpha(1);
    g.lineStyle(FX.lightningWidth, FX.color.lightning, 0.95);
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < FX.lightningSegments; i++) {
      const k = i / FX.lightningSegments;
      g.lineTo(
        x1 + (x2 - x1) * k + (Math.random() - 0.5) * FX.lightningJitter,
        y1 + (y2 - y1) * k + (Math.random() - 0.5) * FX.lightningJitter,
      );
    }
    g.lineTo(x2, y2);
    g.strokePath();
    this.lightningActive.push({ g, t: 0, dur: FX.lightningMs });
  }

  private upgradeSelected() {
    const tower = this.selectedTower;
    if (!tower || tower.level >= MAX_TOWER_LEVEL) return;
    const stats = TOWER_STATS[tower.type][tower.level];
    if (this.gold < stats.upgradeCost) {
      this.showBlocked(t('noGoldUpgrade', { cost: stats.upgradeCost }));
      return;
    }
    this.gold -= stats.upgradeCost;
    tower.invested += stats.upgradeCost;
    tower.level++;
    tower.sprite.setTexture(towerBodyKey(tower.type, tower.level));
    tower.head.setTexture(towerHeadKey(tower.type, tower.level));
    gameAudio.upgradeTower(tower.level);
    this.spawnParticles(tower.sprite.x, tower.sprite.y, FX.color.upgrade, FX.upgradeParticles);
    this.tweens.add({
      targets: [tower.sprite, tower.head],
      scale: { from: TOWER_SCALE * COMBAT.upgradePopScale, to: TOWER_SCALE },
      duration: PLACEMENT.upgradeMs,
      ease: 'Back.easeOut',
    });
    this.openInfoPanel(tower);
    this.refreshHud();
    this.refreshTowerButtons();
  }

  private sellSelected() {
    const tower = this.selectedTower;
    if (!tower) return;
    const refund = Math.floor(tower.invested * SELL_FACTOR);
    this.gold += refund;
    this.gridTowers[tower.col][tower.row] = null;
    this.towers.splice(this.towers.indexOf(tower), 1);
    this.spawnParticles(tower.sprite.x, tower.sprite.y, FX.color.sell, FX.sellParticles);
    tower.sprite.destroy();
    tower.head.destroy();
    this.setStatus(t('sold', { refund }));
    this.closeInfoPanel();
    this.refreshHud();
    this.refreshTowerButtons();
  }

  /* ------------------------------- zapowiedź fali po najechaniu na strzałkę wejścia ------------------------------- */

  /** true, jeśli kursor jest nad strzałką wejścia drogi aktywnej w następnej fali. */
  private isOverActiveLaneArrow(pointer: Phaser.Input.Pointer): boolean {
    if (this.waveActive) return false;
    if (this.waveNumber + 1 > this.waves.length) return false;
    // Wszystkie trzy drogi są aktywne od pierwszej fali — każda strzałka pokazuje zapowiedź.
    return laneEntryArrowAt(pointer.x, pointer.y) !== null;
  }

  /** Pokazuje zapowiedź następnej fali w górnym pasku statusu. */
  private showWavePreviewStatus(laneId?: string) {
    if (this.gameEnded || this.waveActive || this.waveNumber >= this.waves.length) return;
    const nextWave = this.waves[this.waveNumber];
    const waveNum = this.waveNumber + 1;

    const counts: Partial<Record<EnemyType, number>> = {};
    let totalEnemies = 0;
    for (const g of nextWave.groups) {
      counts[g.config.type] = (counts[g.config.type] || 0) + g.count;
      totalEnemies += g.count;
    }
    const detailParts: string[] = [];
    for (const et of ENEMY_ORDER) {
      if (counts[et]) detailParts.push(`${counts[et]}x ${enemyName(et)}`);
    }
    // Podział równy na drogi; reszta trafia na kolejne drogi w rotacji.
    const perLane = LANES.map((_, i) => Math.floor(totalEnemies / LANES.length) + (i < totalEnemies % LANES.length ? 1 : 0));
    const split = `A: ${perLane[0]} · B: ${perLane[1]} · C: ${perLane[2]}`;
    const laneName = laneId === 'A' ? t('laneA') : laneId === 'B' ? t('laneB') : laneId === 'C' ? t('laneC') : '';
    const laneText = laneName ? `${laneName} → ` : '';

    this.setStatus(
      t('nextWaveHover', {
        n: waveNum,
        count: totalEnemies,
        details: detailParts.join(', '),
        lanes: String(LANES.length),
        split,
      }).replace('{lane}', laneText),
      STATUS_HOLD.wavePreview,
    );
  }

  /* ------------------------------- fale i spawn ------------------------------- */
  private sendWave() {
    if (this.gameEnded) return;
    if (this.waveActive) {
      this.showBlocked(t('waveRunning'));
      return;
    }
    if (this.paused) return;
    if (this.waveNumber >= this.waves.length) return;

    const wave = this.waves[this.waveNumber];
    this.waveNumber++;
    this.waveActive = true;
    this.waveGoldEarned = 0;
    if (this.pendingWaveComplete) {
      this.pendingWaveComplete.remove(false);
      this.pendingWaveComplete = null;
    }

    // Każda grupa ma własny czas startu, a liczebność dzielona jest po równo
    // na trzy drogi (rotacja A -> B -> C); `burst` wypuszcza kilka sztuk naraz.
    this.spawnQueue = [];
    this.spawnCursor = 0;
    let total = 0;
    const start = this.clock + TIMING.waveStartDelay;
    let laneCursor = 0;
    for (const group of wave.groups) {
      const batchStep = Math.max(TIMING.minBatchStep, group.interval * group.burst);
      for (let i = 0; i < group.count; i++) {
        const lane = LANES[(laneCursor + i) % LANES.length];
        this.spawnQueue.push({
          config: group.config,
          pathId: lane,
          at: start + group.delay + Math.floor(i / group.burst) * batchStep,
        });
      }
      laneCursor = (laneCursor + group.count) % LANES.length;
      total += group.count;
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.enemiesAliveInWave = total;
    gameAudio.wave();

    const bossType = waveHasBoss(wave);
    this.setStatus(
      t('waveStart', { n: this.waveNumber, total: TOTAL_WAVES, count: total }) +
        (bossType === 'megaboss' ? ' · MEGA BOSS' : bossType ? ' · BOSS' : ''),
    );
    this.refreshHud();
  }

  private spawnQueuedEnemies() {
    if (!this.waveActive) return;
    // Kursor zamiast shift(): bez przesuwania całej tablicy przy każdym wrogu.
    const queue = this.spawnQueue;
    while (this.spawnCursor < queue.length && queue[this.spawnCursor].at <= this.clock) {
      const entry = queue[this.spawnCursor++];
      this.spawnEnemy(entry.config, getPathById(entry.pathId));
    }
  }

  private enemyReachedBase(enemy: Enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.lives -= enemy.damage;
    gameAudio.baseHit(enemy.config.type);
    this.enemiesAliveInWave--;
    this.removeEnemy(enemy);
    if (isBossType(enemy.config.type)) {
      this.setStatus(
        t('bossInBase', { boss: enemy.config.type === 'megaboss' ? 'MEGA BOSS' : 'BOSS', dmg: enemy.damage }),
        STATUS_HOLD.default,
        'danger',
      );
    } else {
      this.setStatus(t('enemyInBase', { dmg: enemy.damage }), STATUS_HOLD.default, 'danger');
    }
    this.cameras.main.shake(FX.shake.base.ms, FX.shake.base.intensity);
    this.refreshHud();
    if (this.lives <= 0) this.endGame(false);
    else this.checkWaveComplete(STATUS_HOLD.default);
  }

  /* ------------------------------- wieże i pociski ------------------------------- */
  private updateTowers() {
    const towers = this.towers;
    for (let ti = 0; ti < towers.length; ti++) {
      const tower = towers[ti];
      // Odrzut liczony z czasu gry: wyjście i powrót po połowie TIMING.recoil (trójkąt).
      // Poza odrzutem sprite stoi dokładnie w punkcie domowym.
      const left = tower.recoilUntil - this.clock;
      if (left > 0) {
        const half = TIMING.recoil / 2;
        const k = left > half ? (TIMING.recoil - left) / half : left / half;
        this.placeTower(tower, tower.homeX + tower.recoilDx * k, tower.homeY + tower.recoilDy * k);
      } else if (tower.sprite.x !== tower.homeX || tower.sprite.y !== tower.homeY) {
        this.placeTower(tower, tower.homeX, tower.homeY);
      }

      const stats = TOWER_STATS[tower.type][tower.level];
      if (this.clock - tower.lastFired < stats.fireRate) continue;

      const bestTarget = this.pickTarget(tower, stats);
      if (bestTarget) {
        // Termin kolejnego strzału liczony od poprzedniego terminu (wielokrotność fireRate),
        // a nie od chwili klatki — tempo ognia nie dryfuje przy przyspieszeniu gry.
        const elapsed = this.clock - tower.lastFired;
        tower.lastFired += Math.floor(elapsed / stats.fireRate) * stats.fireRate;
        this.fireProjectile(tower, bestTarget);
      }
    }
  }

  /** Czy wróg w ogóle może być celem tej wieży (żywy, widoczny, w zasięgu, podatny).
      Odległość porównywana w kwadracie — bez pierwiastka i bez wywołań pomocniczych. */
  private isCandidate(tower: Tower, enemy: Enemy, rangeSq: number): boolean {
    if (!enemy.alive || !enemy.onBoard) return false;
    if (!canAffect(tower.type, enemy.config.type)) return false;
    // mróz nie celuje we wrogów aktualnie spowolnionych; po odzyskaniu
    // pełnej prędkości wróg może dostać spowolnienie ponownie (także od tej samej wieży)
    if (tower.type === 'frost' && enemy.slowTimer > 0) return false;
    const dx = tower.homeX - enemy.x;
    const dy = tower.homeY - enemy.y;
    return dx * dx + dy * dy <= rangeSq;
  }

  /* PRIORYTET CELÓW — reguła w isBetterTarget (logic/combat.ts), ta sama dla całej broni:
     najniższe aktualne HP, potem szybszy typ wroga, potem najbliżej bazy.
     Pętla nie alokuje: wróg jest przekazywany bezpośrednio (spełnia TargetCandidate). */
  private pickTarget(tower: Tower, stats: TowerLevelStats): Enemy | null {
    const rangeSq = stats.range * stats.range;
    let best: Enemy | null = null;
    const enemies = this.enemies;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!this.isCandidate(tower, enemy, rangeSq)) continue;
      if (!best || isBetterTarget(enemy, best)) best = enemy;
    }
    return best;
  }

  /* Pula pocisków: zużyty pocisk wraca do puli i jest używany ponownie — bez tworzenia
     i niszczenia obiektów sceny przy każdym strzale. */
  private projectilePool: Projectile[] = [];

  private acquireProjectile(textureKey: string): Projectile {
    const pooled = this.projectilePool.pop();
    if (pooled) {
      pooled.sprite.setTexture(textureKey).setVisible(true).setActive(true);
      return pooled;
    }
    const sprite = this.add.image(0, 0, textureKey).setDepth(DEPTH.PROJECTILE);
    return {
      sprite,
      x: 0,
      y: 0,
      targetEnemy: null as unknown as Enemy,
      speed: 0,
      towerType: 'arrow',
      towerLevel: 0,
      damage: 0,
      slow: 0,
      slowDuration: 0,
      chain: 0,
      chainDamage: [],
      alive: false,
    };
  }

  private releaseProjectile(p: Projectile) {
    p.alive = false;
    p.targetEnemy = null as unknown as Enemy;
    p.sprite.setVisible(false).setActive(false).setScale(1).clearTint().setRotation(0);
    this.projectilePool.push(p);
  }

  /** Usuwa pocisk z aktywnej listy przez podmianę z ostatnim (O(1), bez przesuwania tablicy). */
  private removeProjectileAt(i: number) {
    const list = this.projectiles;
    const last = list.length - 1;
    const p = list[i];
    if (i !== last) list[i] = list[last];
    list.length = last;
    this.releaseProjectile(p);
  }

  private fireProjectile(tower: Tower, enemy: Enemy) {
    const stats = TOWER_STATS[tower.type][tower.level];
    const p = this.acquireProjectile('proj-' + tower.type);
    const sprite = p.sprite;
    sprite.setPosition(tower.homeX, tower.homeY);
    const dx = enemy.x - tower.homeX;
    const dy = enemy.y - tower.homeY;
    if (tower.type !== 'frost') sprite.setRotation(Math.atan2(dy, dx));
    if (tower.level === MAX_TOWER_LEVEL) sprite.setScale(PROJECTILE.maxLevelScale).setTint(COMBAT.levelUpTint);

    p.x = tower.homeX;
    p.y = tower.homeY;
    p.targetEnemy = enemy;
    p.speed = PROJECTILE_SPEED[tower.type];
    p.towerType = tower.type;
    p.towerLevel = tower.level;
    p.damage = stats.damage;
    p.slow = stats.slow;
    p.slowDuration = stats.slowDuration;
    p.chain = stats.chain;
    p.chainDamage = stats.chainDamage;
    p.alive = true;
    this.projectiles.push(p);
    gameAudio.shot(tower.type, tower.level);

    // Krótki odrzut wieży w stronę strzału, liczony ręcznie w updateTowers.
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    tower.recoilDx = (dx / len) * COMBAT.recoilPx;
    tower.recoilDy = (dy / len) * COMBAT.recoilPx;
    tower.recoilUntil = this.clock + TIMING.recoil;
    this.aimTurret(tower, dx, dy);
  }

  /* ------------------------------- głowice wież -------------------------------
     Obrót głowicy jest czysto wizualny: nie wpływa na celowanie, obrażenia ani czas
     strzału. Wszystkie głowice porusza jedna pętla liczona z czasu gry — bez tweenów,
     obiektów pomocniczych i alokacji, więc kilkadziesiąt wież na ekranie kosztuje
     kilka porównań na klatkę. */

  /** Nastawia głowicę na najbliższy bazowy kierunek (pas 45°) i rusza obrót najkrótszą drogą. */
  private aimTurret(tower: Tower, dx: number, dy: number) {
    const to = Math.round((Math.atan2(dy, dx) + Math.PI / 2) / TURRET_ANGLE_STEP) * TURRET_ANGLE_STEP;
    const from = this.turretAngle(tower);
    const delta = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    tower.headFrom = from;
    tower.headTo = from + delta;
    tower.headStartAt = this.clock;
    // Czas to liczba pokonywanych baz (w górę), więc zawsze jest wielokrotnością kroku
    // i nigdy nie bywa zerowy przy realnym ruchu — głowica nigdy nie telepie.
    const steps = Math.ceil(Math.abs(delta) / TURRET_ANGLE_STEP - 1e-9);
    tower.headEndAt = this.clock + steps * TURRET_STEP_MS;
  }

  /** Kąt głowicy w tej chwili: wygasający obrót między bazami albo pozycja docelowa. */
  private turretAngle(tower: Tower): number {
    const left = tower.headEndAt - this.clock;
    if (left <= 0) return tower.headTo;
    const k = 1 - left / (tower.headEndAt - tower.headStartAt);
    return tower.headFrom + (tower.headTo - tower.headFrom) * (1 - (1 - k) * (1 - k));
  }

  private updateTurretHeads() {
    const towers = this.towers;
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      // Ustawiona głowica bez trwającego obrotu nie jest nawet dotykana.
      if (tower.headEndAt <= this.clock && tower.headAngle === tower.headTo) continue;
      const angle = this.turretAngle(tower);
      if (angle === tower.headAngle) continue;
      tower.headAngle = angle;
      tower.head.setRotation(angle);
    }
  }

  /** Korpus i głowica zawsze stoją w tym samym punkcie — odrzut przesuwa oba. */
  private placeTower(tower: Tower, x: number, y: number) {
    tower.sprite.setPosition(x, y);
    tower.head.setPosition(x, y);
  }

  private updateProjectiles(dt: number) {
    // Iteracja od końca + swap-remove: usunięcie nie przesuwa reszty tablicy,
    // a element wstawiony z końca był już przetworzony w tej klatce.
    const list = this.projectiles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      let target = p.targetEnemy;
      if (!target || !target.alive) {
        const found = this.findNearestEnemy(p.x, p.y, COMBAT.retargetRadius, p.towerType, null, null, null);
        if (!found) {
          this.removeProjectileAt(i);
          continue;
        }
        target = found;
        p.targetEnemy = target;
      }
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = (p.speed * dt) / 1000;
      // Pociski kierunkowe lecą dziobem naprzód; symetryczny kryształ mrozu nie wymaga obrotu.
      if (p.towerType !== 'frost') p.sprite.setRotation(Math.atan2(dy, dx));
      if (dist < COMBAT.impactDistance || step >= dist) {
        p.x = target.x;
        p.y = target.y;
        this.impactProjectile(p);
        this.removeProjectileAt(i);
        continue;
      }
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setVisible(onBoard(p.x, p.y));
    }
  }

  /** Najbliższy wróg podatny na daną broń. Wykluczenia (do 3, dla łańcucha błyskawicy)
      przekazywane jako osobne argumenty — bez tworzenia Set przy każdym trafieniu. */
  private findNearestEnemy(
    x: number,
    y: number,
    maxDist: number,
    towerType: TowerType,
    ex1: Enemy | null,
    ex2: Enemy | null,
    ex3: Enemy | null,
  ): Enemy | null {
    let best: Enemy | null = null;
    let bestDistSq = maxDist * maxDist;
    const enemies = this.enemies;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.alive || !enemy.onBoard) continue;
      if (enemy === ex1 || enemy === ex2 || enemy === ex3) continue;
      if (!canAffect(towerType, enemy.config.type)) continue;
      if (towerType === 'frost' && enemy.slowTimer > 0) continue;
      const dx = x - enemy.x;
      const dy = y - enemy.y;
      const d = dx * dx + dy * dy;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = enemy;
      }
    }
    return best;
  }

  /* Trafienie zawsze 1 do 1: pocisk rani dokładnie ten cel, w który trafił.
     Sprite pocisku NIE jest tu niszczony — wraca do puli w removeProjectileAt. */
  private impactProjectile(p: Projectile) {
    const target = p.targetEnemy;
    if (!target || !target.alive) return;
    // broń, która nie działa na ten typ wroga, tylko się od niego odbija
    if (!canAffect(p.towerType, target.config.type)) {
      this.sparkFx(p.x, p.y, FX.color.deflect);
      return;
    }

    if (p.towerType === 'cannon') {
      this.explosionFx(p.x, p.y, FX.explosionRadius); // efekt wizualny, bez obrażeń obszarowych
      this.damageEnemy(target, p.damage, p.towerLevel, p.towerType);
    } else if (p.towerType === 'frost') {
      this.frostFx(p.x, p.y);
      // pocisk mrozu działa tylko na wroga z pełną prędkością: trafienie
      // w spowolnionego (np. pocisk wystrzelony wcześniej) nie odnawia spowolnienia
      if (target.slowTimer <= 0) this.applySlow(target, p.slow, p.slowDuration);
    } else if (p.towerType === 'lightning') {
      // łańcuch na 3 cele; obrażenia maleją wzdłuż łańcucha (25/10/5 = 40 HP łącznie).
      // Jeśli w zasięgu jest mniej wrogów, pierwszy cel i tak dostaje pełne 25 HP,
      // a kolejne ogniwa dostają mniej.
      const links = p.chainDamage;
      const firstDmg = links.length ? links[0] : p.damage;
      this.drawLightning(p.x, p.y, target.x, target.y);
      this.sparkFx(p.x, p.y, FX.color.lightning);
      this.damageEnemy(target, firstDmg, p.towerLevel, p.towerType);

      // już trafione ogniwa trzymane w trzech zmiennych (łańcuch ma maks. 3 cele) — bez Set
      let current: Enemy = target;
      let hit1: Enemy | null = target;
      let hit2: Enemy | null = null;
      for (let link = 1; link < p.chain && link < links.length; link++) {
        const next = this.findNearestEnemy(current.x, current.y, COMBAT.chainRange, p.towerType, hit1, hit2, null);
        if (!next || !next.alive) break;
        this.drawLightning(current.x, current.y, next.x, next.y);
        this.sparkFx(next.x, next.y, FX.color.lightning);
        this.damageEnemy(next, links[link], p.towerLevel, p.towerType);
        hit2 = next;
        current = next;
      }
    } else {
      this.sparkFx(p.x, p.y, TOWER_INFO[p.towerType].color);
      this.damageEnemy(target, p.damage, p.towerLevel, p.towerType);
    }
  }

  private applySlow(enemy: Enemy, factor: number, durationMs: number) {
    if (!enemy || !enemy.alive || factor <= 0) return;
    if (isBossType(enemy.config.type)) return;
    enemy.slowTimer = durationMs;
    enemy.slowFactor = Math.max(enemy.slowFactor, factor);
  }

  private damageEnemy(enemy: Enemy, amount: number, towerLevel: number, towerType: TowerType) {
    if (!enemy || !enemy.alive) return;
    const factor = damageFactor(towerType, enemy.config.type);
    const dealt = Math.max(1, Math.round(amount * factor));
    enemy.hp -= dealt;
    if (factor < 1) this.showResistFx(enemy);
    if (enemy.hp <= 0) this.killEnemy(enemy, towerLevel);
  }

  private showResistFx(enemy: Enemy) {
    if (!enemy || !enemy.alive) return;
    if (this.time.now < enemy.lastResistFx + TIMING.resistFxCooldown) return;
    enemy.lastResistFx = this.time.now;
    this.sparkFx(enemy.x, enemy.y - FX.resistOffsetY, FX.color.frost);
  }

  /* Punkty za zabójstwo: maksimum za wieżę podstawową, mniej za ulepszone. */
  private scoreForKill(type: EnemyType, towerLevel: number): number {
    const base = ENEMY_POINTS[type] || 10;
    const waveScale = 1 + SCORE_WAVE_STEP * Math.max(0, this.waveNumber - 1);
    const factor = LEVEL_SCORE_FACTOR[Math.max(0, Math.min(MAX_TOWER_LEVEL, towerLevel || 0))];
    return Math.round(base * waveScale * factor);
  }

  private killEnemy(enemy: Enemy, towerLevel: number) {
    enemy.alive = false;
    this.kills++;
    const points = this.scoreForKill(enemy.config.type, towerLevel);
    this.score += points;
    this.gold += enemy.config.gold;
    this.goldEarned += enemy.config.gold;
    this.waveGoldEarned += enemy.config.gold;
    this.enemiesAliveInWave--;
    gameAudio.enemyDeath(enemy.config.type);
    const style = ENEMY_STYLE[enemy.config.type];
    const aliveCount = this.enemies.length;
    const baseCount = ENEMY_VIEW[enemy.config.type].deathParticles;
    // Przy wielu wrogach na planszy cząstki są ograniczane — to efekt czysto wizualny.
    const count =
      aliveCount > FX.denseEnemies
        ? Math.min(baseCount, FX.denseParticles)
        : aliveCount > FX.busyEnemies
          ? Math.min(baseCount, FX.busyParticles)
          : baseCount;
    this.spawnParticles(enemy.x, enemy.y, style.color, count);
    if (enemy.config.type === 'boss') {
      this.cameras.main.shake(FX.shake.boss.ms, FX.shake.boss.intensity);
      this.setStatus(t('bossKilled', { gold: enemy.config.gold, points }));
    }
    if (enemy.config.type === 'megaboss') {
      this.cameras.main.shake(FX.shake.megaboss.ms, FX.shake.megaboss.intensity);
      this.setStatus(t('megaKilled', { gold: enemy.config.gold, points }));
    }
    this.removeEnemy(enemy);
    this.refreshHud();
    this.refreshTowerButtons();
    this.checkWaveComplete();
  }

  private checkWaveComplete(delayMs = 0) {
    if (this.gameEnded || !this.waveActive) return;
    if (this.spawnCursor < this.spawnQueue.length || this.enemiesAliveInWave > 0) return;
    if (delayMs > 0) {
      if (this.pendingWaveComplete) return;
      this.pendingWaveComplete = this.time.delayedCall(delayMs, () => {
        this.pendingWaveComplete = null;
        this.checkWaveComplete();
      });
      return;
    }

    const wave = this.waves[this.waveNumber - 1];
    this.waveGoldEarned += wave.bonus;
    this.gold += wave.bonus;
    this.goldEarned += wave.bonus;
    this.waveActive = false;
    this.setStatus(
      t('waveDone', { n: this.waveNumber, bonus: wave.bonus }),
      STATUS_HOLD.default,
      this.waveGoldEarned <= 0 ? 'danger' : 'default',
    );
    this.refreshHud();
    this.refreshTowerButtons();
    if (this.waveNumber >= this.waves.length) {
      this.gameEnded = true;
      this.time.delayedCall(TIMING.victoryDelay, () => this.endGame(true));
    }
  }

  private endGame(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.gameEnded = true;
    gameAudio.stopGame();
    this.cameras.main.fadeOut(TIMING.sceneFadeOut, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('VictoryScene', {
        won,
        waves: this.waveNumber,
        kills: this.kills,
        goldEarned: this.goldEarned,
        score: this.score,
        gold: this.gold,
        lives: Math.max(0, this.lives),
      });
    });
  }

  /* ------------------------------- efekty -------------------------------
     Cząsteczki, iskry, pierścienie i błyskawice to obiekty z puli animowane ręcznie
     w updateFx — bez tweenów i bez tworzenia obiektów przy każdym trafieniu. */
  private fxPool: Fx[] = [];
  private fxActive: Fx[] = [];
  private lightningPool: Phaser.GameObjects.Graphics[] = [];
  private lightningActive: { g: Phaser.GameObjects.Graphics; t: number; dur: number }[] = [];

  private acquireFx(kind: 'rect' | 'circle'): Fx {
    // Obiekt tego samego rodzaju (rect/circle) z puli, nowy tylko gdy pula jest pusta.
    for (let i = this.fxPool.length - 1; i >= 0; i--) {
      const fx = this.fxPool[i];
      if (fx.kind === kind) {
        const last = this.fxPool.length - 1;
        if (i !== last) this.fxPool[i] = this.fxPool[last];
        this.fxPool.length = last;
        fx.obj.setVisible(true).setActive(true);
        return fx;
      }
    }
    const obj =
      kind === 'rect'
        ? this.add.rectangle(0, 0, 4, 4, PALETTE.white).setDepth(DEPTH.FX)
        : this.add.circle(0, 0, 10, PALETTE.white).setDepth(DEPTH.FX);
    return { kind, obj, t: 0, dur: 1, x0: 0, y0: 0, x1: 0, y1: 0, s0: 1, s1: 1, a0: 1, a1: 0, ease: 0 };
  }

  private startFx(fx: Fx, x0: number, y0: number, x1: number, y1: number, s0: number, s1: number, a0: number, a1: number, dur: number, ease: number, depth: number) {
    fx.t = 0;
    fx.dur = dur;
    fx.x0 = x0; fx.y0 = y0; fx.x1 = x1; fx.y1 = y1;
    fx.s0 = s0; fx.s1 = s1; fx.a0 = a0; fx.a1 = a1;
    fx.ease = ease;
    fx.obj.setPosition(x0, y0).setScale(s0).setAlpha(a0).setDepth(depth);
    this.fxActive.push(fx);
  }

  private circleFx(x: number, y: number, radius: number, color: number, s0: number, s1: number, a0: number, a1: number, dur: number, depth: number) {
    const fx = this.acquireFx('circle');
    (fx.obj as Phaser.GameObjects.Arc).setRadius(radius).setFillStyle(color);
    this.startFx(fx, x, y, x, y, s0, s1, a0, a1, dur, 0, depth);
  }

  private explosionFx(x: number, y: number, radius: number) {
    this.circleFx(x, y, radius, FX.color.explosion, 0.25, 1, 0.5, 0, 320, DEPTH.FX);
    this.circleFx(x, y, radius * 0.45, FX.color.explosionCore, 0.2, 1, 0.9, 0, 260, DEPTH.FX + 1);
  }

  private frostFx(x: number, y: number) {
    this.circleFx(x, y, FX.frostRadius, FX.color.frost, 0.3, 1.1, 0.6, 0, 380, DEPTH.FX);
  }

  private sparkFx(x: number, y: number, color: number) {
    this.circleFx(x, y, FX.sparkRadius, color, 1, 0.1, 1, 0, 180, DEPTH.FX);
  }

  /** Animacja wszystkich efektów z puli; czas realny (efekty nie zwalniają przy pauzie tempa). */
  private updateFx(deltaMs: number) {
    const act = this.fxActive;
    for (let i = act.length - 1; i >= 0; i--) {
      const fx = act[i];
      fx.t += deltaMs;
      let k = fx.t / fx.dur;
      if (k >= 1) {
        fx.obj.setVisible(false).setActive(false);
        const last = act.length - 1;
        if (i !== last) act[i] = act[last];
        act.length = last;
        this.fxPool.push(fx);
        continue;
      }
      // ease: 0 = liniowo, 1 = Cubic.easeOut
      if (fx.ease === 1) {
        const u = 1 - k;
        k = 1 - u * u * u;
      }
      fx.obj.setPosition(fx.x0 + (fx.x1 - fx.x0) * k, fx.y0 + (fx.y1 - fx.y0) * k);
      fx.obj.setScale(fx.s0 + (fx.s1 - fx.s0) * k);
      fx.obj.setAlpha(fx.a0 + (fx.a1 - fx.a0) * k);
    }
    const la = this.lightningActive;
    for (let i = la.length - 1; i >= 0; i--) {
      const l = la[i];
      l.t += deltaMs;
      if (l.t >= l.dur) {
        l.g.setVisible(false);
        this.lightningPool.push(l.g);
        const last = la.length - 1;
        if (i !== last) la[i] = la[last];
        la.length = last;
        continue;
      }
      l.g.setAlpha(1 - l.t / l.dur);
    }
  }

  /* ------------------------------- pętla główna ------------------------------- */
  update(_time: number, delta: number) {
    this.topBar.restoreStatus();
    if (this.paused || this.gameEnded) {
      // HUD i karty wież odświeżają się także w pauzie (np. po sprzedaży lub ulepszeniu).
      this.flushHud();
      return;
    }
    const dt = Math.min(delta, TIMING.maxFrameMs) * this.gameSpeed;
    this.clock += dt;
    this.spawnQueuedEnemies();
    this.updateEnemies(dt);
    this.syncEnemyLoops();
    this.updateTowers();
    this.updateTurretHeads();
    this.updateProjectiles(dt);
    this.updateFx(Math.min(delta, TIMING.maxFrameMs));
    this.flushHud();
  }
}
