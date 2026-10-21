import { mkdir, readdir, readFile, writeFile, lstat, realpath, rm } from 'node:fs/promises';
import path from 'node:path';

const root = await realpath(process.cwd());
const source = path.join(root, 'dist-pages');
const target = path.join(root, 'dist-hosted');
const forbidden = /data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]{200,}/;
const files = [];
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Refusing link: ${relative}`);
    if (entry.isDirectory()) { if (relative !== 'assets') throw new Error(`Unexpected output directory: ${relative}`); await collect(path.join(directory, entry.name), `${relative}/`); }
    else {
      if (relative !== 'index.html' && !/^assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(relative)) throw new Error(`Unexpected output file: ${relative}`);
      const content = await readFile(path.join(directory, entry.name), 'utf8');
      if (forbidden.test(content)) throw new Error(`Private label found in ${relative}`);
      files.push({ relative, content });
    }
  }
}
await collect(source);
const html = files.find(f => f.relative === 'index.html')?.content;
if (!html || !html.includes('/HOUSE/assets/')) throw new Error('Missing Pages entry or /HOUSE/ asset base.');
// Only replace this generated, direct child directory; never follow a symlink.
const previous = await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
if (previous) {
  if (previous.isSymbolicLink() || !previous.isDirectory() || await realpath(target) !== target || path.dirname(target) !== root) throw new Error('Unsafe hosted output path.');
  await rm(target, { recursive: true });
}
await mkdir(path.join(target, 'assets'), { recursive: true });
for (const file of files) await writeFile(path.join(target, file.relative), file.content);
await writeFile(path.join(target, '.nojekyll'), '');
console.log(`Prepared ${files.length + 1} static files in dist-hosted (no photos or source maps).`);
