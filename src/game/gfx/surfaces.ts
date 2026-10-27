/* =========================================================================================
   Faktury i cienie generowane na canvasie: kamienna plansza, kamień kart i pasków,
   cień kart menu, tytuł w zimowym kamuflażu i miękki cień wokół ikon.
   ========================================================================================= */
import Phaser from 'phaser';
import { BOARD_H, CARD, COLS, CELL, GAME_W, ROWS, TEXTURE, UI_RESOLUTION } from '../constants';
import { tileTextureKey } from '../logic/board';

/* =========================================================================================
   TYTUŁ W ZIMOWYM KAMUFLAŻU (wojska górskie).
   Litery są wypełnione biało-szarym wzorem moro: rysujemy plamy na canvasie, a potem
   przycinamy je do kształtu napisu (`destination-in`). Powstaje zwykła tekstura, więc
   w pętli gry nie ma żadnego dodatkowego kosztu ani pracy dla GC.
   ========================================================================================= */

/** Deterministyczny generator — wzór moro jest zawsze ten sam przy każdym uruchomieniu. */
function camoRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rozlana ciecz: „grzbiecik" zbudowany z nakładających się kropli o losowych promieniach
 * i przesunięciach. Krawędzie są faliste i nierówne, jak płyn rozlany na powierzchni,
 * a nie regularny wielokąt.
 */
