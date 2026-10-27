import Phaser from 'phaser';
import {
  BOTTOM_BAR_CY,
  CENTER_X,
  FONT,
  FONT_SIZE,
  MENU,
  MENU_DEPTH,
  PANEL_H,
  TEXT_COLOR,
  UI_RESOLUTION,
} from '../../constants';
import { drawStoneBar, type TextStyle } from '../common';

/** Pasek dolny menu ze stopką autorską w neonowej poświacie. */
export function buildMenuBottomBar(scene: Phaser.Scene) {
  drawStoneBar(scene, BOTTOM_BAR_CY, PANEL_H, MENU_DEPTH.bars);
  buildFooter(scene);
}

/**
 * Znaczek i nazwa mają różne rozmiary pisma, więc są osobnymi obiektami. Grupa jest
 * centrowana po zmierzonych szerokościach, a znaczek wyrównany w pionie do rzeczywistych
 * krawędzi glifów nazwy.
 */
function buildFooter(scene: Phaser.Scene) {
  const F = MENU.footer;

  const measure = (text: string, fontSize: number) => {
    const probe = scene.make.text(
      { text, style: { fontFamily: FONT.footer, fontSize: fontSize + 'px', resolution: UI_RESOLUTION } },
      false,
    );
    const box = probe.getTextMetrics();
    const height = probe.height;
    const width = probe.width;
    probe.style.setTestString(text);
    const glyph = probe.getTextMetrics();
    probe.destroy();
    const baseline = Math.round(box.ascent) - height / 2;
    return { width, height, top: baseline - glyph.ascent, bottom: baseline + glyph.descent };
  };

  const mark = measure(F.mark, FONT_SIZE.footerMark);
  const name = measure(F.name, FONT_SIZE.footerName);
  const left = CENTER_X - (mark.width + name.width) / 2;

  /* Rozmycie liczone od krawędzi napisu: na każdą stronę zostaje połowa wolnego miejsca. */
  const maxBlur = Math.max(0, Math.floor((PANEL_H * F.glowHeightShare - mark.height) / 2));
  const blurScale = maxBlur / F.glowRadii[0];
  /* Phaser nie powiększa tekstury o cień, więc kontener ma zapas, w którym ogon gaussa wygasa. */
  const padding = Math.ceil(maxBlur * F.glowPadFactor) + 1;
  const markY = BOTTOM_BAR_CY + Math.max(name.bottom - mark.bottom, name.top - mark.top);

  /* Kilka nakładających się kopii odtwarza wielowarstwowy text-shadow; najciaśniejsza na wierzchu.
     Rozmycie skalowane rozdzielczością, bo shadowBlur w canvasie nie podlega transformacji. */
  const addGlow = (text: string, fontSize: number, x: number, y: number) => {
    const style: TextStyle = {
      fontFamily: FONT.footer,
      fontSize: fontSize + 'px',
      color: TEXT_COLOR.footer,
      resolution: UI_RESOLUTION,
      padding: { x: padding, y: padding },
    };
    for (const radius of F.glowRadii) {
      scene.add
        .text(x, y, text, style)
        .setOrigin(0.5)
        .setShadow(0, 0, TEXT_COLOR.footer, radius * blurScale * UI_RESOLUTION, true, true);
    }
  };

  addGlow(F.mark, FONT_SIZE.footerMark, left + mark.width / 2, markY);
  addGlow(F.name, FONT_SIZE.footerName, left + mark.width + name.width / 2, BOTTOM_BAR_CY);
}
