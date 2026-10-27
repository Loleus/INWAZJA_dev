import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATES = path.join(ROOT, 'scripts', 'templates');

/** Wszystkie pliki katalogu jako posortowane ścieżki względne z ukośnikami `/`. */
export async function walk(dir, base = dir) {
  const found = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full, base)));
    else found.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return found.sort();
}

/** Szablon z podmianą dokładnych znaczników; brak znacznika to błąd, nie cicha pomyłka. */
export async function template(name, replacements) {
  let text = await fs.readFile(path.join(TEMPLATES, name), 'utf8');
  for (const [marker, value] of Object.entries(replacements)) {
    if (!text.includes(marker)) throw new Error(`Szablon ${name} nie zawiera znacznika ${marker}`);
    text = text.split(marker).join(value);
  }
  return text;
}

export function injectBeforeHeadEnd(html, snippet) {
  if (!html.includes('</head>')) throw new Error('index.html nie ma znacznika </head>');
  return html.replace('</head>', () => `${snippet}  </head>`);
}

export function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
}
