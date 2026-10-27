import Phaser from 'phaser';
import {
  ARROW,
  BOARD_CY,
  CENTER_X,
  COLS,
  DEPTH,
  EXIT_ARROW,
  FONT_SIZE,
  LANE_ARROWS,
  ROWS,
  TEXT_COLOR,
  type ArrowMarker,
} from '../constants';
import { makeBoardStoneTexture } from '../gfx/surfaces';
import { cellCenter, isPath, tileTextureKey } from '../logic/board';
import { textStyle } from './common';

/** Plansza: jedna kamienna tekstura albo — bez CanvasTexture — kafelki komórka po komórce. */
export function drawMap(scene: Phaser.Scene, alpha: number, depthBase = 0) {
  const board = makeBoardStoneTexture(scene);
  if (board) {
    scene.add.image(CENTER_X, BOARD_CY, board).setDepth(depthBase + DEPTH.GRID).setAlpha(alpha);
    return;
  }
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const c = cellCenter(col, row);
      scene.add
        .image(c.x, c.y, tileTextureKey(col, row))
        .setDepth(depthBase + (isPath(col, row) ? DEPTH.PATH : DEPTH.GRID))
        .setAlpha(alpha);
    }
  }
}

/** Para strzałek (większa i mniejsza za nią), opcjonalnie pulsująca. */
function drawArrowPair(
  scene: Phaser.Scene,
  marker: ArrowMarker,
  texture: string,
  alpha: number,
  pulse: boolean,
  depthBase: number,
) {
  for (let i = 0; i < 2; i++) {
    const scale = ARROW.scale[i];
    const img = scene.add
      .image(marker.x + marker.dx * i * ARROW.spacing, marker.y + marker.dy * i * ARROW.spacing, texture)
      .setRotation(marker.angle)
      .setDepth(depthBase + DEPTH.PATH + 1)
      .setAlpha(alpha * ARROW.alpha[i])
      .setScale(scale);
    if (!pulse) continue;
    scene.tweens.add({
      targets: img,
      alpha: { from: alpha * ARROW.pulseAlphaFrom[i], to: alpha * ARROW.pulseAlphaTo[i] },
      scale: { from: scale * ARROW.pulseScaleFrom, to: scale * ARROW.pulseScaleTo },
      duration: ARROW.pulseMs + i * ARROW.pulseStepMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

/** Białe strzałki przy wjazdach trzech dróg. */
export function drawLaneArrows(scene: Phaser.Scene, alpha: number, pulse: boolean, depthBase = 0) {
  for (const entry of LANE_ARROWS) drawArrowPair(scene, entry, 'lane-arrow', alpha, pulse, depthBase);
}

/** Czerwone strzałki wyjścia do bazy z literą bazy pod nimi. */
export function drawExitArrows(scene: Phaser.Scene, alpha: number, pulse: boolean, depthBase = 0) {
  scene.add
    .text(
      EXIT_ARROW.x + ARROW.exitLetterDx,
      EXIT_ARROW.y,
      ARROW.exitLetter,
      textStyle(FONT_SIZE.exitLetter, TEXT_COLOR.exitLetter, true),
    )
    .setOrigin(0.5)
    .setDepth(depthBase + DEPTH.PATH + 0.5)
    .setAlpha(alpha * ARROW.exitLetterAlpha);
  drawArrowPair(scene, EXIT_ARROW, 'lane-arrow-exit', alpha, pulse, depthBase);
}
