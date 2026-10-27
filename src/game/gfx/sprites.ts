/* =========================================================================================
   Tekstury rysowane proceduralnie na starcie gry: kafelki terenu, wieże 4×3, pociski,
   wrogowie, ikony HUD i flagi języków. Gra nie potrzebuje żadnych plików graficznych.
   ========================================================================================= */
import Phaser from 'phaser';
import {
  CELL,
  ENEMY_VIEW,
  MAX_TOWER_LEVEL,
  MENU,
  PALETTE,
  PROJECTILE,
  TEXTURE,
  TOWER_INFO,
  TOWER_ORDER,
  TOWER_SPRITE,
  UI_RESOLUTION,
} from '../constants';
import type { TowerType } from '../types';

type CornerDir = 'ne' | 'nw' | 'se' | 'sw';

/** Ścieżka „wszystko oprócz klina w narożniku” — wspólna geometria kafelków zakrętów. */
function cornerCutPath(g: Phaser.GameObjects.Graphics, corner: CornerDir) {
  const S = CELL;
  const R = TEXTURE.cornerRadius;
  g.beginPath();
  if (corner === 'sw') {
    g.moveTo(0, 0);
    g.lineTo(S, 0);
    g.lineTo(S, S);
    g.lineTo(R, S);
    g.arc(R, S - R, R, Math.PI / 2, Math.PI, false);
  } else if (corner === 'se') {
    g.moveTo(0, 0);
    g.lineTo(S, 0);
    g.lineTo(S, S - R);
    g.arc(S - R, S - R, R, 0, Math.PI / 2, false);
    g.lineTo(0, S);
  } else if (corner === 'nw') {
    g.moveTo(0, S);
    g.lineTo(S, S);
    g.lineTo(S, 0);
    g.lineTo(R, 0);
    g.arc(R, R, R, -Math.PI / 2, -Math.PI, true);
  } else {
    g.moveTo(0, 0);
    g.lineTo(S - R, 0);
    g.arc(S - R, R, R, -Math.PI / 2, 0, false);
    g.lineTo(S, S);
    g.lineTo(0, S);
  }
  g.closePath();
}

function buildTiles(g: Phaser.GameObjects.Graphics) {
  const tones = [
    { list: TEXTURE.grass, key: 'tile-grass' },
    { list: TEXTURE.sand, key: 'tile-path' },
  ];
  for (const { list, key } of tones) {
    list.forEach((tone, i) => {
      g.clear();
      g.fillStyle(tone.base, 1);
      g.fillRect(0, 0, CELL, CELL);
      g.lineStyle(1, tone.edge, 1);
      g.strokeRect(0.5, 0.5, CELL - 1, CELL - 1);
      g.generateTexture(i === 0 ? key : key + '2', CELL, CELL);
    });
  }

  /* Kafelki zakrętów: droga z trawą w kącie i trawa z kawałkiem drogi — 4 kierunki x 2 tony. */
  const dirs: CornerDir[] = ['ne', 'nw', 'se', 'sw'];
  for (let tone = 0; tone < 2; tone++) {
    const suffix = tone === 0 ? '' : '-b';
    const grass = TEXTURE.grass[tone];
    const sand = TEXTURE.sand[tone];
    for (const dir of dirs) {
      // kafelek drogi: tło trawy, jezdnia z zaokrąglonym narożnikiem
      g.clear();
      g.fillStyle(grass.base, 1);
      g.fillRect(0, 0, CELL, CELL);
      cornerCutPath(g, dir);
      g.fillStyle(sand.base, 1);
      g.fillPath();
      cornerCutPath(g, dir);
      g.lineStyle(1, sand.edge, 1);
      g.strokePath();
      g.generateTexture('tile-corner-' + dir + suffix, CELL, CELL);

      // kafelek trawy: tło jezdni, klin trawy w narożniku
      g.clear();
      g.fillStyle(sand.base, 1);
      g.fillRect(0, 0, CELL, CELL);
      cornerCutPath(g, dir);
      g.fillStyle(grass.base, 1);
      g.fillPath();
      cornerCutPath(g, dir);
      g.lineStyle(1, grass.edge, 1);
      g.strokePath();
      g.generateTexture('tile-inner-' + dir + suffix, CELL, CELL);
    }
  }
}

