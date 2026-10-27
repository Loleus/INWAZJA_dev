#!/usr/bin/env node
/* Buildy wielopilkowe obok domyślnego, jednoplikowego `npm run build` (dist/index.html).

   Użycie:  node scripts/build.mjs <cel...> [--refresh-fonts]
   Cele:    pwa | yandex | itch | crazygames | poki | portals (cztery portale) | all (pwa + portale)

   Wyniki:  dist-pwa/                       folder PWA do wystawienia pod HTTPS
            dist-portals/<portal>/          folder gry dla portalu
            dist-portals/inwazja-<portal>.zip   archiwum do wgrania (index.html w korzeniu)
   Katalog dist/ (build jednoplikowy) pozostaje nietknięty. */
import { zipSync } from 'fflate';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';
import { ROOT, formatSize, walk } from './lib/files.mjs';
import { localizeFonts } from './lib/fonts.mjs';
import { addPortal } from './lib/portal.mjs';
import { addPwa } from './lib/pwa.mjs';
import { GROUPS, TARGETS } from './lib/targets.mjs';

const ALREADY_COMPRESSED = /\.(woff2|png)$/i;

function usage() {
  console.log(
    [
      'Użycie: node scripts/build.mjs <cel...> [--refresh-fonts]',
      `Cele:   ${Object.keys(TARGETS).join(' | ')} | ${Object.keys(GROUPS).join(' | ')}`,
      'Przykład: node scripts/build.mjs yandex poki',
    ].join('\n'),
  );
}

async function folderSize(dir, files) {
  let total = 0;
  for (const file of files) total += (await fs.stat(path.join(dir, file))).size;
  return total;
}

async function zipFolder(dir, zipPath) {
  const entries = {};
  for (const file of await walk(dir)) {
    const data = new Uint8Array(await fs.readFile(path.join(dir, file)));
    entries[file] = [data, { level: ALREADY_COMPRESSED.test(file) ? 0 : 9 }];
  }
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await fs.rm(zipPath, { force: true });
  await fs.writeFile(zipPath, zipSync(entries));
  return (await fs.stat(zipPath)).size;
}

async function buildTarget(name, { refreshFonts }) {
  const target = TARGETS[name];
  const outDir = path.join(ROOT, target.outDir);
  console.log(`\n▶ ${target.label}`);

  await viteBuild({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.multifile.config.ts'),
    logLevel: 'warn',
    build: { outDir, emptyOutDir: true },
  });

  let html = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
  html = await localizeFonts(html, outDir, { root: ROOT, refresh: refreshFonts });
  if (target.kind === 'pwa') {
    const { build } = await addPwa(html, outDir);
    console.log(`  wersja:  ${build}`);
  } else {
    await addPortal(html, target, outDir);
  }

  const files = await walk(outDir);
  console.log(`  folder:  ${target.outDir}/  (${files.length} plików, ${formatSize(await folderSize(outDir, files))})`);
  if (target.zip) {
    const size = await zipFolder(outDir, path.join(ROOT, target.zip));
    console.log(`  archiwum: ${target.zip}  (${formatSize(size)})`);
  }
  console.log(`  uwaga:   ${target.note}`);
}

async function main() {
  const args = process.argv.slice(2);
  const wanted = args.filter((arg) => !arg.startsWith('--'));
  if (args.includes('--help') || !wanted.length) {
    usage();
    return;
  }
  const names = [...new Set(wanted.flatMap((arg) => GROUPS[arg] ?? [arg]))];
  const unknown = names.filter((name) => !TARGETS[name]);
  if (unknown.length) throw new Error(`Nieznany cel: ${unknown.join(', ')}. Dostępne: ${Object.keys(TARGETS).join(', ')}`);

  const flags = args.filter((arg) => arg.startsWith('--'));
  if (names.length === 1) {
    await buildTarget(names[0], { refreshFonts: flags.includes('--refresh-fonts') });
    return;
  }

  // Każdy cel w osobnym procesie: kolejne buildy Vite w jednym procesie gromadzą pamięć
  // (przy czterech portalach kończyło się brakiem pamięci), a awaria jednego celu nie psuje następnych.
  for (const name of names) {
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), name, ...flags], { stdio: 'inherit' });
    if (run.status !== 0) throw new Error(`Budowanie celu „${name}” nie powiodło się.`);
  }
}

main().catch((error) => {
  console.error(`\nBłąd budowania: ${error.message}`);
  process.exit(1);
});
