import Phaser from 'phaser';
import {
  CSS,
  DEPTH,
  ENEMY_ORDER,
  ENEMY_STYLE,
  ENEMY_VIEW,
  FONT_SIZE,
  GAME_W,
  INFO_PANEL,
  MAX_TOWER_LEVEL,
  PLAY_BOTTOM,
  SELL_FACTOR,
  TEXT_COLOR,
  TOWER_INFO,
  TOWER_STATS,
  WORLD_Y,
} from '../../constants';
import { towerSpriteKey } from '../../gfx/sprites';
import { t, towerName } from '../../i18n';
import { cellCenter } from '../../logic/board';
import { canAffect, damageFactor, damageLabel } from '../../logic/combat';
import type { TowerType } from '../../types';
import { textStyle } from '../common';

interface InfoPanelTower {
  type: TowerType;
  level: number;
  col: number;
  row: number;
  invested: number;
}

interface InfoPanelActions {
  /** Klik w panel nie może przebić się do planszy. */
  guard(): void;
  upgrade(): void;
  sell(): void;
  close(): void;
}

interface ButtonStyle {
  fill: number;
  stroke: number;
  text: string;
}

const I = INFO_PANEL;
const D_BG = DEPTH.PANEL + I.depth.bg;
const D_GFX = DEPTH.PANEL + I.depth.gfx;
const D_TXT = DEPTH.PANEL + I.depth.text;

/**
 * Karta wieży na planszy: zasięg pod półprzezroczystą kartą, nagłówek z poziomem,
 * statystyki, efekt broni, ikony celów oraz przyciski ULEPSZ i SPRZEDAJ.
 * Karta stoi po przeciwnej stronie wieży niż środek planszy.
 */