/** Pełny sprite broni (korpus z głowicą) — statyczne ikony interfejsu. */
export function towerSpriteKey(type: TowerType, level = 0): string {
  return 'tower-' + type + (level === 0 ? '' : '-l' + (level + 1));
}

/** Korpus wieży — warstwa statyczna. */
export function towerBodyKey(type: TowerType, level: number): string {
  return towerSpriteKey(type, level) + TOWER_SPRITE.bodySuffix;
}

/** Głowica wieży — warstwa obracana wokół środka oka celowniczego. */
export function towerHeadKey(type: TowerType, level: number): string {
  return towerSpriteKey(type, level) + TOWER_SPRITE.headSuffix;
}

/** Symbol broni wystający z korpusu. Wszystkie mają tę samą wysokość i są wyśrodkowane
    na osi wieży, więc ikony wszystkich broni wyglądają tak samo. */
function drawGlyph(g: Phaser.GameObjects.Graphics, type: TowerType) {
  const S = TOWER_SPRITE;
  const c = S.size / 2;
  g.fillStyle(PALETTE.slate100, 1);
  if (type === 'arrow') {
    g.fillTriangle(c, S.glyphTop, 17, 8, 27, 8);
    g.fillRect(20, 5, 4, S.glyphBottom - 5);
  } else if (type === 'cannon') {
    g.fillRoundedRect(16, S.glyphTop, 12, S.glyphBottom - S.glyphTop, 5);
  } else if (type === 'frost') {
    g.fillTriangle(c, S.glyphTop, 15, S.glyphBottom, 29, S.glyphBottom);
  } else {
    g.fillPoints(
      [
        { x: 23.4, y: S.glyphTop },
        { x: 16.4, y: 11 },
        { x: 20.6, y: 11 },
        { x: 17.8, y: S.glyphBottom },
        { x: 27.6, y: 9 },
        { x: 22.7, y: 9 },
      ],
      true,
    );
  }
}

/** Korpus: poświata i miękkie cienie na zewnątrz oraz płyta blachy w kolorze typu. */
function drawTowerBody(g: Phaser.GameObjects.Graphics, type: TowerType, level: number) {
  const S = TOWER_SPRITE;
  const c = S.size / 2;
  const color = TOWER_INFO[type].color;
  if (level === MAX_TOWER_LEVEL) {
    g.fillStyle(color, S.eye.halo);
    g.fillCircle(c, c, S.eye.ring);
  }
  const grow = level === MAX_TOWER_LEVEL ? 1 : 0;
  const inset = S.body.inset - grow;
  const size = S.body.size + grow * 2;
  S.shadowFade.forEach((alpha, i) => {
    const t = S.shadowStep / 2 + i * S.shadowStep;
    g.lineStyle(S.shadowStep, S.body.fill, alpha);
    g.strokeRoundedRect(inset - t, inset - t, size + t * 2, size + t * 2, S.body.radius + t);
  });
  g.fillStyle(color, 1);
  g.fillRoundedRect(inset, inset, size, size, S.body.radius);
  g.fillStyle(PALETTE.black, level * S.levelDarken);
  g.fillRoundedRect(inset, inset, size, size, S.body.radius);
  drawPlateShading(g, inset, size);
}

/** Blacha: koncentryczne fazowanie jednakowe na wszystkich czterech bokach kwadratu. */
function drawPlateShading(g: Phaser.GameObjects.Graphics, inset: number, size: number) {
  const { radius } = TOWER_SPRITE.body;
  const { outerRim, bevelLight, bevelSoft, innerGroove } = TOWER_SPRITE.sheet;
  const frame = (ring: { inset: number; width: number; alpha: number }, color: number) => {
    const d = ring.inset;
    g.lineStyle(ring.width, color, ring.alpha);
    g.strokeRoundedRect(inset + d, inset + d, size - d * 2, size - d * 2, Math.max(2, radius - d));
  };
  frame(outerRim, PALETTE.black);
  frame(bevelLight, PALETTE.white);
  frame(bevelSoft, PALETTE.white);
  frame(innerGroove, PALETTE.black);
}

