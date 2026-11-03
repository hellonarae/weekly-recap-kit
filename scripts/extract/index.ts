// npm run extract -- <file-or-dir> [...]  → prints slide/page text in order. Used by the drafting prompts.
import fs from 'node:fs';
import path from 'node:path';
import { extractPptx } from './pptx';
import { extractDocx } from './docx';

function files(p: string): string[] {
  if (fs.statSync(p).isDirectory()) return fs.readdirSync(p).filter((n) => !n.startsWith('.')).sort().map((n) => path.join(p, n)).flatMap(files);
  return [p];
}

const targets = process.argv.slice(2).flatMap(files);
if (targets.length === 0) { console.error('usage: npm run extract -- <file-or-dir>'); process.exit(1); }
for (const f of targets) {
  console.log(`\n===== ${f}`);
  if (/\.pptx$/i.test(f)) for (const s of extractPptx(f)) console.log(`\n--- slide ${s.page}\n${s.text}`);
  else if (/\.docx$/i.test(f)) for (const b of extractDocx(f)) console.log(b.kind === 'row' ? `| ${b.text}` : `${b.style ? `[${b.style}] ` : ''}${b.text}`);
  else console.log('(unsupported type)');
}
