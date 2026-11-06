import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

await rm('dist/orca', { recursive: true, force: true });
await cp('integrations/orca', 'dist/orca', { recursive: true });
await build({ entryPoints: ['src/ui/entry.ts'], outdir: 'dist/orca/ui', bundle: true, platform: 'browser', target: 'es2022', format: 'esm', sourcemap: true, loader: { '.woff2': 'file', '.svg': 'file' }, assetNames: 'assets/[name]-[hash]', logLevel: 'info' });
await writeFile('dist/orca/panel.html', '<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beads Board</title><link rel="stylesheet" href="./ui/entry.css"></head><body><div id="app"></div><script type="module" src="./ui/entry.js"></script></body></html>\n');
await mkdir('dist/orca/ui/licenses', { recursive: true });
await cp('src/ui/THIRD-PARTY.md', 'dist/orca/ui/THIRD-PARTY.md');
await cp('src/ui/fonts/OFL.txt', 'dist/orca/ui/licenses/Onest-OFL.txt');
await cp('src/ui/icons/LICENSE', 'dist/orca/ui/licenses/Material-Symbols-LICENSE');
await build({ entryPoints: ['src/orca/worker.ts'], outfile: 'dist/orca/worker.mjs', bundle: true, platform: 'node', target: 'node24', format: 'esm', sourcemap: true, logLevel: 'info' });
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const manifestPath = 'dist/orca/orca-plugin.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.version = version;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built Beads Board ${version} for Orca.`);
