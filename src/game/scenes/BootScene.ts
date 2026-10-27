import Phaser from 'phaser';
import { FONT_PRELOAD, FONT_PRELOAD_TIMEOUT_MS } from '../constants';
import { buildFlagTextures, buildTextures } from '../gfx/sprites';

/** Buduje tekstury, czeka na flagi i czcionki (najwyżej FONT_PRELOAD_TIMEOUT_MS), potem menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    buildTextures(this);
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      this.scene.start('MenuScene');
    };
    const flags = buildFlagTextures(this);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts && typeof fonts.load === 'function') {
      try {
        Promise.allSettled([flags, ...FONT_PRELOAD.map((font) => fonts.load(font))]).then(start);
      } catch {
        start();
      }
    } else {
      flags.then(start);
    }
    window.setTimeout(start, FONT_PRELOAD_TIMEOUT_MS);
  }
}