/** Głowica: symbol broni i oko celownicze. Wszystko w okręgu o promieniu `size/2 - 1`,
    więc obrót wokół środka nigdy nie obcina grafiki. */
function drawTowerHead(g: Phaser.GameObjects.Graphics, type: TowerType, level: number) {
  const S = TOWER_SPRITE;
  const shade = S.headShade;
  const c = S.size / 2;
  drawGlyph(g, type);
  g.fillStyle(PALETTE.black, shade.halo);
  g.fillCircle(c, c, S.eye.outer + shade.haloGrow);
  g.fillStyle(PALETTE.slate50, 1);
  g.fillCircle(c, c, S.eye.outer);
  g.lineStyle(1.1, PALETTE.black, shade.rim);
  g.strokeCircle(c, c, S.eye.outer - shade.rimInset);
  g.lineStyle(1, PALETTE.black, shade.rim2);
  g.strokeCircle(c, c, S.eye.outer - shade.rim2Inset);
  g.fillStyle(TOWER_INFO[type].color, 1);
  g.fillCircle(c, c, S.eye.pupil);
  if (level >= 1) {
    g.fillStyle(PALETTE.amber400, 1);
    g.fillCircle(c, c, S.eye.core);
  }
  if (level === MAX_TOWER_LEVEL) {
    g.lineStyle(S.eye.ringWidth, S.upgrade, S.eye.ringAlpha);
    g.strokeCircle(c, c, S.eye.ring);
  }
}

/** Wieża składa się z dwóch warstw: korpusu i obracanej głowicy.
    Tekstura pełna (oba elementy naraz) obsługuje statyczne ikony interfejsu. */
function buildTowers(g: Phaser.GameObjects.Graphics) {
  const size = TOWER_SPRITE.size;
  for (const type of TOWER_ORDER) {
    for (let level = 0; level <= MAX_TOWER_LEVEL; level++) {
      g.clear();
      drawTowerBody(g, type, level);
      drawTowerHead(g, type, level);
      g.generateTexture(towerSpriteKey(type, level), size, size);
      g.clear();
      drawTowerBody(g, type, level);
      g.generateTexture(towerBodyKey(type, level), size, size);
      g.clear();
      drawTowerHead(g, type, level);
      g.generateTexture(towerHeadKey(type, level), size, size);
    }
  }
}

function buildProjectiles(g: Phaser.GameObjects.Graphics) {
  buildArrowBolt(g);
  buildCannonBomb(g);
  buildFrostShard(g);
  buildLightningBolt(g);
}

/** Strzała: ciemny spód pod korpusem i rozbłysk na grzbiecie dają wrażenie bryły. */
function buildArrowBolt(g: Phaser.GameObjects.Graphics) {
  const P = PROJECTILE.arrow;
  g.clear();
  g.fillStyle(P.shade, 1);
  g.fillTriangle(18, 8.2, 2, 3.2, 2, 13.2);
  g.fillRect(8, 6.2, 8, 4);
  g.fillStyle(P.base, 1);
  g.fillTriangle(17.2, 7, 2, 2, 2, 11.4);
  g.fillRect(8, 5, 8, 3.6);
  g.fillStyle(P.shine, 0.5);
  g.fillTriangle(15.6, 6.4, 4.4, 3.1, 4.4, 4.6);
  g.generateTexture('proj-arrow', P.w, P.h);
}

/** Bomba Fat Man w barwie czołgu: skrzynkowe stateczniki, zwężany ogon i bulwiasty korpus.
    Dziób skierowany w prawo — lot obraca teksturę w stronę celu. */
