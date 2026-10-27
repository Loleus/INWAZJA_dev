import Phaser from 'phaser';
import {
  BUTTON,
  DEPTH,
  FONT_SIZE,
  PALETTE,
  START_GOLD,
  START_LIVES,
  STATUS_HOLD,
  TEXT_COLOR,
  TEXT_SHADOW,
  TEXTURE,
  TIMING,
  TOP_BAR,
  TOP_BAR_CY,
  TOTAL_WAVES,
  WORLD_Y,
} from '../../constants';
import { gameAudio } from '../../audio';
import { makeStoneSurfaceTexture } from '../../gfx/surfaces';
import { t } from '../../i18n';
import { toCss } from '../../utils/color';
import { addGlyph, addNeutralButton, drawBarDivider, drawStoneBar, textStyle } from '../common';

interface TopBarActions {
  pause(): void;
  speed(): void;
  /** `false` = akcja zablokowana (np. restart w trakcie fali). */
  restart(): boolean;
  /** `false` = akcja zablokowana (np. wyjście do menu w trakcie fali). */
  menu(): boolean;
  fullscreen(): void;
  sendWave(): void;
}

type PrompterTone = 'default' | 'danger';

const TB = TOP_BAR;
const P = TB.prompter;
const BUTTON_STEP = TB.button.w + TB.button.gap;
/** Szare przyciski od prawej krawędzi: pełny ekran, menu, restart, prędkość, pauza. */
const controlX = (indexFromRight: number) => TB.fullscreenX - indexFromRight * BUTTON_STEP;
const PAUSE_X = controlX(4);
const PROMPTER_TEXT = toCss(P.stroke);
const PROMPTER_DANGER_TEXT = toCss(PALETTE.red400);
const PROMPTER_DANGER_FILL = PALETTE.red900;
const PROMPTER_DANGER_STROKE = PALETTE.red500;

/**
 * Pasek górny sceny gry: liczniki (złoto, życia, punkty, fala), PROMPTER z przyciskiem FALA
 * po prawej stronie tekstu i szare przyciski sterujące przy prawej krawędzi.
 */
export class GameTopBar {
  private readonly scene: Phaser.Scene;
  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private scoreValue!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private prompterBg!: Phaser.GameObjects.Graphics;
  private waveButton!: Phaser.GameObjects.Rectangle;
  private waveFace: Phaser.GameObjects.Image | null = null;
  private waveHover!: Phaser.GameObjects.Rectangle;
  private waveLabel!: Phaser.GameObjects.Text;
  private speedButton!: Phaser.GameObjects.Rectangle;
  private speedText!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Rectangle;

  /** Ostatnio wyrenderowane wartości — tekst w Phaserze to nowa tekstura przy każdym setText. */
  private readonly shown = { gold: -1, lives: -1, wave: -1, score: -1 };
  private lastCounterAt = 0;
  private countersRight = -1;
  private statusUntil = 0;
  private tone: PrompterTone = 'default';
  private readonly prompterBox = { left: 0, top: 0, width: 0 };
  private readonly defaultStatus = t('shortcuts');

  constructor(scene: Phaser.Scene, actions: TopBarActions) {
    this.scene = scene;
    drawStoneBar(scene, TOP_BAR_CY, WORLD_Y, DEPTH.HUD);
    drawBarDivider(scene, WORLD_Y - 1, DEPTH.HUD);
    this.buildCounters();
    this.buildPrompter();
    this.buildControls(actions);
    this.buildWaveButton(actions.sendWave);
    this.layout();
    this.display(this.defaultStatus);
  }

  private buildCounters() {
    const scene = this.scene;
    const { row1, row2, colB } = TB;
    const counter = (x: number, y: number, value: string, size: number, color: string) =>
      scene.add.text(x, y, value, textStyle(size, color, true)).setOrigin(0, 0.5).setDepth(DEPTH.HUD);

    scene.add.image(TB.coin.x, row1, 'icon-coin').setDepth(DEPTH.HUD).setScale(TB.coin.scale);
    this.goldText = counter(TB.goldX, row1, '' + START_GOLD, FONT_SIZE.hudCounter, TEXT_COLOR.gold);
    scene.add.image(colB + TB.iconDx, row1, 'icon-heart').setDepth(DEPTH.HUD).setScale(TB.heartScale);
    this.livesText = counter(colB + TB.textDx, row1, '' + START_LIVES, FONT_SIZE.hudCounter, TEXT_COLOR.lives);

    /* Litera punktów jest o kilka pikseli niższa od nominalnego rozmiaru; współczynnik liczony
       z pomiaru, bo wysokość linii zależy od metryki fontu. Cyfry stoją tuż za literą,
       a litera jest wyśrodkowana pod ikoną złota. */
    const mark = counter(TB.coin.x, row2, t('scoreMark') + ':', FONT_SIZE.hudScoreMark, TEXT_COLOR.gold);
    mark.setFontSize(FONT_SIZE.hudScoreMark * ((mark.height - TB.scoreMarkShrink) / mark.height));
    const scoreValueX = mark.x + mark.width + TB.scoreGap;
    mark.setOrigin(0.5, 0.5);
    this.scoreValue = counter(scoreValueX, row2, '0', FONT_SIZE.hudCounterSmall, TEXT_COLOR.gold);
    scene.add.image(colB + TB.iconDx, row2, 'icon-wave').setDepth(DEPTH.HUD).setScale(TB.waveIconScale);
    this.waveText = counter(colB + TB.textDx, row2, '0/' + TOTAL_WAVES, FONT_SIZE.hudCounterSmall, TEXT_COLOR.waveCounter);
  }

