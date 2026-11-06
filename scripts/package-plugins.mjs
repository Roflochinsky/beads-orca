import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('release', { recursive: true });
const archive = `beads-orca-${version}.tar.gz`;
execFileSync('tar', ['-czf', join('release', archive), '-C', 'dist', 'orca']);
const hash = createHash('sha256');
for await (const chunk of createReadStream(join('release', archive))) hash.update(chunk);
await writeFile('release/SHA256SUMS', `${hash.digest('hex')}  ${archive}\n`);
console.log(`Packaged ${archive} with SHA256SUMS.`);
