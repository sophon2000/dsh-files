// Local candidate packaging only: no publication or Profile mutation.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const run = async (command, args) => (await promisify(execFile)(command, args, {
  cwd, timeout: 120000, maxBuffer: 8 * 1024 * 1024
})).stdout;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
assert.notEqual(process.env.DSH_FILES_FOLDER_UPLOAD, '1', 'only the default read-only build is qualified');
const root = await mkdtemp(path.join(tmpdir(), 'dsh-files-artifact-'));
const pkg = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'));
const packs = [];
for (const name of ['first', 'second']) {
  const dir = path.join(root, name);
  await mkdir(dir);
  await run('pnpm', ['run', 'build']);
  const [packed] = JSON.parse(await run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dir]));
  assert.equal(packed.name, pkg.name);
  assert.equal(packed.version, pkg.version);
  assert.equal(path.basename(packed.filename), packed.filename);
  const artifact = path.join(dir, packed.filename);
  packs.push({ artifact, sha256: digest(await readFile(artifact)), files: packed.files });
}
assert.equal(packs[0].sha256, packs[1].sha256, 'two builds/packs must be byte-identical in this fixed environment');
const files = packs[0].files.map(file => file.path).sort();
for (const required of ['LICENSE', 'FORK.md', 'package.json', 'cordis.patch.yml', 'lib/client.js', 'lib/index.js', 'lib/parse/worker.js']) {
  assert.ok(files.includes(required), `artifact missing ${required}`);
}
for (const file of files) {
  assert.match(file, /^(?:lib\/[\w./-]+|package\.json|cordis\.patch\.yml|CHANGELOG\.md|README(?:\.zh)?\.md|README\.i18n\.yaml|FORK\.md|LICENSE)$/,
    `unexpected packaged file: ${file}`);
  assert.ok(!file.split('/').includes('..'));
}
// Record the actual dirty source snapshot; never mislabel the base HEAD as a release commit.
const sourceNames = (await run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
const sourceFiles = [];
for (const file of [...new Set(sourceNames)].sort()) {
  try { sourceFiles.push({ path: file, sha256: digest(await readFile(path.join(cwd, file))) }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const status = (await run('git', ['status', '--porcelain'])).trim();
const manifest = {
  schemaVersion: 'dsh-files.candidate-artifact/1', package: pkg.name, version: pkg.version,
  status: 'local-candidate-not-published', releaseCommit: status ? null : (await run('git', ['rev-parse', 'HEAD'])).trim(),
  baseHead: (await run('git', ['rev-parse', 'HEAD'])).trim(), sourceDirty: !!status,
  sourceSnapshotSha256: digest(JSON.stringify(sourceFiles)), sourceFiles,
  sourceLockSha256: digest(await readFile(path.join(cwd, 'pnpm-lock.yaml'))),
  node: process.version, pnpm: (await run('pnpm', ['--version'])).trim(), npm: (await run('npm', ['--version'])).trim(),
  reproducibleInCurrentEnvironment: true, artifact: packs[0].artifact, artifactSha256: packs[0].sha256,
  files: packs[0].files
};
await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ directory: root, artifact: manifest.artifact, sha256: manifest.artifactSha256,
  version: pkg.version, sourceDirty: manifest.sourceDirty, files: files.length }, null, 2));
