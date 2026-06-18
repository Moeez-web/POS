// Copies non-TS assets (SQL migrations) into dist/ after tsc, since tsc only emits JS.
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'src', 'db', 'migrations');
const dest = path.join(__dirname, '..', 'dist', 'db', 'migrations');

fs.mkdirSync(dest, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(src)) {
  if (f.endsWith('.sql')) {
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
    n++;
  }
}
console.log(`Copied ${n} migration file(s) to dist.`);