function camoBlob(
  ctx: CanvasRenderingContext2D,
  rnd: () => number,
  cx: number,
  cy: number,
  radius: number,
) {
  // krople główne + od 2 do 4 satelitów „rozlanych" w losowych kierunkach
  const drops = 3 + Math.floor(rnd() * 3);
  for (let d = 0; d < drops; d++) {
    const angle = d === 0 ? 0 : rnd() * Math.PI * 2;
    // pierwsza kropla siedzi w środku, kolejne są coraz mniejsze i dalej
    const drift = d === 0 ? 0 : radius * (0.45 + rnd() * 0.85);
    const cx2 = cx + Math.cos(angle) * drift;
    const cy2 = cy + Math.sin(angle) * drift * 0.62;
    const r2 = d === 0 ? radius * (0.85 + rnd() * 0.4) : radius * (0.3 + rnd() * 0.5);

    // obwód z falowaniem o dwóch częstotliwościach (duża fala + drobne nerwowości)
    const points = 22;
    const phase = rnd() * Math.PI * 2;
    const wob = 0.24 + rnd() * 0.2;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const wave =
        1 +
        wob * 0.5 * Math.sin(t * 3 + phase) +
        wob * 0.28 * Math.sin(t * 5 - phase * 1.7) +
        wob * 0.16 * Math.sin(t * 8 + phase * 2.3);
      // rozciągnięcie poziome: ciecz rozlewa się szerzej niż w pionie
      const rx = r2 * wave * 1.3;
      const ry = r2 * wave * 0.78;
      const px = cx2 + Math.cos(t) * rx;
      const py = cy2 + Math.sin(t) * ry;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}


interface PatternGrid {
  width: number;
  height: number;
  values: Float32Array;
}

function makePatternGrid(width: number, height: number, rnd: () => number): PatternGrid {
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = rnd() * 2 - 1;
  return { width, height, values };
}

function samplePatternGrid(grid: PatternGrid, x: number, y: number, width: number, height: number): number {
  const gx = (x / width) * grid.width;
  const gy = (y / height) * grid.height;
  const x0 = Math.floor(gx) % grid.width;
  const y0 = Math.floor(gy) % grid.height;
  const x1 = (x0 + 1) % grid.width;
  const y1 = (y0 + 1) % grid.height;
  const tx0 = gx - Math.floor(gx);
  const ty0 = gy - Math.floor(gy);
  const tx = tx0 * tx0 * (3 - 2 * tx0);
  const ty = ty0 * ty0 * (3 - 2 * ty0);
  const a = grid.values[y0 * grid.width + x0];
  const b = grid.values[y0 * grid.width + x1];
  const c = grid.values[y1 * grid.width + x0];
  const d = grid.values[y1 * grid.width + x1];
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

/**
 * Jedna tekstura całej planszy: zachowuje geometrię i dwie tonacje trawy/piasku,
 * ale kamienne ziarno liczy z GLOBALNYCH współrzędnych 800×600. Nie powtarza się
 * co 25 px ani co szerokość kart/pasków. Powstaje raz i jest współdzielona przez sceny.
 */
export function makeBoardStoneTexture(scene: Phaser.Scene): string {
  const key = 'board-stone-unique-v1';
  if (scene.textures.exists(key)) return key;
  const height = BOARD_H;
  const texture = scene.textures.createCanvas(key, GAME_W, height);
  if (!texture) return '';
  const ctx = texture.getContext();

  // Mapa składana z kafelków, włącznie z zaokrągleniami dróg.
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const tileKey = tileTextureKey(col, row);
      ctx.drawImage(scene.textures.get(tileKey).getSourceImage() as CanvasImageSource, col * CELL, row * CELL);
    }
  }

  const image = ctx.getImageData(0, 0, GAME_W, height);
  const pixels = image.data;
  const rnd = camoRandom(0x6f726f6a);
  // Wszystkie oktawy rozpięte na CAŁEJ planszy; nie są kafelkowane między polami.
  const coarse = makePatternGrid(37, 29, rnd);
  const medium = makePatternGrid(129, 99, rnd);
  const fine = makePatternGrid(379, 283, rnd);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < GAME_W; x++) {
      const offset = (y * GAME_W + x) * 4;
      const stone =
        samplePatternGrid(coarse, x, y, GAME_W, height) * 0.36 +
        samplePatternGrid(medium, x, y, GAME_W, height) * 0.32 +
        samplePatternGrid(fine, x, y, GAME_W, height) * 0.24;
      // Niezależny pył w każdym pikselu; również jego wzór nie ma okresu kafelka.
      let hash = Math.imul(x + 16411, 374761393) ^ Math.imul(y + 24133, 668265263);
      hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
      const dust = ((hash >>> 0) / 4294967295 - 0.5) * 0.07;
      const pathTone = pixels[offset] > pixels[offset + 1] * 1.08;
      // Plansza ma mieć widoczne, ale subtelne ziarno — faktura nie może konkurować
      // z drogami, wieżami i wrogami. Paski/menu zachowują osobną, mocniejszą fakturę.
      const strength = pathTone ? 0.12 : 0.16;
      const multiplier = Math.max(0.88, Math.min(1.12, 1 + (stone + dust) * strength));
      pixels[offset] = Math.round(pixels[offset] * multiplier);
      pixels[offset + 1] = Math.round(pixels[offset + 1] * multiplier);
      pixels[offset + 2] = Math.round(pixels[offset + 2] * multiplier);
    }
  }
  ctx.putImageData(image, 0, 0);
  texture.refresh();
  return key;
}

/**
 * Tworzy ziarnisty kamienny wzór z obrazu jako achromatyczną modulację jasności.
 * Bazowy kolor karty pozostaje bez zmian (oblicza go cardBackground); kolorem źródłowego
 * zdjęcia w ogóle nie malujemy. Kilka zawijanych oktaw szumu daje drobne kruszywo,
 * a odejmowanie średniej utrzymuje średnią jasność karty i jej obecną barwę.
 * `textureDarkness` zwiększa tylko kontrast ciemnych drobinek na wskazanej teksturze;
 * nie przyciemnia bazowego koloru powierzchni.
 * `cornerRadius` przycina fakturę do kształtu okienka o zaokrąglonych narożnikach
 * (0 = prostokąt — plansza, paski i inne powierzchnie bez zaokrągleń).
 */
