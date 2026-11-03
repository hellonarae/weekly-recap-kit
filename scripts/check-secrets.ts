// Fails if anything that looks like a secret is committed outside .env* files.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.vercel', '.supabase']);
const PATTERNS: [RegExp, string][] = [
  [/\bsk_[A-Za-z0-9]{16,}/, 'ElevenLabs/Stripe-style sk_ key'],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'JWT (Supabase key?)'],
  [/xi-api-key\s*[:=]\s*["']?[A-Za-z0-9]{8,}/i, 'xi-api-key with a value'],
  [/service_role[^\n]{0,40}eyJ/i, 'service-role key'],
];

let hits = 0;
function walk(dir: string): void {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full);
    if (SKIP_DIRS.has(name)) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (/^\.env(\..*)?$/.test(name)) continue;
    if (rel === 'scripts/check-secrets.ts') continue;
    if (st.size > 2_000_000 || /\.(mp3|png|jpg|jpeg|svg|woff2?|pptx|docx|pdf|ico)$/i.test(name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const [re, label] of PATTERNS) {
      const m = re.exec(text);
      if (m) {
        const line = text.slice(0, m.index).split('\n').length;
        console.error(`✗ ${rel}:${line}  looks like a ${label}`);
        hits++;
      }
    }
  }
}
walk(ROOT);
if (hits) { console.error(`\n${hits} possible secret(s). Move them to .env / GitHub Secrets.`); process.exit(1); }
console.log('✓ check:secrets — nothing suspicious outside .env files');