  private buildPrompter() {
    this.prompterBg = this.scene.add.graphics().setDepth(DEPTH.HUD);
    this.statusText = this.scene.add
      .text(0, TOP_BAR_CY, '', { ...textStyle(FONT_SIZE.prompter, PROMPTER_TEXT), align: 'center', lineSpacing: P.lineSpacing })
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.HUD + 1);
  }

  private buildControls(actions: TopBarActions) {
    const scene = this.scene;
    /* Szare przyciski przy prawej krawędzi: kliknięty gra krótki dźwięk UI.
       Akcja może zwrócić `false` — wtedy jest zablokowana i gra własny alert (bez kliknięcia). */
    const button = (x: number, onClick: () => void | boolean) =>
      addNeutralButton(scene, x, TOP_BAR_CY, TB.button.w, TB.button.h, () => {
        const allowed = onClick();
        if (allowed !== false) gameAudio.uiClick();
      }).setDepth(DEPTH.HUD);
    const glyph = (x: number, label: string, size: number, bold = false) =>
      addGlyph(scene, x, TOP_BAR_CY, label, size, bold).setDepth(DEPTH.HUD + 1);

    button(controlX(0), actions.fullscreen);
    glyph(controlX(0), '⤢', FONT_SIZE.hudGlyph);
    button(controlX(1), actions.menu);
    glyph(controlX(1), '≡', FONT_SIZE.hudMenuGlyph);
    button(controlX(2), actions.restart);
    glyph(controlX(2), '↻', FONT_SIZE.hudGlyph);
    this.speedButton = button(controlX(3), actions.speed);
    this.speedText = glyph(controlX(3), speedLabel(1), FONT_SIZE.hudSpeed, true);
    this.pauseButton = button(PAUSE_X, actions.pause);
    const bar = TB.pauseBar;
    for (const dx of [-bar.dx, bar.dx]) {
      scene.add.rectangle(PAUSE_X + dx, TOP_BAR_CY, bar.w, bar.h, PALETTE.slate200).setDepth(DEPTH.HUD + 1);
    }
  }

  private buildWaveButton(onClick: () => void) {
    const scene = this.scene;
    const { w, h } = TB.wave;
    const style = BUTTON.primary;
    const source = TEXTURE.buttonStoneSource;
    const texture = makeStoneSurfaceTexture(scene, style.fill, w, h, source.width, source.height, TEXTURE.buttonGrain);
    this.waveFace = texture
      ? scene.add.image(0, TOP_BAR_CY, texture).setDisplaySize(w, h).setDepth(DEPTH.HUD + 1)
      : null;
    this.waveButton = scene.add
      .rectangle(0, TOP_BAR_CY, w, h, style.fill, texture ? 0 : 1)
      .setStrokeStyle(style.strokeWidth, style.stroke)
      .setDepth(DEPTH.HUD + 1)
      .setInteractive({ useHandCursor: true });
    this.waveHover = scene.add
      .rectangle(0, TOP_BAR_CY, w, h, PALETTE.black, 0)
      .setStrokeStyle(style.strokeWidth, style.hoverFrame, 1)
      .setAlpha(0)
      .setDepth(DEPTH.HUD + 2);
    this.waveLabel = scene.add
      .text(0, TOP_BAR_CY, t('wave'), textStyle(FONT_SIZE.waveButton, style.text, true))
      .setOrigin(0.5)
      .setShadow(0, TEXT_SHADOW.offsetY, TEXT_SHADOW.color, TEXT_SHADOW.blur, true, true)
      .setDepth(DEPTH.HUD + 2);

    const animate = (alpha: number) => {
      scene.tweens.killTweensOf(this.waveHover);
      scene.tweens.add({ targets: this.waveHover, alpha, duration: BUTTON.hoverTweenMs, ease: 'Sine.easeOut' });
    };
    this.waveButton.on('pointerover', () => animate(1));
    this.waveButton.on('pointerout', () => animate(0));
    this.waveButton.on('pointerdown', onClick);
  }

  /** Liczniki złota i punktów odświeżane najwyżej co TIMING.hudThrottle w trakcie fali. */
  updateCounters(gold: number, lives: number, wave: number, score: number, waveActive: boolean) {
    const now = this.scene.time.now;
    const canUpdate = now - this.lastCounterAt >= TIMING.hudThrottle || !waveActive;
    if (this.shown.gold !== gold && canUpdate) {
      this.shown.gold = gold;
      this.goldText.setText('' + gold);
    }
    if (this.shown.lives !== lives) {
      this.shown.lives = lives;
      this.livesText.setText('' + lives);
    }
    if (this.shown.wave !== wave) {
      this.shown.wave = wave;
      this.waveText.setText(wave + '/' + TOTAL_WAVES);
    }
    if (this.shown.score !== score && canUpdate) {
      this.shown.score = score;
      this.scoreValue.setText('' + score);
      this.lastCounterAt = now;
    }
    this.layout();
  }

  /** PROMPTER wypełnia przestrzeń między licznikami a pierwszym szarym przyciskiem. */
  private layout() {
    const countersRight = Math.max(
      this.goldText.x + this.goldText.displayWidth,
      this.livesText.x + this.livesText.displayWidth,
      this.scoreValue.x + this.scoreValue.displayWidth,
      this.waveText.x + this.waveText.displayWidth,
    );
    if (Math.abs(countersRight - this.countersRight) < 0.5) return;
    this.countersRight = countersRight;

    const left = countersRight + P.sideGap;
    const right = PAUSE_X - TB.button.w / 2 - P.sideGap;
    const width = right - left;
    const top = TOP_BAR_CY - P.height / 2;
    this.prompterBox.left = left;
    this.prompterBox.top = top;
    this.prompterBox.width = width;
    this.paintPrompter();

    const waveX = right - P.innerPad - TB.wave.w / 2;
    const textLeft = left + P.innerPad;
    const textRight = waveX - TB.wave.w / 2 - P.textGap;
    this.statusText.setX((textLeft + textRight) / 2);
    this.statusText.setWordWrapWidth(Math.max(P.minWrap, textRight - textLeft), true);
    this.fitText();

    for (const item of [this.waveButton, this.waveHover, this.waveLabel, this.waveFace]) {
      item?.setPosition(waveX, TOP_BAR_CY);
    }
  }

  /** Tło PROMPTERA: zielone domyślnie, czerwone dla komunikatów o błędach i blokadach. */
  private paintPrompter() {
    const { left, top, width } = this.prompterBox;
    if (width <= 0) return;
    const danger = this.tone === 'danger';
    this.prompterBg.clear();
    this.prompterBg.fillStyle(danger ? PROMPTER_DANGER_FILL : P.fill, danger ? P.fillAlpha + 0.2 : P.fillAlpha);
    this.prompterBg.fillRoundedRect(left, top, width, P.height, P.radius);
    this.prompterBg.lineStyle(P.strokeWidth, danger ? PROMPTER_DANGER_STROKE : P.stroke, 1);
    this.prompterBg.strokeRoundedRect(left, top, width, P.height, P.radius);
  }

  /** Dłuższe komunikaty dostają mniejszy font, a w ostateczności są skalowane. */
  private fitText() {
    const maxHeight = P.height - P.textMargin;
    let size: number = FONT_SIZE.prompter;
    this.statusText.setScale(1).setFontSize(size);
    while (this.statusText.height > maxHeight && size > FONT_SIZE.prompterMin) {
      size -= FONT_SIZE.prompterStep;
      this.statusText.setFontSize(size);
    }
    if (this.statusText.height > maxHeight) this.statusText.setScale(maxHeight / this.statusText.height);
  }

  private display(message: string, tone: PrompterTone = 'default') {
    const messageChanged = this.statusText.text !== message;
    const toneChanged = this.tone !== tone;
    if (!messageChanged && !toneChanged) return;
    this.tone = tone;
    if (messageChanged) {
      this.statusText.setText(message);
      this.fitText();
    }
    this.statusText.setColor(tone === 'danger' ? PROMPTER_DANGER_TEXT : PROMPTER_TEXT);
    this.paintPrompter();
  }

  showStatus(message: string, holdMs: number = STATUS_HOLD.default, tone: PrompterTone = 'default') {
    this.statusUntil = this.scene.time.now + holdMs;
    this.display(message, tone);
  }

  /** Po upływie czasu komunikatu wraca domyślna lista skrótów. */
  restoreStatus() {
    if (this.statusUntil > 0 && this.scene.time.now >= this.statusUntil) {
      this.statusUntil = 0;
      this.display(this.defaultStatus, 'default');
    }
  }

  setSpeed(speed: number) {
    this.speedText.setText(speedLabel(speed));
    this.speedButton.setStrokeStyle(BUTTON.neutral.strokeWidth, speed === 1 ? BUTTON.neutral.stroke : TB.speedActiveStroke);
  }

  setPaused(paused: boolean) {
    this.pauseButton.setStrokeStyle(TB.pausedStrokeWidth, paused ? TB.pausedStroke : BUTTON.neutral.stroke);
  }
}

function speedLabel(speed: number) {
  return speed + '×';
}
