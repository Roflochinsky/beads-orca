import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson(join(root, 'orca-plugin.json'));
const pkg = await readJson(join(root, 'package.json'));
assert.equal(manifest.manifestVersion, 2);
assert.equal(manifest.id, 'beads');
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.license, 'MIT');
assert.equal(pkg.license, 'MIT');
assert.equal(manifest.engines.orca, '>=1.4.248');
assert.equal(manifest.execution, 'trusted-worker');
assert.equal(Object.hasOwn(manifest, 'publisher'), false);

function inside(pluginRoot, from, reference) {
  assert.ok(reference && !/^(?:[a-z][a-z\d+.-]*:|\/|\\|#)/i.test(reference), `Not a local plugin resource: ${reference}`);
  const path = resolve(from, reference);
  const name = relative(pluginRoot, path);
  assert.ok(name && !isAbsolute(name) && name !== '..' && !name.startsWith(`..${sep}`), `Resource escapes plugin root: ${reference}`);
  return path;
}

async function graph(pluginRoot, entry, platform) {
  const result = await build({
    absWorkingDir: pluginRoot,
    entryPoints: [entry],
    outdir: join(tmpdir(), 'beads-orca-closure'),
    bundle: true,
    format: 'esm',
    platform,
    target: platform === 'node' ? 'node24' : 'es2022',
    loader: { '.woff2': 'file', '.svg': 'file' },
    metafile: true,
    write: false,
    logLevel: 'silent',
  });
  const paths = [];
  for (const [input, info] of Object.entries(result.metafile.inputs)) {
    const path = resolve(pluginRoot, input);
    inside(pluginRoot, pluginRoot, relative(pluginRoot, path));
    assert.ok(!relative(pluginRoot, path).split(sep).includes('node_modules'), `External package in plugin runtime: ${input}`);
    paths.push(path);
    for (const imported of info.imports) {
      if (imported.external) assert.ok(platform === 'node' && imported.path.startsWith('node:'), `External runtime import in ${input}: ${imported.path}`);
    }
  }
  return paths;
}

async function runtimeClosure(pluginRoot, pluginManifest) {
  const files = new Set([join(pluginRoot, 'orca-plugin.json'), join(pluginRoot, 'LICENSE')]);
  const addGraph = async (path, platform) => {
    for (const file of await graph(pluginRoot, path, platform)) files.add(file);
  };
  const worker = inside(pluginRoot, pluginRoot, pluginManifest.main);
  await addGraph(worker, 'node');
  assert.equal(pluginManifest.contributes.panels.length, 1);
  const panel = inside(pluginRoot, pluginRoot, pluginManifest.contributes.panels[0].entry);
  files.add(panel);
  const html = await readFile(panel, 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)];
  const styles = [...html.matchAll(/<link\b([^>]*)>/gi)];
  assert.equal(scripts.length, 1, 'Panel must have one module script');
  assert.equal(styles.length, 1, 'Panel must have one stylesheet');
  assert.match(scripts[0][1], /\btype=["']module["']/i);
  assert.match(styles[0][1], /\brel=["']stylesheet["']/i);
  const scriptRef = scripts[0][1].match(/\bsrc=["']([^"']+)["']/i)?.[1];
  const styleRef = styles[0][1].match(/\bhref=["']([^"']+)["']/i)?.[1];
  const script = inside(pluginRoot, dirname(panel), scriptRef);
  const style = inside(pluginRoot, dirname(panel), styleRef);
  assert.ok(['.js', '.mjs', '.ts', '.mts'].includes(extname(script)), 'Panel script must be a local module');
  assert.equal(extname(style), '.css');
  await addGraph(script, 'browser');
  await addGraph(style, 'browser');
  for (const image of [pluginManifest.icon, pluginManifest.cover?.path, ...(pluginManifest.screenshots ?? []).map((screenshot) => screenshot.path)]) {
    if (image) files.add(inside(pluginRoot, pluginRoot, image));
  }
  for (const file of files) assert.ok((await stat(file)).isFile(), `Missing plugin resource: ${file}`);
  return files;
}

const sourceFiles = await runtimeClosure(root, manifest);
for (const path of ['src/ui/THIRD-PARTY.md', 'src/ui/fonts/OFL.txt', 'src/ui/icons/LICENSE']) sourceFiles.add(join(root, path));
if (process.env.CI) {
  const entries = execFileSync('git', ['ls-files', '--stage', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const tracked = new Set();
  for (const entry of entries) {
    const match = entry.match(/^(\d+) [0-9a-f]+ \d+\t(.*)$/s);
    assert.ok(match, `Unexpected Git index entry: ${entry}`);
    assert.ok(match[1] === '100644' || match[1] === '100755', `Plugin repository contains a symlink or submodule: ${match[2]}`);
    tracked.add(match[2]);
  }
  for (const path of sourceFiles) {
    const name = relative(root, path).split(sep).join('/');
    assert.ok(tracked.has(name), `Runtime resource is not included in the Git tree: ${name}`);
  }
}

const builtRoot = join(root, 'dist/orca');
const builtManifest = await readJson(join(builtRoot, 'orca-plugin.json'));
const expectedManifest = structuredClone(manifest);
expectedManifest.main = 'worker.mjs';
expectedManifest.contributes.panels = expectedManifest.contributes.panels.map((panel) => ({ ...panel, entry: 'panel.html' }));
delete expectedManifest.icon;
delete expectedManifest.cover;
delete expectedManifest.screenshots;
assert.deepEqual(builtManifest, expectedManifest, 'Built manifest must match the public manifest except for bundled paths and listing images');
await runtimeClosure(builtRoot, builtManifest);

const archive = join(root, 'release', `beads-orca-${pkg.version}.tar.gz`);
const archiveBytes = await readFile(archive);
assert.ok(archiveBytes.length <= 2 * 1024 * 1024, 'Plugin archive exceeds 2 MiB');
const digest = createHash('sha256').update(archiveBytes).digest('hex');
assert.equal(await readFile(join(root, 'release/SHA256SUMS'), 'utf8'), `${digest}  beads-orca-${pkg.version}.tar.gz\n`);
const members = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
for (const member of members) {
  assert.ok(member === 'orca/' || (member.startsWith('orca/') && !member.split('/').some((part) => part === '.' || part === '..')), `Unexpected archive member: ${member}`);
}

async function tree(dir, base = dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await tree(path, base));
    else {
      assert.ok(entry.isFile(), `Non-file in built plugin: ${path}`);
      result.push(relative(base, path));
    }
  }
  return result.sort();
}

const temporary = await mkdtemp(join(tmpdir(), 'beads-orca-package-'));
try {
  execFileSync('tar', ['-xzf', archive, '-C', temporary]);
  const extractedRoot = join(temporary, 'orca');
  const builtFiles = await tree(builtRoot);
  assert.deepEqual(await tree(extractedRoot), builtFiles, 'Archive and built plugin must contain the same files');
  for (const name of builtFiles) {
    assert.deepEqual(await readFile(join(extractedRoot, name)), await readFile(join(builtRoot, name)), `Archive differs from build: ${name}`);
    assert.ok(!name.split(sep).some((part) => part === 'node_modules' || part === 'src' || part === '.git'), `Unexpected source or dependency in archive: ${name}`);
  }
  await runtimeClosure(extractedRoot, await readJson(join(extractedRoot, 'orca-plugin.json')));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
console.log(`Plugin source, built bundle, ${archiveBytes.length}-byte archive, and checksum have complete local runtime resources.`);