export function makeMenuStoneTexture(
  scene: Phaser.Scene,
  baseColor: number,
  logicalWidth: number,
  logicalHeight: number,
  grainStrength: number = TEXTURE.stoneGrain,
  textureDarkness = 0,
  cornerRadius = 0,
): string {
  const dpr = UI_RESOLUTION;
  const width = Math.max(1, Math.round(logicalWidth * dpr));
  const height = Math.max(1, Math.round(logicalHeight * dpr));
  const key = `menu-stone-${baseColor.toString(16).padStart(6, '0')}-${width}x${height}-g${Math.round(grainStrength * 100)}-d${Math.round(textureDarkness * 100)}-r${cornerRadius}`;
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const seed = (baseColor ^ (width * 374761393) ^ (height * 668265263)) >>> 0;
  const rnd = camoRandom(seed);
  const grids = [
    { grid: makePatternGrid(7, 6, rnd), weight: 0.42 },
    { grid: makePatternGrid(19, 16, rnd), weight: 0.29 },
    { grid: makePatternGrid(53, 46, rnd), weight: 0.19 },
    { grid: makePatternGrid(Math.max(1, Math.floor(width / 3)), Math.max(1, Math.floor(height / 3)), rnd), weight: 0.1 },
  ];

  const noise = new Float32Array(width * height);
  let mean = 0;
  let pixel = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (const layer of grids) value += samplePatternGrid(layer.grid, x, y, width, height) * layer.weight;
      noise[pixel++] = value;
      mean += value;
    }
  }
  mean /= noise.length;

  const image = ctx.createImageData(width, height);
  const sourceR = (baseColor >>> 16) & 255;
  const sourceG = (baseColor >>> 8) & 255;
  const sourceB = baseColor & 255;
  // Only deepen the negative/noise grains; keep the mean at 1 so the base color stays put.
  let shapedMean = 0;
  for (let i = 0; i < noise.length; i++) {
    const delta = noise[i] - mean;
    shapedMean += delta < 0 ? delta * (1 + textureDarkness) : delta;
  }
  shapedMean /= noise.length;

  // Neutral luminance-only modulation preserves hue; darkening affects only the pattern.
  for (let i = 0; i < noise.length; i++) {
    const delta = noise[i] - mean;
    const shaped = (delta < 0 ? delta * (1 + textureDarkness) : delta) - shapedMean;
    const luminanceMix = Math.max(0.55, Math.min(1.32, 1 + shaped * grainStrength));
    const offset = i * 4;
    image.data[offset] = Math.min(255, Math.max(0, Math.round(sourceR * luminanceMix)));
    image.data[offset + 1] = Math.min(255, Math.max(0, Math.round(sourceG * luminanceMix)));
    image.data[offset + 2] = Math.min(255, Math.max(0, Math.round(sourceB * luminanceMix)));
    image.data[offset + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  /* Zaokrąglone narożniki: faktura przycięta do kształtu okienka (`destination-in`),
     tak samo jak kamuflaż przycinany do liter tytułu. */
  if (cornerRadius > 0) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, cornerRadius * dpr);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  const texture = scene.textures.addCanvas(key, canvas);
  texture?.refresh();
  return key;
}

