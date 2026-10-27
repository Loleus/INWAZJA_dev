import Phaser from 'phaser';
import { FONT_SIZE, MENU, MENU_DEPTH, PALETTE, TEXT_COLOR, TOP_BAR, TOP_BAR_CY, WORLD_Y } from '../../constants';
import { getLang, setLang, type Lang } from '../../i18n';
import { gameAudio } from '../../audio';
import { addGlyph, addNeutralButton, drawStoneBar, toggleFullscreen } from '../common';

/**
 * Pasek górny menu: flagi języków po lewej, ikona dźwięku i pełny ekran po prawej.
 * Oba szare przyciski mają identyczny rozmiar i styl jak w scenie gry.
 */
export function buildMenuTopBar(scene: Phaser.Scene) {
  drawStoneBar(scene, TOP_BAR_CY, WORLD_Y, MENU_DEPTH.bars);
  buildLanguageSwitch(scene);
  buildAudioToggle(scene);

  /* Taki sam przycisk pełnego ekranu jak w scenie gry: rozmiar i glif z paska górnego gry. */
  addNeutralButton(scene, TOP_BAR.fullscreenX, TOP_BAR_CY, TOP_BAR.button.w, TOP_BAR.button.h, () => {
    gameAudio.uiClick();
    toggleFullscreen(scene);
  });
  addGlyph(scene, TOP_BAR.fullscreenX, TOP_BAR_CY, '⧉', FONT_SIZE.hudGlyph);
}

/**
 * Dźwięk domyślnie wyłączony. Kliknięcie włącza go i jest jednocześnie gestem zezwalającym
 * przeglądarce na AudioContext; wyłączenie tylko wycisza, nie zmienia stanu gry.
 */
function buildAudioToggle(scene: Phaser.Scene) {
  const x = TOP_BAR.audioX;
  let glyph: Phaser.GameObjects.Text | null = null;
  const slash = scene.add.graphics();

  const paint = (enabled: boolean) => {
    glyph?.setColor(enabled ? TEXT_COLOR.light : TEXT_COLOR.dim);
    slash.clear();
    if (enabled) return;
    slash.lineStyle(1.5, PALETTE.slate300, 0.95);
    slash.lineBetween(x - 7, TOP_BAR_CY - 7, x + 7, TOP_BAR_CY + 7);
  };

  addNeutralButton(scene, x, TOP_BAR_CY, TOP_BAR.button.w, TOP_BAR.button.h, () => {
    const enabled = gameAudio.toggle();
    paint(enabled);
    if (enabled) gameAudio.uiClick();
  });
  glyph = addGlyph(scene, x, TOP_BAR_CY, '🕪', FONT_SIZE.hudGlyph);
  paint(gameAudio.isEnabled());
  /* Silnik może odmówić (brak WebAudio) — wtedy stan ikony zostaje zgodny z rzeczywistością. */
  const unsubscribe = gameAudio.onChange(paint);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
}

/**
 * Dwie okrągłe flagi (PL, EN): aktywny język — flaga kolorowa, nieaktywny — czarno-biała.
 * Kliknięcie zapamiętuje wybór i przeładowuje menu.
 */
function buildLanguageSwitch(scene: Phaser.Scene) {
  const { size, gap, left, inactiveAlpha, hoverGrow } = MENU.flags;
  const langs: Lang[] = ['pl', 'en'];
  langs.forEach((lang, i) => {
    const active = getLang() === lang;
    const key = 'flag-' + lang + (active ? '' : '-gray');
    if (!scene.textures.exists(key)) return;
    const restAlpha = active ? 1 : inactiveAlpha;
    const flag = scene.add
      .image(left + size / 2 + i * (size + gap), TOP_BAR_CY, key)
      .setDisplaySize(size, size)
      .setAlpha(restAlpha)
      .setInteractive({ useHandCursor: true });
    flag.on('pointerover', () => flag.setAlpha(1).setDisplaySize(size + hoverGrow, size + hoverGrow));
    flag.on('pointerout', () => flag.setAlpha(restAlpha).setDisplaySize(size, size));
    flag.on('pointerdown', () => {
      if (getLang() === lang) return;
      gameAudio.uiClick();
      setLang(lang);
      scene.scene.restart();
    });
  });
}
