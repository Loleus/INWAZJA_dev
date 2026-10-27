import Phaser from 'phaser';
import { gameAudio } from '../audio';
import { TIMING } from '../constants';
import { buildMenuBottomBar } from '../ui/menu/MenuBottomBar';
import { buildMenuMain, drawMenuBackground } from '../ui/menu/MenuMain';
import { buildMenuTopBar } from '../ui/menu/MenuTopBar';

/** Menu główne: pasek górny, środek (tytuł, arsenał, przeciwnicy, start) i pasek dolny. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const start = () => this.startGame();
    drawMenuBackground(this);
    buildMenuTopBar(this);
    buildMenuMain(this, start);
    buildMenuBottomBar(this);
    this.input.keyboard?.on('keydown-ENTER', start);
    this.input.keyboard?.on('keydown-SPACE', start);
  }

  private startGame() {
    gameAudio.startGame();
    this.cameras.main.fadeOut(TIMING.menuFadeOut, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
  }
}
