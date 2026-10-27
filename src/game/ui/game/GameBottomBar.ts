import Phaser from 'phaser';
import {
  BOTTOM_BAR,
  BOTTOM_BAR_CY,
  BUTTON,
  DEPTH,
  FONT_SIZE,
  GAME_W,
  PANEL_H,
  PLAY_BOTTOM,
  TEXT_COLOR,
  TEXTURE,
  TOWER_INFO,
  TOWER_ORDER,
  TOWER_STATS,
} from '../../constants';
import { towerSpriteKey } from '../../gfx/sprites';
import { makeStoneSurfaceTexture } from '../../gfx/surfaces';
import { towerName } from '../../i18n';
import { damageLabel } from '../../logic/combat';
import type { TowerType } from '../../types';
import { brighten, cardBackground, darken } from '../../utils/color';
import { drawBarDivider, drawStoneBar, textStyle } from '../common';

interface TowerButton {
  bg: Phaser.GameObjects.Rectangle;
  /** Stała lub wybrana ramka — rysowana po łuku, bo Rectangle ma tylko ostre narożniki. */
  frame: Phaser.GameObjects.Graphics;
  hoverFrame: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  coin: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  key: Phaser.GameObjects.Text;
  /** Bity: 1 = stać gracza, 2 = wybrana; -1 = jeszcze nie narysowana. */
  state: number;
}

const B = BOTTOM_BAR;

/**
 * Pasek dolny sceny gry: cztery karty broni wyśrodkowane w pasku. Wysokość kart wynika
 * z zawartości (wspólny pas treści + równe marginesy), a numer klawisza stoi przy górnej krawędzi.
 */
export class GameBottomBar {
  private readonly buttons = {} as Record<TowerType, TowerButton>;

  constructor(scene: Phaser.Scene, onSelect: (type: TowerType) => void) {
    drawStoneBar(scene, BOTTOM_BAR_CY, PANEL_H, DEPTH.HUD);
    drawBarDivider(scene, PLAY_BOTTOM, DEPTH.HUD);

    const { w, gap, paddingY, border } = B.button;
    const count = TOWER_ORDER.length;
    const startX = (GAME_W - (count * w + (count - 1) * gap)) / 2 + w / 2;
    const midY = BOTTOM_BAR_CY;
    const faces: Phaser.GameObjects.Image[] = [];
    let contentTop = Infinity;
    let contentBottom = -Infinity;

    TOWER_ORDER.forEach((type, index) => {
      const info = TOWER_INFO[type];
      const stats = TOWER_STATS[type][0];
      const x = startX + index * (w + gap);
      faces.push(scene.add.image(x, midY, 'tile-grass').setVisible(false).setDepth(DEPTH.HUD));
      const bg = scene.add
        .rectangle(x, midY, w, 1, cardBackground(info.color), 1)
        .setDepth(DEPTH.HUD)
        .setInteractive({ useHandCursor: true });
      const frame = scene.add.graphics().setDepth(DEPTH.HUD);
      const hoverFrame = scene.add.graphics().setAlpha(0).setDepth(DEPTH.HUD + 1);
      const icon = scene.add
        .image(x + B.icon.dx, midY + B.icon.dy, towerSpriteKey(type))
        .setDepth(DEPTH.HUD)
        .setScale(B.icon.scale);
      const name = scene.add
        .text(x + B.name.dx, midY + B.name.dy, towerName(type), textStyle(FONT_SIZE.towerName, TEXT_COLOR.light, true))
        .setDepth(DEPTH.HUD);
      const coin = scene.add
        .image(x + B.coin.dx, midY + B.coin.dy, 'icon-coin')
        .setDepth(DEPTH.HUD)
        .setScale(B.coin.scale);
      const cost = scene.add
        .text(x + B.cost.dx, midY + B.cost.dy, `${stats.cost} · ${damageLabel(stats)}`, textStyle(FONT_SIZE.towerCost, TEXT_COLOR.gold))
        .setDepth(DEPTH.HUD);
      const key = scene.add
        .text(x + B.hotkey.dx, midY + B.hotkey.dy, '[' + info.hotkey + ']', textStyle(FONT_SIZE.towerHotkey, TEXT_COLOR.hotkey))
        .setOrigin(1, 0)
        .setDepth(DEPTH.HUD);

      let hoverTween: Phaser.Tweens.Tween | null = null;
      const animateHover = (alpha: number) => {
        hoverTween?.stop();
        hoverTween = scene.tweens.add({ targets: hoverFrame, alpha, duration: BUTTON.hoverTweenMs, ease: 'Sine.easeOut' });
      };
      bg.on('pointerover', () => animateHover(1));
      bg.on('pointerout', () => animateHover(0));
      bg.on('pointerdown', () => onSelect(type));
      this.buttons[type] = { bg, frame, hoverFrame, icon, coin, name, cost, key, state: -1 };

      for (const item of [icon, coin, name, cost, key]) {
        const bounds = item.getBounds();
        contentTop = Math.min(contentTop, bounds.top);
        contentBottom = Math.max(contentBottom, bounds.bottom);
      }
    });

    const h = contentBottom - contentTop + paddingY * 2 + border;
    const offset = midY - (contentTop + contentBottom) / 2;
    const source = TEXTURE.towerStoneSource;
    TOWER_ORDER.forEach((type, index) => {
      const btn = this.buttons[type];
      btn.bg.setSize(w, h);
      for (const item of [btn.icon, btn.coin, btn.name, btn.cost, btn.key]) item.y += offset;
      btn.key.setY(btn.bg.getTopLeft(undefined, false).y + B.hotkey.top);
      const color = cardBackground(TOWER_INFO[type].color);
      const stoneKey = makeStoneSurfaceTexture(scene, color, w, h, source.width, source.height, TEXTURE.stoneGrain, B.radius);
      if (stoneKey) {
        faces[index].setTexture(stoneKey).setDisplaySize(w, h).setVisible(true);
        btn.bg.setFillStyle(color, 0);
      }
      this.paintFrame(type, btn, false, true);
      this.paintHoverFrame(type, btn);
    });
  }