/** Reuses the exact menu-card grain at its original scale, cached for each surface size. */
export function makeStoneSurfaceTexture(
  scene: Phaser.Scene,
  baseColor: number,
  logicalWidth: number,
  logicalHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  grainStrength: number = TEXTURE.stoneGrain,
  cornerRadius = 0,
): string {
  const sourceKey = makeMenuStoneTexture(scene, baseColor, sourceWidth, sourceHeight, grainStrength);
  if (!sourceKey) return '';
  if (logicalWidth === sourceWidth && logicalHeight === sourceHeight && cornerRadius === 0) return sourceKey;

  // makeMenuStoneTexture always uses an HTMLCanvasElement as its source.
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement;
  const width = Math.max(1, Math.round(logicalWidth * source.width / sourceWidth));
  const height = Math.max(1, Math.round(logicalHeight * source.height / sourceHeight));
  const radius = Math.max(0, Math.round(cornerRadius * UI_RESOLUTION));
  const key = `${sourceKey}-surface-${width}x${height}-r${radius}`;
  if (scene.textures.exists(key)) return key;

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return '';
  const ctx = texture.getContext();
  for (let y = 0; y < height; y += source.height) {
    for (let x = 0; x < width; x += source.width) {
      ctx.drawImage(source, x, y);
    }
  }
  if (radius > 0) {
    // Karta ma zaokrąglone narożniki — przycinamy do nich fakturę kamienia.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, Math.min(radius, width / 2, height / 2));
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  texture.refresh();
  return key;
}

/** Cień karty menu: miękka, ciemna krawędź rozłożona pod całą kartą, nie płaska plama. */
export function makeMenuCardShadow(
  scene: Phaser.Scene,
  cardWidth: number,
  cardHeight: number,
  cornerRadius: number = CARD.shadowRadius,
): string {
  const dpr = UI_RESOLUTION;
  const pad = Math.ceil(CARD.shadowPad * dpr);
  const width = Math.round((cardWidth + CARD.shadowPad * 2) * dpr);
  const height = Math.round((cardHeight + CARD.shadowPad * 2) * dpr);
  const key = `menu-card-shadow-${cardWidth}x${cardHeight}-r${Math.round(cornerRadius * 100)}-d${dpr}`;
  if (scene.textures.exists(key)) return key;

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return '';
  const ctx = texture.getContext();
  const x = pad;
  const y = pad;
  const w = cardWidth * dpr;
  const h = cardHeight * dpr;
  const radius = Math.max(0, cornerRadius) * dpr;

  // Rozmycie rozchodzi się na boki, z lekkim ciężarem cienia w dół.
  ctx.save();
  ctx.shadowColor = CARD.shadowColor;
  ctx.shadowBlur = CARD.shadowBlur * dpr;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = CARD.shadowOffsetY * dpr;
  ctx.fillStyle = CARD.shadowFill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.restore();
  texture.refresh();
  return key;
}

interface CamoTextTexture {
  width: number;
  height: number;
  shadowWidth: number;
  shadowHeight: number;
}

/**
 * Buduje teksturę napisu wypełnionego zimowym kamuflażem (bez obwódki).
 * Zwraca logiczny rozmiar (w px ekranu) albo null, gdy canvas jest niedostępny.
 */
export function makeCamoTextTexture(
  scene: Phaser.Scene,
  key: string,
  text: string,
  fontPx: number,
  fontFamily: string,
  resolution: number,
): CamoTextTexture | null {
  const scale = Math.max(1, Math.min(3, resolution));
  const font = `${Math.round(fontPx * scale)}px ${fontFamily}`;

  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.font = font;
  const metrics = probe.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fontPx * scale * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontPx * scale * 0.25;
  const pad = Math.round(6 * scale);
  const width = Math.ceil(metrics.width) + pad * 2;
  const height = Math.ceil(ascent + descent) + pad * 2;
  if (width <= 0 || height <= 0) return null;

  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvasTexture = scene.textures.createCanvas(key, width, height);
  if (!canvasTexture) return null;
  const ctx = canvasTexture.getContext();

  // 1. Tło: kolor podstawowy z lekkim pionowym przejściem.
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, TEXTURE.camo.base);
  base.addColorStop(1, TEXTURE.camo.tones[0]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // 2. Plamy moro: od największych (jasna szarość) po najmniejsze (chłodny cień).
  const rnd = camoRandom(0x5eed_2024);
  // Warstwy od ciemniejszych do jaśniejszych — biel jest ostatnia i najrzadsza,
  // więc pozostaje akcentem, a nie tłem wzoru.
  const layers = [
    { color: TEXTURE.camo.dark, count: 12, min: 0.3, max: 0.5 },
    { color: TEXTURE.camo.tones[2], count: 8, min: 0.26, max: 0.44 },
    { color: TEXTURE.camo.tones[1], count: 5, min: 0.2, max: 0.34 },
    { color: TEXTURE.camo.accent, count: 3, min: 0.12, max: 0.2 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    for (let i = 0; i < layer.count; i++) {
      const cx = rnd() * width;
      const cy = rnd() * height;
      const radius = height * (layer.min + rnd() * (layer.max - layer.min));
      camoBlob(ctx, rnd, cx, cy, radius);
    }
  }

  // 3. Drobne punkty — głównie jasne, co trzeci ciemniejszy — głębia w drobnej skali.
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 3 === 2 ? TEXTURE.camo.tones[3] : TEXTURE.camo.accent;
    const r = (0.6 + rnd() * 1.6) * scale;
    ctx.beginPath();
    ctx.arc(rnd() * width, rnd() * height, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Przycięcie wzoru do kształtu liter — bez obrysu i bez cienia.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000000';
  ctx.fillText(text, width / 2, pad + ascent);
  ctx.globalCompositeOperation = 'source-over';

  canvasTexture.refresh();

  // Wyraźniejszy cień typograficzny: głęboka szarość, większe przesunięcie i mocniejsze
  // rozmycie — kontrastuje z zielonym tłem, bez czarnej obwódki. Druga warstwa dodaje
  // poświatę przy krawędziach, żeby litery mocniej odcinały się od planszy.
  const shadowPad = Math.round(16 * scale);
  const shadowOffsetY = Math.round(3.5 * scale);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = width + shadowPad * 2;
  shadowCanvas.height = height + shadowPad * 2;
  const shadowCtx = shadowCanvas.getContext('2d');
  if (shadowCtx) {
    shadowCtx.filter = `blur(${Math.round(6.5 * scale)}px)`;
    shadowCtx.globalAlpha = 0.92;
    shadowCtx.drawImage(ctx.canvas, shadowPad, shadowPad + shadowOffsetY);
    shadowCtx.filter = 'none';
    shadowCtx.globalAlpha = 1;
    shadowCtx.globalCompositeOperation = 'source-in';
    shadowCtx.fillStyle = TEXTURE.camo.shadow;
    shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    shadowCtx.globalCompositeOperation = 'source-over';

    // warstwa poświaty na krawędziach — dodatkowo odcina litery od zielonego tła
    shadowCtx.globalAlpha = 0.75;
    shadowCtx.filter = `blur(${Math.round(2.5 * scale)}px)`;
    shadowCtx.drawImage(ctx.canvas, shadowPad, shadowPad + shadowOffsetY);
    shadowCtx.filter = 'none';
    shadowCtx.globalAlpha = 1;
    shadowCtx.globalCompositeOperation = 'source-in';
    shadowCtx.fillStyle = TEXTURE.camo.shadow;
    shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    shadowCtx.globalCompositeOperation = 'source-over';

    const shadowKey = key + '-shadow';
    if (scene.textures.exists(shadowKey)) scene.textures.remove(shadowKey);
    const shadowTexture = scene.textures.createCanvas(shadowKey, shadowCanvas.width, shadowCanvas.height);
    if (shadowTexture) {
      shadowTexture.getContext().drawImage(shadowCanvas, 0, 0);
      shadowTexture.refresh();
    }
  }

  return {
    width: width / scale,
    height: height / scale,
    shadowWidth: shadowCanvas.width / scale,
    shadowHeight: shadowCanvas.height / scale,
  };
}

/* =========================================================================================
   MIĘKKI CIEŃ WOKÓŁ IKONY (poświata naokoło, nie plama spod ikony).
   Kopia tekstury jest rozmywana i przyciemniana — powstaje poświata otaczająca ikonę
   z każdej strony. Generowana raz, jak wszystkie tekstury gry.
   ========================================================================================= */
export function makeIconShadowTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  shadowKey: string,
  blur: number,
  fill: number,
  alpha: number,
  passes = 1,
): boolean {
  if (scene.textures.exists(shadowKey)) return true;
  const src = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  if (!src || !src.width || !src.height) return false;

  const pad = Math.ceil(blur * 2.5);
  const width = src.width + pad * 2;
  const height = src.height + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // Każde kolejne nałożenie rozmytej sylwetki zagęszcza cień: alfa narasta
  // jak 1-(1-a)^passes, więc rdzeń jest kryjący, a brzeg nadal łagodnie gaśnie.
  ctx.filter = `blur(${blur}px)`;
  for (let i = 0; i < Math.max(1, passes); i++) {
    ctx.drawImage(src as CanvasImageSource, pad, pad);
  }
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  const r = (fill >> 16) & 255;
  const g = (fill >> 8) & 255;
  const b = fill & 255;
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';

  const texture = scene.textures.addCanvas(shadowKey, canvas);
  texture?.refresh();
  return Boolean(texture);
}
