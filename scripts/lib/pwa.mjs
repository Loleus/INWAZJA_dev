import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { decodeEntities, injectBeforeHeadEnd, template, walk } from './files.mjs';
import { iconPng, iconSvg } from './icons.mjs';

const THEME_COLOR = '#0b1220'; // kolor tła gry (PALETTE.night)
const BACKGROUND_COLOR = '#000000'; // tło strony (index.css)
const SHORT_NAME = 'INWAZJA';

const ICONS = [
  { file: 'icons/icon-192.png', size: 192, maskable: false, purpose: 'any' },
  { file: 'icons/icon-512.png', size: 512, maskable: false, purpose: 'any' },
  { file: 'icons/icon-maskable-512.png', size: 512, maskable: true, purpose: 'maskable' },
];
/** iOS sam zaokrągla rogi, więc ikona ma tło na całą powierzchnię. */
const APPLE_ICON = { file: 'icons/apple-touch-icon.png', size: 180, maskable: true };

function readMeta(html) {
  const title = decodeEntities((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || SHORT_NAME);
  const description = decodeEntities((html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || title);
  const lang = (html.match(/<html[^>]*\blang="([^"]+)"/i) || [])[1] || 'pl';
  return { title, description, lang };
}

/** Skrót zawartości wszystkich plików paczki — zmienia się z każdą zmianą gry, więc każda zmiana
    daje nowy sw.js, który przeglądarka rozpoznaje jako aktualizację. */
async function buildId(outDir, files) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update(await fs.readFile(path.join(outDir, file)));
  }
  return hash.digest('hex').slice(0, 12);
}

/** Zamienia zbudowany folder w PWA: manifest, ikony, skrypt rejestracji, service worker i tagi w index.html. */
export async function addPwa(html, outDir) {
  const { title, description, lang } = readMeta(html);

  await fs.mkdir(path.join(outDir, 'icons'), { recursive: true });
  for (const icon of [...ICONS, APPLE_ICON]) {
    await fs.writeFile(path.join(outDir, icon.file), iconPng(icon.size, icon.maskable));
  }
  await fs.writeFile(path.join(outDir, 'icons/icon.svg'), iconSvg());

  const manifest = {
    name: title,
    short_name: SHORT_NAME,
    description,
    lang,
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    categories: ['games'],
    icons: [
      ...ICONS.map((icon) => ({
        src: icon.file,
        sizes: `${icon.size}x${icon.size}`,
        type: 'image/png',
        purpose: icon.purpose,
      })),
      { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
  await fs.writeFile(path.join(outDir, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(outDir, 'pwa-register.js'), await template('pwa-register.js', {}));

  const head = [
    '    <link rel="manifest" href="./manifest.webmanifest" />',
    `    <meta name="theme-color" content="${THEME_COLOR}" />`,
    '    <link rel="icon" type="image/svg+xml" href="./icons/icon.svg" />',
    `    <link rel="apple-touch-icon" href="./${APPLE_ICON.file}" />`,
    '    <meta name="mobile-web-app-capable" content="yes" />',
    '    <meta name="apple-mobile-web-app-capable" content="yes" />',
    `    <meta name="apple-mobile-web-app-title" content="${SHORT_NAME}" />`,
    '    <script src="./pwa-register.js" defer></script>',
    '',
  ].join('\n');
  await fs.writeFile(path.join(outDir, 'index.html'), injectBeforeHeadEnd(html, head));

  // sw.js powstaje na końcu, bo zna skróty wszystkich pozostałych plików.
  const files = await walk(outDir);
  const build = await buildId(outDir, files);
  const sw = await template('sw.js', {
    "'__BUILD__'": JSON.stringify(build),
    "['__ASSETS__']": JSON.stringify(files.map((file) => `./${file}`)),
  });
  await fs.writeFile(path.join(outDir, 'sw.js'), sw);
  return { build, files: files.length + 1 };
}
