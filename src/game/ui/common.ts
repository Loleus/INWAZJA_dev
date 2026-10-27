import Phaser from 'phaser';
import {
  BUTTON,
  CARD,
  CENTER_X,
  ENEMY_STYLE,
  FONT,
  GAME_H,
  GAME_W,
  OVERLAY,
  PALETTE,
  TEXTURE,
  UI_RESOLUTION,
} from '../constants';
import { makeMenuCardShadow, makeStoneSurfaceTexture } from '../gfx/surfaces';
import { cardBackground } from '../utils/color';

export type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

export function textStyle(size: number, color: string, bold = false, fontFamily: string = FONT.ui): TextStyle {
  return {
    fontFamily,
    fontSize: size + 'px',
    color,
    fontStyle: bold ? 'bold' : 'normal',
    resolution: UI_RESOLUTION,
  };
}

/** Pasek w kolorze i fakturze okienka czołgu z menu. */
export function drawStoneBar(scene: Phaser.Scene, centerY: number, height: number, depth: number) {
  const color = cardBackground(ENEMY_STYLE.tank.color);
  const { width, height: sourceHeight } = TEXTURE.barStoneSource;
  const key = makeStoneSurfaceTexture(scene, color, GAME_W, height, width, sourceHeight);
  if (key) return scene.add.image(CENTER_X, centerY, key).setDisplaySize(GAME_W, height).setDepth(depth);
  return scene.add.rectangle(CENTER_X, centerY, GAME_W, height, color, 1).setDepth(depth);
}

/** Linia oddzielająca pasek od planszy. */
export function drawBarDivider(scene: Phaser.Scene, y: number, depth: number) {
  const { color, thickness } = OVERLAY.barDivider;
  return scene.add.rectangle(CENTER_X, y, GAME_W, thickness, color).setDepth(depth);
}

/** Miękki cień wokół całej bryły okienka lub przycisku menu. */
export function addCardShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number = CARD.shadowRadius,
) {
  const key = makeMenuCardShadow(scene, width, height, cornerRadius);
  if (key) return scene.add.image(x, y, key).setDisplaySize(width + CARD.shadowPad * 2, height + CARD.shadowPad * 2);
  const { color, alpha, offsetY } = OVERLAY.cardShadowFallback;
  return scene.add.rectangle(x, y + offsetY, width, height, color, alpha);
}

/** Szary przycisk sterujący z podświetleniem po najechaniu. */
export function addNeutralButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  onClick: () => void,
  fillAlpha = 1,
) {
  const style = BUTTON.neutral;
  const bg = scene.add
    .rectangle(x, y, width, height, style.fill, fillAlpha)
    .setStrokeStyle(style.strokeWidth, style.stroke)
    .setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => bg.setFillStyle(style.hover));
  bg.on('pointerout', () => bg.setFillStyle(style.fill));
  bg.on('pointerdown', onClick);
  return bg;
}

/** Ikona tekstowa na szarym przycisku. */
export function addGlyph(scene: Phaser.Scene, x: number, y: number, label: string, size: number, bold = false) {
  return scene.add.text(x, y, label, textStyle(size, BUTTON.neutral.glyph, bold)).setOrigin(0.5);
}

export function toggleFullscreen(scene: Phaser.Scene) {
  try {
    scene.scale.toggleFullscreen();
  } catch {
    /* przeglądarka może odmówić bez gestu użytkownika */
  }
}

/** Losowe gwiazdki tła. */
export function addStars(
  scene: Phaser.Scene,
  config: { count: number; radius: readonly number[]; alpha: readonly number[] },
  depth?: number,
) {
  for (let i = 0; i < config.count; i++) {
    const star = scene.add.circle(
      Phaser.Math.Between(0, GAME_W),
      Phaser.Math.Between(0, GAME_H),
      Phaser.Math.FloatBetween(config.radius[0], config.radius[1]),
      PALETTE.white,
      Phaser.Math.FloatBetween(config.alpha[0], config.alpha[1]),
    );
    if (depth !== undefined) star.setDepth(depth);
  }
}
