// Builds the deployable site into dist/. No dependencies: run with `node scripts/build.mjs`.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// engine.js ends with a Node-only export line used by the tests; leave it out of the browser file.
const engine = readFileSync(join(src, 'engine.js'), 'utf8').split('if (typeof module')[0];
const ui = readFileSync(join(src, 'ui.js'), 'utf8');
writeFileSync(join(dist, 'app.js'), '"use strict";\n' + engine + '\n' + ui);

for (const f of ['index.html', 'admin.html', 'admin.js', 'favicon.svg', 'robots.txt', '_headers']) copyFileSync(join(src, f), join(dist, f));
console.log('Built dist/ (index.html, app.js, admin.html, admin.js, favicon.svg, robots.txt, _headers)');
