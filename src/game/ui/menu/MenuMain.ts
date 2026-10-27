import Phaser from 'phaser';
import {
  BOARD_CY,
  BOARD_H,
  BUTTON,
  CARD,
  CENTER_X,
  DEPTH,
  ENEMY_SHADOW,
  ENEMY_STYLE,
  FONT,
  FONT_SIZE,
  GAME_W,
  MENU,
  MENU_DEPTH,
  OVERLAY,
  PALETTE,
  TEXT_COLOR,
  TEXT_SHADOW,
  TEXTURE,
  TITLE_FALLBACK_SHADOW,
  TOWER_INFO,
  TOWER_ORDER,
  TOWER_SPRITE,
  TOWER_STATS,
  UI_RESOLUTION,
  WORLD_Y,
} from '../../constants';
import { towerSpriteKey } from '../../gfx/sprites';
import { makeCamoTextTexture, makeIconShadowTexture, makeMenuStoneTexture } from '../../gfx/surfaces';
import { enemyName, t, towerEffect, towerName } from '../../i18n';
import { canAffect, damageLabel } from '../../logic/combat';
import { menuEnemies } from '../../logic/waves';
import { cardBackground } from '../../utils/color';
import { drawExitArrows, drawLaneArrows, drawMap } from '../board';
import { addCardShadow, addStars, textStyle } from '../common';

/** Tło menu: gwiazdki, przygaszona plansza ze strzałkami i kamienna nakładka. */
export function drawMenuBackground(scene: Phaser.Scene) {
  addStars(scene, MENU.stars, MENU_DEPTH.stars);
  drawMap(scene, MENU.boardAlpha, MENU_DEPTH.board);
  drawLaneArrows(scene, MENU.boardAlpha, false, MENU_DEPTH.board);
  drawExitArrows(scene, MENU.boardAlpha, false, MENU_DEPTH.board);

  const wash = OVERLAY.boardWash;
  const key = makeMenuStoneTexture(scene, wash.color, GAME_W, BOARD_H, wash.grain, wash.darkness);
  const layer = key
    ? scene.add.image(CENTER_X, BOARD_CY, key).setDisplaySize(GAME_W, BOARD_H)
    : scene.add.rectangle(CENTER_X, BOARD_CY, GAME_W, BOARD_H, wash.color);
  layer.setAlpha(wash.alpha).setDepth(MENU_DEPTH.wash);
}

/** Środek menu: tytuł, arsenał, przeciwnicy i przycisk startu. */
export function buildMenuMain(scene: Phaser.Scene, onStart: () => void) {
  const faceH = buildCamoTitle(scene);
  const titleBottom = MENU.title.cy + faceH / 2;
  const gapTop = MENU.title.cy - faceH / 2 - WORLD_Y;
  buildWeapons(scene, titleBottom + gapTop, onStart);
  buildEnemies(scene);
  buildStartButton(scene, onStart);
}

function addHeader(scene: Phaser.Scene, y: number, text: string) {
  return scene.add
    .text(CENTER_X, y, text, textStyle(FONT_SIZE.menuHeader, TEXT_COLOR.header, true))
    .setOrigin(0.5)
    .setShadow(0, TEXT_SHADOW.offsetY, TEXT_SHADOW.color, TEXT_SHADOW.blur, true, true);
}

/** Okienko: cień, kamienna faktura w kolorze ramki i zaokrąglona ramka. */
function addCard(scene: Phaser.Scene, x: number, y: number, width: number, height: number, borderColor: number) {
  addCardShadow(scene, x, y, width, height, CARD.cornerRadius);
  const texture = makeMenuStoneTexture(scene, cardBackground(borderColor), width, height, TEXTURE.stoneGrain, 0, CARD.cornerRadius);
  if (texture) scene.add.image(x, y, texture).setDisplaySize(width, height);
  scene.add
    .graphics()
    .lineStyle(1, borderColor, 1)
    .strokeRoundedRect(x - width / 2, y - height / 2, width, height, CARD.cornerRadius);
  /* Niewidoczny prostokąt jak dawniej — pole kliknięcia (karty broni startują grę). */
  return scene.add.rectangle(x, y, width, height, PALETTE.black, 0);
}

/**
 * Tytuł wypełniony zimowym kamuflażem, wypalony raz do tekstury, z chłodnym cieniem.
 * Bez canvasu — zwykły napis z cieniem. Zwraca wysokość tytułu na ekranie.
 */
function buildCamoTitle(scene: Phaser.Scene): number {
  const T = MENU.title;
  const size = makeCamoTextTexture(scene, T.key, t('title'), FONT_SIZE.title, FONT.title, UI_RESOLUTION);
  const container = scene.add.container(CENTER_X, T.cy).setScale(T.scale);
  if (!size) {
    const fallback = scene.add
      .text(0, 0, t('title'), textStyle(FONT_SIZE.title, TEXT_COLOR.light, true, FONT.title))
      .setOrigin(0.5)
      .setShadow(0, TITLE_FALLBACK_SHADOW.offsetY, TITLE_FALLBACK_SHADOW.color, TITLE_FALLBACK_SHADOW.blur, true, true);
    container.add(fallback);
    return fallback.displayHeight * T.scale;
  }
  container.add([
    scene.add.image(0, 0, T.key + '-shadow').setDisplaySize(size.shadowWidth, size.shadowHeight),
    scene.add.image(0, 0, T.key).setDisplaySize(size.width, size.height),
  ]);
  return size.height * T.scale;
}

