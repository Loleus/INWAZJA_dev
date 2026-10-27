import Phaser from 'phaser';
import {
  BUTTON,
  CENTER_X,
  CSS,
  END_SCREEN,
  FONT_SIZE,
  GAME_H,
  GAME_W,
  PALETTE,
  START_LIVES,
  TEXT_COLOR,
  TIMING,
} from '../constants';
import { gameAudio } from '../audio';
import { t } from '../i18n';
import type { EndGameData } from '../types';
import { addNeutralButton, addStars, textStyle } from '../ui/common';

/** Ekran końcowy: raport z kampanii, ranga (przy zwycięstwie) i konfetti. */
export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene');
  }

  create(data: EndGameData) {
    const E = END_SCREEN;
    const won = !!data?.won;
    const lives = Math.max(0, data?.lives || 0);
    const goldLeft = data?.gold || 0;
    const kills = data?.kills || 0;
    const rankPoints = lives * E.rank.lifeWeight + Math.floor(goldLeft / E.rank.goldDivisor);
    let rating = 'C';
    if (won) {
      if (rankPoints >= E.rank.S) rating = 'S';
      else if (rankPoints >= E.rank.A) rating = 'A';
      else if (rankPoints >= E.rank.B) rating = 'B';
    }

    gameAudio.result(won);

    this.add.rectangle(CENTER_X, GAME_H / 2, GAME_W, GAME_H, PALETTE.night);
    addStars(this, E.stars);

    this.add
      .text(CENTER_X, E.titleY, won ? t('victory') : t('defeat'), textStyle(FONT_SIZE.endTitle, won ? CSS.emerald300 : TEXT_COLOR.danger, true))
      .setOrigin(0.5);
    this.add
      .text(CENTER_X, E.descY, won ? t('victoryDesc') : t('defeatDesc'), textStyle(FONT_SIZE.endDesc, TEXT_COLOR.muted))
      .setOrigin(0.5);

    const rows: { label: string; value: string; color: string; coin?: boolean }[] = [
      { label: t('livesLeft'), value: `${lives} / ${START_LIVES}`, color: TEXT_COLOR.value },
      { label: t('goldLeft'), value: `${goldLeft}`, color: TEXT_COLOR.value, coin: true },
      { label: t('kills'), value: `${kills}`, color: TEXT_COLOR.value },
      { label: t('score'), value: `${data?.score || 0}`, color: TEXT_COLOR.gold },
    ];
    const R = E.rows;
    rows.forEach((row, index) => {
      const y = R.y + index * R.step;
      this.add.rectangle(CENTER_X, y, R.w, R.h, R.fill).setStrokeStyle(1, R.stroke);
      this.add.text(R.labelX, y, row.label, textStyle(FONT_SIZE.endLabel, TEXT_COLOR.label)).setOrigin(0, 0.5);
      const value = this.add.text(R.valueX, y, row.value, textStyle(FONT_SIZE.endValue, row.color, true)).setOrigin(1, 0.5);
      if (row.coin) this.add.image(R.valueX - value.width - E.coinGap, y, 'icon-coin').setScale(E.coinScale);
    });

    const scoreY = R.y + (rows.length - 1) * R.step;
    if (won) {
      this.add
        .text(CENTER_X, scoreY + E.rankDy, t('rank', { pts: rankPoints }), textStyle(FONT_SIZE.endRank, TEXT_COLOR.dim))
        .setOrigin(0.5);
      const ratingText = this.add
        .text(CENTER_X, scoreY + E.ratingDy, rating, textStyle(FONT_SIZE.endRating, E.ratingColor[rating], true))
        .setOrigin(0.5)
        .setScale(0.4);
      this.tweens.add({ targets: ratingText, scale: 1, duration: 420, ease: 'Back.easeOut' });
      this.spawnConfetti();
    } else {
      this.add.text(CENTER_X, scoreY + E.hintDy, t('hint'), textStyle(FONT_SIZE.endHint, TEXT_COLOR.muted)).setOrigin(0.5);
    }

    const primary = BUTTON.primary;
    const again = this.add
      .rectangle(E.again.x, E.again.y, E.again.w, E.again.h, primary.fill)
      .setStrokeStyle(2, primary.stroke)
      .setInteractive({ useHandCursor: true });
    this.add.text(E.again.x, E.again.y, t('playAgain'), textStyle(FONT_SIZE.endButton, primary.text, true)).setOrigin(0.5);
    again.on('pointerover', () => again.setFillStyle(primary.hover));
    again.on('pointerout', () => again.setFillStyle(primary.fill));
    again.on('pointerdown', () => this.scene.start('GameScene'));

    addNeutralButton(this, E.menu.x, E.menu.y, E.menu.w, E.menu.h, () => this.scene.start('MenuScene')).setStrokeStyle(
      2,
      BUTTON.neutral.stroke,
    );
    this.add.text(E.menu.x, E.menu.y, t('mainMenu'), textStyle(FONT_SIZE.endButton, BUTTON.neutral.glyph, true)).setOrigin(0.5);

    this.input.keyboard?.on('keydown-ENTER', () => this.scene.start('GameScene'));
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MenuScene'));
    this.cameras.main.fadeIn(TIMING.endFadeIn, 0, 0, 0);
  }

  private spawnConfetti() {
    const { count, colors } = END_SCREEN.confetti;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(0, GAME_W);
      const rect = this.add.rectangle(
        x,
        -20,
        Phaser.Math.Between(4, 9),
        Phaser.Math.Between(6, 14),
        colors[Phaser.Math.Between(0, colors.length - 1)],
      );
      this.tweens.add({
        targets: rect,
        y: GAME_H + 20,
        x: x + Phaser.Math.Between(-70, 70),
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(2200, 4200),
        delay: Phaser.Math.Between(0, 900),
        onComplete: () => rect.destroy(),
      });
    }
  }
}
