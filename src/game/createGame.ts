import Phaser from 'phaser';
import { GAME_H, GAME_W, PALETTE } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { VictoryScene } from './scenes/VictoryScene';
import { toCss } from './utils/color';

/**
 * Wystawia aktywną scenę na zewnątrz gry: atrybut `<html data-scene>` i zdarzenie `inwazja:scene`.
 * Korzystają z tego skrypty dołączane przy budowaniu wielopilkowym — autoaktualizacja PWA
 * (przeładowanie tylko w menu) i adaptery SDK portali (start/stop rozgrywki).
 */
function publishActiveScene(game: Phaser.Game) {
  game.events.once(Phaser.Core.Events.READY, () => {
    for (const scene of game.scene.getScenes(false)) {
      scene.events.on(Phaser.Scenes.Events.CREATE, () => {
        const key = scene.scene.key;
        document.documentElement.dataset.scene = key;
        window.dispatchEvent(new CustomEvent('inwazja:scene', { detail: key }));
      });
    }
  });
}

/** Gra Phaser osadzona w elemencie `parent`, skalowana do okna (FIT). */
export function createGame(parent: string): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    parent,
    backgroundColor: toCss(PALETTE.night),
    render: { antialias: true },
    /* Własny silnik audio (src/game/audio) jest jedynym źródłem dźwięku — Phaser nie tworzy
       drugiego AudioContext i nie alokuje menedżera dźwięku. */
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, GameScene, VictoryScene],
  });
  publishActiveScene(game);
  return game;
}
