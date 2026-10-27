/* Lokalizacja czcionek Google na potrzeby buildów wielopilkowych.
   Portale (Yandex, Poki, CrazyGames) nie lubią zewnętrznych zapytań, a PWA ma działać niezależnie od
   miejsca wystawienia — dlatego przy budowaniu pobieramy pliki woff2 z arkusza podanego w index.html
   i dołączamy je do paczki. Pobrane pliki są w node_modules/.cache, więc kolejne buildy działają
   bez sieci. Zostawiamy podzbiory latin (ó) i latin-ext (ą ć ę ł ń ś ź ż). */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SUBSETS = new Set(['latin', 'latin-ext']);
const REQUEST_TIMEOUT_MS = 20000;

const sha = (text) => createHash('sha1').update(text).digest('hex').slice(0, 10);

export function findGoogleFontsUrl(html) {
  const match = html.match(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2?[^"]+)"[^>]*>/i);
  return match ? match[1].replace(/&amp;/g, '&') : null;
}

async function request(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response;
}

/** Pobiera arkusz i pliki czcionek; zwraca `{ css, files: Map(nazwa → Buffer) }` z lokalnymi adresami. */
async function fetchFonts(cssUrl) {
  const css = await (await request(cssUrl)).text();
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)].filter((m) =>
    SUBSETS.has(m[1]),
  );
  if (!blocks.length) throw new Error('arkusz nie zawiera podzbiorów latin / latin-ext');

  const files = new Map();
  const names = new Map();
  const rules = [];
  for (const [, , rule] of blocks) {
    const url = (rule.match(/url\((https:[^)]+)\)/) || [])[1];
    if (!url) continue;
    if (!names.has(url)) {
      const name = `${sha(url)}.woff2`;
      names.set(url, name);
      files.set(name, Buffer.from(await (await request(url)).arrayBuffer()));
    }
    rules.push(rule.replace(url, `./${names.get(url)}`));
  }
  return { css: `${rules.join('\n')}\n`, files };
}

async function readCache(dir) {
  try {
    const css = await fs.readFile(path.join(dir, 'fonts.css'), 'utf8');
    const files = new Map();
    for (const name of await fs.readdir(dir)) {
      if (name.endsWith('.woff2')) files.set(name, await fs.readFile(path.join(dir, name)));
    }
    return files.size ? { css, files } : null;
  } catch {
    return null;
  }
}

async function writeCache(dir, { css, files }) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'fonts.css'), css);
  for (const [name, data] of files) await fs.writeFile(path.join(dir, name), data);
}

async function loadFonts(cssUrl, cacheDir, refresh) {
  if (!refresh) {
    const cached = await readCache(cacheDir);
    if (cached) return cached;
  }
  try {
    const fresh = await fetchFonts(cssUrl);
    await writeCache(cacheDir, fresh);
    return fresh;
  } catch (error) {
    const stale = await readCache(cacheDir);
    if (stale) {
      console.warn(`  ! Nie udało się odświeżyć czcionek (${error.message}) — używam kopii z cache.`);
      return stale;
    }
    throw new Error(
      `Nie udało się pobrać czcionek Google (${error.message}). ` +
        'Pierwszy build wielopilkowy wymaga dostępu do sieci; kolejne korzystają z node_modules/.cache.',
    );
  }
}

/** Zamienia zewnętrzny arkusz Google Fonts na lokalny `fonts/fonts.css` i zwraca nowy HTML. */
export async function localizeFonts(html, outDir, { root, refresh = false }) {
  const cssUrl = findGoogleFontsUrl(html);
  if (!cssUrl) return html;

  const cacheDir = path.join(root, 'node_modules', '.cache', 'inwazja-fonts', sha(cssUrl));
  const { css, files } = await loadFonts(cssUrl, cacheDir, refresh);

  const fontsDir = path.join(outDir, 'fonts');
  await fs.mkdir(fontsDir, { recursive: true });
  await fs.writeFile(path.join(fontsDir, 'fonts.css'), css);
  for (const [name, data] of files) await fs.writeFile(path.join(fontsDir, name), data);

  const withoutGoogle = html.replace(/[ \t]*<link[^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*/gi, '');
  return withoutGoogle.replace('</head>', () => '    <link rel="stylesheet" href="./fonts/fonts.css" />\n  </head>');
}
