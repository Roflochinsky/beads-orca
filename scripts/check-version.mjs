import { readFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
if (process.env.GITHUB_REF_NAME !== `v${version}`) throw new Error(`Release tag must be v${version}, not ${process.env.GITHUB_REF_NAME}.`);
console.log(`Release tag matches package version ${version}.`);