function buildCannonBomb(g: Phaser.GameObjects.Graphics) {
  const P = PROJECTILE.cannon;
  const cy = P.h / 2;
  g.clear();
  // stateczniki ogonowe
  g.fillStyle(P.deep, 1);
  g.fillPoints([{ x: 0, y: 1.2 }, { x: 6.4, y: 4.2 }, { x: 6.4, y: 9.8 }, { x: 0, y: 12.8 }], true);
  g.fillStyle(P.shade, 1);
  g.fillPoints([{ x: 1.4, y: 3 }, { x: 6.4, y: 5 }, { x: 6.4, y: 9 }, { x: 1.4, y: 11 }], true);
  // zwężany ogon łączący stateczniki z korpusem
  g.fillStyle(P.shade, 1);
  g.fillPoints([{ x: 4.6, y: 3.4 }, { x: 13, y: 1.6 }, { x: 13, y: 12.4 }, { x: 4.6, y: 10.6 }], true);
  // korpus: ciemna bryła, barwa bazowa, cień u dołu i światło u góry
  g.fillStyle(P.shade, 1);
  g.fillEllipse(13.6, cy + 0.6, 16, 12.6);
  g.fillStyle(P.base, 1);
  g.fillEllipse(13.6, cy, 15.2, 11.8);
  g.fillStyle(PALETTE.black, 0.2);
  g.fillEllipse(12.8, cy + 3, 11.5, 4.4);
  g.fillStyle(P.shine, 0.5);
  g.fillEllipse(14.4, cy - 2.4, 8.6, 3.8);
  // pas równikowy i rozbłysk na dziobie
  g.fillStyle(P.deep, 0.75);
  g.fillRect(10.4, 1.9, 1.8, 10.2);
  g.fillStyle(P.spark, 0.6);
  g.fillCircle(19.2, cy - 1.6, 1.1);
  g.generateTexture('proj-cannon', P.w, P.h);
}

/** Kryształ lodu: dwie fasety o różnej jasności plus rozbłysk — zamiast płaskiego rombu. */
function buildFrostShard(g: Phaser.GameObjects.Graphics) {
  const P = PROJECTILE.frost;
  g.clear();
  g.fillStyle(P.shade, 1);
  g.fillTriangle(8, 0, 16, 8, 8, 16);
  g.fillStyle(P.base, 1);
  g.fillTriangle(8, 0, 0, 8, 8, 16);
  g.fillStyle(P.deep, 0.35);
  g.fillTriangle(8, 16, 13.4, 8.8, 8, 8.8);
  g.fillStyle(P.shine, 0.55);
  g.fillTriangle(8, 2.6, 3.8, 8, 8, 8);
  g.generateTexture('proj-frost', P.w, P.h);
}

/** Błyskawica: zygzak skierowany dziobem w prawo (oś X lotu), ciemna bryła pod spodem
    i rozjaśniony rdzeń wzdłuż grzbietu. Kształt obrócony o 90° względem pionowego symbolu wieży. */
function buildLightningBolt(g: Phaser.GameObjects.Graphics) {
  const P = PROJECTILE.lightning;
  const bolt = [
    { x: 0, y: 6.95 },
    { x: 8, y: 11.85 },
    { x: 8, y: 8.35 },
    { x: 18, y: 11.15 },
    { x: 7, y: 4.15 },
    { x: 7, y: 7.65 },
  ];
  g.clear();
  g.fillStyle(P.shade, 1);
  g.fillPoints(bolt.map((p) => ({ x: p.x + 0.6, y: p.y + 0.6 })), true);
  g.fillStyle(P.base, 1);
  g.fillPoints(bolt, true);
  g.fillStyle(P.shine, 0.6);
  g.fillPoints([{ x: 1.4, y: 7.3 }, { x: 7.3, y: 10.4 }, { x: 7.3, y: 8.8 }, { x: 12.4, y: 10 }], true);
  g.generateTexture('proj-lightning', P.w, P.h);
}

function hexRing(cx: number, cy: number, r: number): { x: number; y: number }[] {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

function stubLegs(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  count: number,
  innerR: number,
  outerR: number,
  spread: number,
  dark: number,
  color: number,
) {
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count;
    const x0 = cx + Math.cos(a - spread) * innerR;
    const y0 = cy + Math.sin(a - spread) * innerR;
    const x1 = cx + Math.cos(a + spread) * innerR;
    const y1 = cy + Math.sin(a + spread) * innerR;
    const x2 = cx + Math.cos(a) * outerR;
    const y2 = cy + Math.sin(a) * outerR;
    g.fillStyle(dark, 1);
    g.fillTriangle(x0, y0, x1, y1, x2, y2);
    g.fillStyle(color, 1);
    g.fillTriangle(
      cx + Math.cos(a - spread * 0.55) * (innerR + 0.6),
      cy + Math.sin(a - spread * 0.55) * (innerR + 0.6),
      cx + Math.cos(a + spread * 0.55) * (innerR + 0.6),
      cy + Math.sin(a + spread * 0.55) * (innerR + 0.6),
      cx + Math.cos(a) * (outerR - 0.8),
      cy + Math.sin(a) * (outerR - 0.8),
    );
  }
}

