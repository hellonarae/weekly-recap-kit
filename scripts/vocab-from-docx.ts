// One-off converter (PROMPTS.md §1): teacher's vocabulary docx → levels/<L>/vocab.yml
// usage: tsx scripts/vocab-from-docx.ts <docx> <level-id> <lang> > levels/<L>/vocab.yml
// Keeps unit order, numbering and English glosses exactly. Rows it cannot parse get note: "CHECK: …".
import { extractDocx } from './extract/docx';

const [file, levelId, lang = 'ko'] = process.argv.slice(2);
if (!file || !levelId) { console.error('usage: tsx scripts/vocab-from-docx.ts <docx> <level-id> [lang]'); process.exit(1); }

interface Entry { n: number; tl: string; en: string; cat?: string; kind?: string; note?: string }
interface Unit { id: string; label: string; entries: Entry[] }

const units: Unit[] = [];
let cur: Unit | null = null;
let cat: string | undefined;
let checks = 0;

function unitId(label: string, index: number): string {
  const ko = /\(준비\s*(\d+)\)/.exec(label);
  if (ko) return `준비${ko[1]}`;
  const en = /^Unit\s*(\d+)/i.exec(label);
  if (en) return `unit${en[1]}`;
  return `unit${index + 1}`;
}

/** phrase = a full sentence or conjugated form; expression = multi-word fixed expression in dictionary form. */
function kindOf(tl: string): string | undefined {
  if (/\s-\s/.test(tl)) return undefined; // "공부하다 - 공부해요": dictionary + polite form of one verb → word
  if (/[.?!]$/.test(tl) || /요$/.test(tl)) return 'phrase';
  if (/\s/.test(tl) && /다$/.test(tl)) return 'expression';
  return undefined;
}

for (const b of extractDocx(file)) {
  if (b.kind === 'p') {
    if (b.style === 'UnitHeading' || /^(Unit|Preparatory Unit)\s*\d/.test(b.text)) {
      cur = { id: unitId(b.text, units.length), label: b.text, entries: [] };
      units.push(cur);
      cat = undefined;
    }
    continue;
  }
  const cells = b.cells ?? [];
  if (!cur) continue;
  if (cells.length === 1 || (cells.length > 1 && cells.slice(1).every((c) => !c))) {
    cat = cells[0];
    continue;
  }
  if (cells[0] === 'No.') continue;
  const n = Number(cells[0]);
  const tl = (cells[1] ?? '').trim();
  const en = (cells[2] ?? '').trim();
  const e: Entry = { n, tl, en };
  if (cat) e.cat = cat;
  const kind = kindOf(tl);
  if (kind) e.kind = kind;
  if (!Number.isInteger(n) || !tl || !en) { e.note = `CHECK: row "${cells.join(' | ')}"`; checks++; }
  if (cells.length > 3 && cells.slice(3).some(Boolean)) { e.note = `CHECK: extra cells "${cells.slice(3).join(' | ')}"`; checks++; }
  cur.entries.push(e);
}

const q = (s: string) => JSON.stringify(s);
const lines: string[] = [`level: ${levelId}`, 'units:'];
for (const u of units) {
  lines.push(`  - id: ${u.id}`, `    label: ${q(u.label)}`, '    entries:');
  const w = Math.max(...u.entries.map((e) => String(e.n).length));
  for (const e of u.entries) {
    const parts = [`n: ${String(e.n).padEnd(w)}`, `${lang}: ${q(e.tl)}`, `en: ${q(e.en)}`];
    if (e.cat) parts.push(`cat: ${q(e.cat)}`);
    if (e.kind) parts.push(`kind: ${e.kind}`);
    if (e.note) parts.push(`note: ${q(e.note)}`);
    lines.push(`      - { ${parts.join(', ')} }`);
  }
}
process.stdout.write(lines.join('\n') + '\n');
console.error(`units: ${units.length} · entries: ${units.map((u) => `${u.id}=${u.entries.length}`).join(', ')} · CHECK rows: ${checks}`);