export class TowerInfoPanel {
  isOpen = false;
  private items: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly actions: InfoPanelActions,
  ) {}

  clear() {
    for (const item of this.items) item.destroy();
    this.items = [];
    this.isOpen = false;
  }

  private add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.items.push(obj);
    return obj;
  }

  open(tower: InfoPanelTower, gold: number) {
    this.clear();
    const scene = this.scene;
    const stats = TOWER_STATS[tower.type][tower.level];
    const color = TOWER_INFO[tower.type].color;
    const center = cellCenter(tower.col, tower.row);

    const range = this.add(scene.add.graphics().setDepth(DEPTH.PANEL));
    range.fillStyle(color, I.range.fillAlpha);
    range.fillCircle(center.x, center.y, stats.range);
    range.lineStyle(I.range.width, color, I.range.alpha);
    range.strokeCircle(center.x, center.y, stats.range);

    const halfW = I.w / 2;
    const halfH = I.h / 2;
    const cardX = Phaser.Math.Clamp(
      center.x + (center.x > GAME_W / 2 ? -halfW - I.gapX : halfW + I.gapX),
      halfW + I.marginX,
      GAME_W - halfW - I.marginX,
    );
    const cardY = Phaser.Math.Clamp(
      center.y + (center.y > (WORLD_Y + PLAY_BOTTOM) / 2 ? -halfH - I.gapY : halfH + I.gapY),
      WORLD_Y + halfH + I.marginY,
      PLAY_BOTTOM - halfH - I.marginY,
    );
    const top = cardY - halfH;
    const bottom = cardY + halfH;
    const left = cardX - halfW + I.padX;
    const right = cardX + halfW - I.padX;

    const card = this.add(
      scene.add
        .rectangle(cardX, cardY, I.w, I.h, I.bg, I.bgAlpha)
        .setStrokeStyle(I.strokeWidth, color, I.strokeAlpha)
        .setDepth(D_BG),
    );
    card.setInteractive();
    card.on('pointerdown', () => this.actions.guard());

    const headY = top + I.headY;
    const textureKey = towerSpriteKey(tower.type, tower.level);
    this.add(scene.add.image(left, headY, textureKey).setScale(I.iconScale).setDepth(D_GFX));
    this.text(left + I.titleDx, headY - 8, towerName(tower.type).toUpperCase(), FONT_SIZE.infoTitle, CSS.white, true);
    this.text(
      left + I.titleDx,
      headY + 7,
      `${t('level')} ${tower.level + 1}/${MAX_TOWER_LEVEL + 1}`,
      FONT_SIZE.infoLevel,
      TEXT_COLOR.gold,
      true,
    );

    const close = this.add(
      scene.add
        .text(right, top + I.closeY, '✕', textStyle(FONT_SIZE.infoClose, TEXT_COLOR.muted))
        .setOrigin(1, 0)
        .setDepth(D_TXT)
        .setInteractive({ useHandCursor: true }),
    );
    close.on('pointerdown', () => {
      this.actions.guard();
      this.actions.close();
    });

    this.text(left, top + I.statsY, `${damageLabel(stats)} · ${t('range')} ${stats.range} · ${stats.fireRate} ms`, FONT_SIZE.infoStats, TEXT_COLOR.light);

    const [effectText, effectColor] = effectDescription(tower.type, stats.slow, stats.slowDuration, stats.chain, stats.chainDamage);
    const effectLine = this.text(left, top + I.effectY, effectText, FONT_SIZE.infoSmall, effectColor);
    if (effectLine.width > I.w - I.padX * 2) effectLine.setFontSize(FONT_SIZE.infoSmallFallback);

    this.text(left, top + I.targetsY, t('worksOn'), FONT_SIZE.infoSmall, TEXT_COLOR.muted);
    let ix = left + I.targetsDx;
    for (const type of ENEMY_ORDER) {
      if (!canAffect(tower.type, type)) continue;
      this.add(
        scene.add
          .image(ix, top + I.targetsY, ENEMY_STYLE[type].texture)
          .setScale(I.targetIcon / ENEMY_VIEW[type].size)
          .setAlpha(damageFactor(tower.type, type) < 1 ? I.weakAlpha : 1)
          .setDepth(D_GFX),
      );
      ix += I.targetStep;
    }

    const btn = I.button;
    const btnY = bottom - btn.bottom;
    const upX = cardX - (btn.w + btn.gap) / 2;
    const sellX = cardX + (btn.w + btn.gap) / 2;
    if (tower.level < MAX_TOWER_LEVEL) {
      const cost = stats.upgradeCost;
      this.button(upX, btnY, gold >= cost ? I.upgrade : I.locked, t('upgradeBtn'), String(cost), () => this.actions.upgrade());
    } else {
      this.button(upX, btnY, I.max, t('maxLevel'), null);
    }
    this.button(sellX, btnY, I.sell, t('sellBtn'), '+' + Math.floor(tower.invested * SELL_FACTOR), () => this.actions.sell());

    this.isOpen = true;
  }

  private text(x: number, y: number, value: string, size: number, color: string, bold = false) {
    return this.add(this.scene.add.text(x, y, value, textStyle(size, color, bold)).setOrigin(0, 0.5).setDepth(D_TXT));
  }

  /** Etykieta, moneta i cena tworzą jeden wyśrodkowany blok; dłuższe tłumaczenia są zmniejszane. */
  private button(cx: number, cy: number, style: ButtonStyle, label: string, price: string | null, onClick?: () => void) {
    const B = I.button;
    const bg = this.add(
      this.scene.add.rectangle(cx, cy, B.w, B.h, style.fill, B.alpha).setStrokeStyle(B.strokeWidth, style.stroke).setDepth(D_GFX),
    );
    const txt = this.text(0, cy, label, FONT_SIZE.infoButton, style.text, true);
    const priceText = price === null ? null : this.text(0, cy, price, FONT_SIZE.infoPrice, style.text, true);
    const coinGap = priceText ? B.coinGap : 0;
    const priceGap = priceText ? B.priceGap : 0;
    const groupWidth = () => txt.width + (priceText ? coinGap + B.coin + priceGap + priceText.width : 0);
    if (priceText && groupWidth() > B.w - B.inner) {
      txt.setFontSize(FONT_SIZE.infoButtonFallback);
      priceText.setFontSize(FONT_SIZE.infoPriceFallback);
    }
    const groupLeft = cx - groupWidth() / 2;
    txt.setPosition(groupLeft, cy);
    if (priceText) {
      const coinX = groupLeft + txt.width + coinGap + B.coin / 2;
      this.add(this.scene.add.image(coinX, cy, 'icon-coin').setScale(B.coin / 22).setDepth(D_TXT));
      priceText.setPosition(coinX + B.coin / 2 + priceGap, cy);
    }
    if (onClick) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.actions.guard();
        onClick();
      });
    }
  }
}


/** Opis działania broni z jej ograniczeniami (np. prąd bez czołgów, armata bez szybkich). */
function effectDescription(
  type: TowerType,
  slow: number,
  slowDuration: number,
  chain: number,
  chainDamage: number[],
): [string, string] {
  if (slow) return [`${t('slow')} ${Math.round(slow * 100)}% · ${slowDuration / 1000} s`, I.effect.slow];
  if (chain) return [`${t('chain')} ${chain} · ${chainDamage.join('/')} DMG · ${t('noTank')}`, I.effect.chain];
  if (type === 'cannon') return [`${t('singleTarget')} · ${t('noFast')}`, I.effect.cannon];
  if (type === 'arrow') return [`${t('tank')} 25% · ${t('bossMega')} 50%`, I.effect.arrow];
  return [t('singleTarget'), I.effect.single];
}