  /** Stała lub wybrana ramka karty — ten sam promień narożników co okno PROMPTERA. */
  private paintFrame(type: TowerType, btn: TowerButton, selected: boolean, affordable: boolean) {
    const s = B.stroke;
    const x = btn.bg.x - btn.bg.width / 2;
    const y = btn.bg.y - btn.bg.height / 2;
    btn.frame.clear();
    btn.frame.lineStyle(
      selected ? s.selectedWidth : s.width,
      selected ? darken(TOWER_INFO[type].color, s.selectedDarken) : TOWER_INFO[type].color,
      selected ? s.selected : affordable ? s.affordable : s.unaffordable,
    );
    btn.frame.strokeRoundedRect(x, y, btn.bg.width, btn.bg.height, B.radius);
  }

  /** Jaśniejsza ramka najechania — ten sam promień, więc pokrywa się z obramowaniem karty. */
  private paintHoverFrame(type: TowerType, btn: TowerButton) {
    const x = btn.bg.x - btn.bg.width / 2;
    const y = btn.bg.y - btn.bg.height / 2;
    btn.hoverFrame.clear();
    btn.hoverFrame.lineStyle(B.hoverFrame.width, brighten(TOWER_INFO[type].color, B.hoverFrame.brighten), 1);
    btn.hoverFrame.strokeRoundedRect(x, y, btn.bg.width, btn.bg.height, B.radius);
  }

  /** Ramka i przygaszenie kart zależą od tego, czy gracza stać na wieżę i czy jest wybrana. */
  refresh(gold: number, selected: TowerType | null) {
    for (const type of TOWER_ORDER) {
      const btn = this.buttons[type];
      const affordable = gold >= TOWER_STATS[type][0].cost;
      const isSelected = selected === type;
      const state = (affordable ? 1 : 0) | (isSelected ? 2 : 0);
      if (btn.state === state) continue;
      btn.state = state;
      this.paintFrame(type, btn, isSelected, affordable);
      const alpha = affordable ? 1 : B.disabledAlpha;
      for (const item of [btn.icon, btn.coin, btn.name, btn.cost, btn.key]) item.setAlpha(alpha);
      btn.cost.setColor(affordable ? TEXT_COLOR.gold : TEXT_COLOR.danger);
    }
  }
}
