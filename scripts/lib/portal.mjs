import fs from 'node:fs/promises';
import path from 'node:path';
import { injectBeforeHeadEnd, template } from './files.mjs';

/** Dokłada do index.html tag SDK portalu i adapter cyklu życia gry (jeśli portal ma SDK). */
export async function addPortal(html, target, outDir) {
  let head = '';
  if (target.sdkSrc) head += `    <script src="${target.sdkSrc}"></script>\n`;
  if (target.adapter) {
    const adapter = await template('portal-adapter.js', { "'__PORTAL__'": JSON.stringify(target.adapter) });
    head += `    <script>\n${adapter}    </script>\n`;
  }
  await fs.writeFile(path.join(outDir, 'index.html'), head ? injectBeforeHeadEnd(html, head) : html);
}
