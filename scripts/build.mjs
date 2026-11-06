import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile('orca-plugin.json', 'utf8'));
if (manifest.version !== version) throw new Error(`Plugin version ${manifest.version} does not match package version ${version}.`);

await rm('dist/orca', { recursive: true, force: true });
await mkdir('dist/orca/ui/fonts', { recursive: true });
await mkdir('dist/orca/ui/icons', { recursive: true });
await build({ entryPoints: { panel: 'integrations/orca/panel.mjs', styles: 'src/ui/styles.css' }, outdir: 'dist/orca/ui', bundle: true, platform: 'browser', target: 'es2022', format: 'esm', sourcemap: true, loader: { '.woff2': 'file', '.svg': 'file' }, assetNames: 'assets/[name]-[hash]', logLevel: 'info' });
await writeFile('dist/orca/panel.html', '<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beads Board</title><link rel="stylesheet" href="./ui/styles.css"></head><body><div id="app"></div><script type="module" src="./ui/panel.js"></script></body></html>\n');
await cp('LICENSE', 'dist/orca/LICENSE');
await cp('src/ui/THIRD-PARTY.md', 'dist/orca/ui/THIRD-PARTY.md');
await cp('src/ui/fonts/OFL.txt', 'dist/orca/ui/fonts/OFL.txt');
await cp('src/ui/icons/LICENSE', 'dist/orca/ui/icons/LICENSE');
await build({ entryPoints: [manifest.main], outfile: 'dist/orca/worker.mjs', bundle: true, platform: 'node', target: 'node24', format: 'esm', sourcemap: true, logLevel: 'info' });

manifest.main = 'worker.mjs';
manifest.contributes.panels = manifest.contributes.panels.map((panel) => ({ ...panel, entry: 'panel.html' }));
delete manifest.icon;
delete manifest.cover;
delete manifest.screenshots;
await writeFile('dist/orca/orca-plugin.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built Beads Board ${version} for Orca.`);