function metalShell(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  dark: number,
  mid: number,
  shine: number,
) {
  g.fillStyle(dark, 1);
  g.fillPoints(hexRing(cx, cy, r), true);
  g.fillStyle(mid, 1);
  g.fillPoints(hexRing(cx, cy, r - 1.6), true);
  g.lineStyle(1.4, dark, 1);
  g.strokePoints(hexRing(cx, cy, r), true, true);
  g.fillStyle(shine, 0.55);
  g.fillTriangle(
    cx - r * 0.15,
    cy - r * 0.55,
    cx + r * 0.35,
    cy - r * 0.25,
    cx - r * 0.45,
    cy - r * 0.05,
  );
}

function buildEnemies(g: Phaser.GameObjects.Graphics) {
  // podstawowy — duży blaszany korpus, krótkie kolce-odnóża, bez oczu
  g.clear();
  stubLegs(g, 15, 15, 6, 10, 14.5, 0.28, 0x7f1d1d, 0xef4444);
  metalShell(g, 15, 15, 11.5, 0xb91c1c, 0xef4444, 0xfecaca);
  g.fillStyle(0x7f1d1d, 1);
  g.fillPoints(hexRing(15, 15, 5), true);
  g.fillStyle(0xfca5a5, 1);
  g.fillPoints(hexRing(15, 15, 2.4), true);
  g.generateTexture('enemy-basic', ENEMY_VIEW.basic.size, ENEMY_VIEW.basic.size);

  // szybki — większy korpus, krótkie skrzydła-blachy, 4 oczy
  g.clear();
  g.fillStyle(0xb45309, 1);
  g.fillEllipse(14, 5.5, 8, 9);
  g.fillEllipse(14, 22.5, 8, 9);
  g.fillEllipse(5.5, 14, 9, 8);
  g.fillEllipse(22.5, 14, 9, 8);
  g.fillStyle(0xfbbf24, 1);
  g.fillEllipse(14, 5.5, 5.5, 6);
  g.fillEllipse(14, 22.5, 5.5, 6);
  g.fillEllipse(5.5, 14, 6, 5.5);
  g.fillEllipse(22.5, 14, 6, 5.5);
  g.fillStyle(0xfffbeb, 0.75);
  g.fillTriangle(14, 2, 16.5, 7, 11.5, 7);
  g.fillTriangle(14, 26, 16.5, 21, 11.5, 21);
  g.fillTriangle(2, 14, 7, 16.5, 7, 11.5);
  g.fillTriangle(26, 14, 21, 16.5, 21, 11.5);
  metalShell(g, 14, 14, 9.5, 0xd97706, 0xf59e0b, 0xfff7ed);
  g.fillStyle(0x78350f, 1);
  g.fillCircle(11.2, 11.2, 1.55);
  g.fillCircle(16.8, 11.2, 1.55);
  g.fillCircle(11.2, 16.8, 1.55);
  g.fillCircle(16.8, 16.8, 1.55);
  g.fillStyle(0xfffbeb, 1);
  g.fillCircle(11.2, 11.2, 0.7);
  g.fillCircle(16.8, 11.2, 0.7);
  g.fillCircle(11.2, 16.8, 0.7);
  g.fillCircle(16.8, 16.8, 0.7);
  g.generateTexture('enemy-fast', ENEMY_VIEW.fast.size, ENEMY_VIEW.fast.size);

  // czołg — szeroki sześciokątny pancerz, krótkie kolce
  g.clear();
  stubLegs(g, 17, 17, 6, 13, 16.5, 0.26, 0x1e293b, 0x64748b);
  g.fillStyle(0x1e293b, 1);
  g.fillPoints(hexRing(17, 17, 15.2), true);
  g.fillStyle(0x475569, 1);
  g.fillPoints(hexRing(17, 17, 13.4), true);
  g.fillStyle(0x64748b, 1);
  g.fillPoints(hexRing(17, 17, 11.2), true);
  g.lineStyle(1.6, 0x0f172a, 1);
  g.strokePoints(hexRing(17, 17, 15.2), true, true);
  g.lineStyle(1.1, 0x334155, 1);
  g.strokePoints(hexRing(17, 17, 8.5), true, true);
  g.fillStyle(0xcbd5e1, 0.5);
  g.fillTriangle(17, 6, 22, 12, 12, 14);
  g.fillStyle(0x94a3b8, 1);
  g.fillPoints(hexRing(17, 17, 4), true);
  g.generateTexture('enemy-tank', ENEMY_VIEW.tank.size, ENEMY_VIEW.tank.size);

  // boss — blaszana biedronka: duża kopuła, krótkie kolce, kropki
  g.clear();
  stubLegs(g, 24, 24, 6, 18, 23, 0.22, 0x5b21b6, 0xa855f7);
  metalShell(g, 24, 24, 18.5, 0x6d28d9, 0xa855f7, 0xe9d5ff);
  g.fillStyle(0x5b21b6, 1);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI * 2) / 6;
    g.fillCircle(24 + Math.cos(a) * 9, 24 + Math.sin(a) * 9, 3.4);
  }
  g.fillCircle(24, 24, 3);
  g.lineStyle(1.5, 0x4c1d95, 1);
  g.strokeCircle(24, 24, 18.5);
  g.generateTexture('enemy-boss', ENEMY_VIEW.boss.size, ENEMY_VIEW.boss.size);

  // mega boss — blaszana muszla, ostre pierścienie
  g.clear();
  stubLegs(g, 32, 32, 6, 26, 31, 0.18, 0x9f1239, 0xe11d48);
  g.fillStyle(0x9f1239, 1);
  g.fillPoints(hexRing(32, 32, 26.5), true);
  g.fillStyle(0xe11d48, 1);
  g.fillPoints(hexRing(32, 32, 23.5), true);
  g.lineStyle(2.2, 0x7f1d1d, 1);
  g.strokePoints(hexRing(32, 32, 26.5), true, true);
  g.lineStyle(2.4, 0x9f1239, 1);
  g.strokePoints(hexRing(32, 32, 17), true, true);
  g.strokePoints(hexRing(32, 32, 10), true, true);
  g.fillStyle(0xbe123c, 1);
  g.fillPoints(hexRing(32, 32, 5.5), true);
  g.fillStyle(0xfda4af, 0.55);
  g.fillTriangle(32, 14, 40, 24, 24, 26);
  g.fillStyle(0xfda4af, 1);
  g.fillCircle(32, 32, 2.4);
  g.generateTexture('enemy-megaboss', ENEMY_VIEW.megaboss.size, ENEMY_VIEW.megaboss.size);
}

