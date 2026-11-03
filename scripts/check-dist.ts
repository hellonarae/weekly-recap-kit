// After `vite build`: assert no teaching source file reached dist/.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const dist = path.join(ROOT, 'dist');
if (!fs.existsSync(dist)) { console.error('dist/ not found; run vite build first'); process.exit(1); }

function files(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return fs.statSync(f).isDirectory() ? files(f) : [f];
  });
}
const sourceNames = new Set<string>();
const levels = path.join(ROOT, 'levels');
if (fs.existsSync(levels)) for (const f of files(levels)) if (f.split(path.sep).includes('source')) sourceNames.add(path.basename(f));

let bad = 0;
for (const f of files(dist)) {
  const base = path.basename(f);
  if (sourceNames.has(base)) { console.error(`✗ dist contains a source file: ${path.relative(ROOT, f)}`); bad++; }
  if (/\.(pptx|docx|xlsx|pdf)$/i.test(base)) { console.error(`✗ dist contains an office/pdf file: ${path.relative(ROOT, f)}`); bad++; }
  if (/\.(js|html|json|css)$/.test(base) && /levels\/[^"']+\/source\//.test(fs.readFileSync(f, 'utf8'))) {
    console.error(`✗ ${path.relative(ROOT, f)} references a source/ path`); bad++;
  }
}
const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!/name="robots"\s+content="noindex/.test(index)) console.warn('⚠ dist/index.html has no noindex meta (publish.noindex is false?)');
if (bad) process.exit(1);
console.log(`✓ check:dist — ${files(dist).length} files, no source material`);