/** Arsenał: 4 okienka broni pod tytułem, w odstępie równym odstępowi tytułu od paska. */
function buildWeapons(scene: Phaser.Scene, headerTop: number, onStart: () => void) {
  const W = MENU.weapons;
  const header = addHeader(scene, 0, t('weaponsHeader'));
  const headerY = headerTop + header.height / 2;
  header.setY(headerY);
  const dy = headerY - W.headerRef;
  const iconScale = MENU.weaponIconSize / TOWER_SPRITE.size;

  TOWER_ORDER.forEach((type, index) => {
    const info = TOWER_INFO[type];
    const stats = TOWER_STATS[type][0];
    const x = CENTER_X + (index - (TOWER_ORDER.length - 1) / 2) * W.spacing;
    const card = addCard(scene, x, W.cy + dy, W.cardW, W.cardH, info.color);
    scene.add.image(x, W.iconY + dy, towerSpriteKey(type)).setScale(iconScale);
    scene.add
      .text(x, W.nameY + dy, towerName(type).toUpperCase(), textStyle(FONT_SIZE.menuCardName, TEXT_COLOR.primary, true))
      .setOrigin(0.5, 1);
    scene.add
      .text(x, W.statY + dy, `${damageLabel(stats)} · ${t('range')} ${stats.range}`, textStyle(FONT_SIZE.menuCardStat, TEXT_COLOR.stat))
      .setOrigin(0.5);
    const effect = scene.add
      .text(x, W.effectY + dy, towerEffect(type), textStyle(FONT_SIZE.menuCardStat, TEXT_COLOR.effect))
      .setOrigin(0.5);
    for (const size of FONT_SIZE.menuCardEffectFallback) {
      if (effect.width > W.effectMaxW) effect.setFontSize(size);
    }
    card.setInteractive({ useHandCursor: true });
    card.on('pointerdown', onStart);
  });
}

/** Przeciwnicy: 5 okienek z ikoną w poświacie, HP i ikonami skutecznej broni. */
function buildEnemies(scene: Phaser.Scene) {
  const E = MENU.enemies;
  const glow = ENEMY_SHADOW.menu;
  addHeader(scene, E.headerY + E.dy, t('enemiesHeader'));

  menuEnemies().forEach((enemy, index) => {
    const style = ENEMY_STYLE[enemy.type];
    const x = E.x0 + index * E.spacing;
    addCard(scene, x, E.cy + E.dy, E.cardW, E.cardH, style.color);

    makeIconShadowTexture(scene, style.texture, style.texture + glow.suffix, glow.blur, ENEMY_SHADOW.color, 1, glow.passes);
    scene.add.image(x, E.iconY + E.dy + glow.dy, style.texture + glow.suffix).setScale(enemy.scale * glow.scale);
    scene.add.image(x, E.iconY + E.dy, style.texture).setScale(enemy.scale);
    scene.add
      .text(x, E.nameY + E.dy, enemyName(enemy.type), textStyle(FONT_SIZE.menuCardName, TEXT_COLOR.primary, true))
      .setOrigin(0.5, 1);
    scene.add.text(x, E.hpY + E.dy, enemy.hp, textStyle(FONT_SIZE.menuEnemyHp, TEXT_COLOR.stat)).setOrigin(0.5);

    const working = TOWER_ORDER.filter((type) => canAffect(type, enemy.type));
    working.forEach((type, i) => {
      const ix = x + (i - (working.length - 1) / 2) * E.towerStep;
      scene.add.image(ix, E.towersY + E.dy, towerSpriteKey(type)).setScale(E.towerScale);
    });
  });
}

/** Przycisk startu: tło, ramka i napis w jednym kontenerze skalowanym po najechaniu. */
function buildStartButton(scene: Phaser.Scene, onStart: () => void) {
  const S = MENU.start;
  const root = scene.add.container(CENTER_X, S.y).setDepth(DEPTH.PANEL);
  /* Twarz i ramka mają promień jak w oknie PROMPTERA (S.radius), nie jak okienka menu. */
  const face = scene.add.image(0, 0, makeMenuStoneTexture(scene, BUTTON.primary.fill, S.w, S.h, TEXTURE.buttonGrain, 0, S.radius));
  face.setDisplaySize(S.w, S.h);
  const frame = scene.add
    .graphics()
    .lineStyle(S.strokeWidth, BUTTON.primary.stroke, S.strokeAlpha)
    .strokeRoundedRect(-S.w / 2, -S.h / 2, S.w, S.h, S.radius);
  const label = scene.add
    .text(0, 0, t('startButton'), textStyle(FONT_SIZE.startButton, BUTTON.primary.text, true))
    .setOrigin(0.5)
    .setShadow(0, TEXT_SHADOW.offsetY, TEXT_SHADOW.color, TEXT_SHADOW.blur, true, true);
  const hit = scene.add.zone(0, 0, S.w + S.hitPadX, S.h + S.hitPadY).setInteractive({ useHandCursor: true });
  root.add([addCardShadow(scene, 0, 0, S.w, S.h, S.radius), face, frame, label, hit]);

  let tween: Phaser.Tweens.Tween | null = null;
  const animate = (scale: number) => {
    tween?.stop();
    tween = scene.tweens.add({ targets: root, scaleX: scale, scaleY: scale, duration: S.hoverMs, ease: 'Sine.easeOut' });
  };
  hit.on('pointerover', () => animate(S.hoverScale));
  hit.on('pointerout', () => animate(1));
  hit.on('pointerdown', onStart);
}