function buildIcons(g: Phaser.GameObjects.Graphics) {
  g.clear();
  g.fillStyle(0xb45309, 1);
  g.fillCircle(11, 11, 11);
  g.fillStyle(0xfbbf24, 1);
  g.fillCircle(11, 11, 9);
  g.fillStyle(0xfde68a, 1);
  g.fillCircle(11, 11, 5);
  g.generateTexture('icon-coin', 22, 22);

  g.clear();
  g.fillStyle(0xef4444, 1);
  g.fillCircle(7, 7, 7);
  g.fillCircle(17, 7, 7);
  g.fillTriangle(0, 8, 24, 8, 12, 22);
  g.fillStyle(0xfca5a5, 0.8);
  g.fillCircle(6, 6, 2.5);
  g.generateTexture('icon-heart', 24, 22);

  g.clear();
  g.lineStyle(3, 0x60a5fa, 1);
  g.beginPath();
  g.moveTo(2, 14);
  g.lineTo(7, 14);
  g.lineTo(10, 6);
  g.lineTo(14, 19);
  g.lineTo(17, 12);
  g.lineTo(22, 12);
  g.strokePath();
  g.generateTexture('icon-wave', 24, 24);

  // chevron strzałki kierunku drogi
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(2, 1, 14, 9, 2, 17);
  g.fillTriangle(2, 1, 8, 9, 2, 17);
  g.generateTexture('lane-arrow', 16, 18);

  // czerwony chevron wyjścia (ostatni kafelek przed krawędzią ekranu)
  g.clear();
  g.fillStyle(0xef4444, 1);
  g.fillTriangle(2, 1, 14, 9, 2, 17);
  g.fillTriangle(2, 1, 8, 9, 2, 17);
  g.generateTexture('lane-arrow-exit', 16, 18);
}

