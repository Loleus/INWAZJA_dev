import { CARD, PALETTE } from '../constants';

/** Kolor liczbowy w zapisie CSS. */
export function toCss(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** Liniowe przejście koloru `from` w stronę `to` o ułamek `amount`. */
function mixColor(from: number, to: number, amount: number): number {
  const channel = (shift: number) => {
    const a = (from >> shift) & 255;
    const b = (to >> shift) & 255;
    return Math.round(a + (b - a) * amount);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Rozjaśnienie koloru w stronę bieli. */
export function brighten(color: number, amount: number): number {
  return mixColor(color, PALETTE.white, amount);
}

/** Przyciemnienie koloru w stronę czerni (zachowuje barwę, zmniejsza jasność). */
export function darken(color: number, amount: number): number {
  return mixColor(color, PALETTE.black, amount);
}

/** Tło okienka: ciemna baza z domieszką koloru ramki (kontrast drobnych napisów ≥ 4,8:1). */
export function cardBackground(borderColor: number): number {
  return mixColor(CARD.base, borderColor, CARD.tint);
}
