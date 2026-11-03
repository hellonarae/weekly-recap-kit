import fs from 'node:fs';
import path from 'node:path';

/** Loads KEY=value lines from .env into process.env (no dotenv dependency). Real env wins. */
export function loadDotEnv(root: string): void {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2]!.replace(/^["']|["']$/g, '');
    if (process.env[m[1]!] === undefined && v) process.env[m[1]!] = v;
  }
}