/* -----------------------------------------------------------------------------------------
   Flagi języków (PL / EN) z plików SVG użytkownika. Każda flaga jest renderowana do dwóch
   tekstur: kolorowej (aktywny język) i czarno-białej (nieaktywny). Rozmiar MENU.flags.texture
   w rozdzielczości ekranu, żeby okrągłe flagi były ostre.
   ----------------------------------------------------------------------------------------- */
const FLAG_SVG: Record<'pl' | 'en', string> = {
  pl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><mask id="pl-c"><circle cx="256" cy="256" r="256" fill="#fff"/></mask><g mask="url(#pl-c)"><path fill="#eee" d="M0 0h512v256H0z"/><path fill="#d80027" d="M0 256h512v256H0z"/></g></svg>`,
  en: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><mask id="gb-c"><circle cx="256" cy="256" r="256" fill="#fff"/></mask><g mask="url(#gb-c)"><path fill="#eee" d="m0 0 8 22-8 23v23l32 54-32 54v32l32 48-32 48v32l32 54-32 54v68l22-8 23 8h23l54-32 54 32h32l48-32 48 32h32l54-32 54 32h68l-8-22 8-23v-23l-32-54 32-54v-32l-32-48 32-48v-32l-32-54 32-54V0l-22 8-23-8h-23l-54 32-54-32h-32l-48 32-48-32h-32l-54 32L68 0H0z"/><path fill="#0052b4" d="M336 0v108L444 0Zm176 68L404 176h108zM0 176h108L0 68ZM68 0l108 108V0Zm108 512V404L68 512ZM0 444l108-108H0Zm512-108H404l108 108Zm-68 176L336 404v108z"/><path fill="#d80027" d="M0 0v45l131 131h45L0 0zm208 0v208H0v96h208v208h96V304h208v-96H304V0h-96zm259 0L336 131v45L512 0h-45zM176 336 0 512h45l131-131v-45zm160 0 176 176v-45L381 336h-45z"/></g></svg>`,
};

/**
 * Renderuje SVG flagi do tekstur `flag-pl`, `flag-pl-gray`, `flag-en`, `flag-en-gray`.
 * Zwraca Promise — po jej spełnieniu tekstury są gotowe w menedżerze tekstur sceny.
 */
export function buildFlagTextures(scene: Phaser.Scene): Promise<void> {
  const px = Math.round(MENU.flags.texture * UI_RESOLUTION);
  const jobs = (Object.keys(FLAG_SVG) as ('pl' | 'en')[]).map(
    (lang) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          for (const gray of [false, true]) {
            const key = 'flag-' + lang + (gray ? '-gray' : '');
            if (scene.textures.exists(key)) continue;
            const canvas = document.createElement('canvas');
            canvas.width = px;
            canvas.height = px;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            if (gray) ctx.filter = 'grayscale(1) brightness(0.8)';
            ctx.drawImage(img, 0, 0, px, px);
            scene.textures.addCanvas(key, canvas);
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(FLAG_SVG[lang]);
      }),
  );
  return Promise.all(jobs).then(() => undefined);
}

/** Buduje wszystkie tekstury gry w scenie startowej. */
export function buildTextures(scene: Phaser.Scene) {
  const g = scene.add.graphics({ x: 0, y: 0 });
  buildTiles(g);
  buildTowers(g);
  buildProjectiles(g);
  buildEnemies(g);
  buildIcons(g);
  g.destroy();
}
