import fs from 'node:fs';
import type { GrammarPoint } from '../../src/content/types';
import type { Issues } from './issues';

const H2 = /^##\s+(.+?)\s+[—–-]{1,2}\s+(.+)$/; // "## pattern — label" (accepts — – or - / --)
const H2_NOLABEL = /^##\s+(.+)$/;
const EXAMPLE = /^-\s+(.+?)\s+[—–]\s+(.+)$/;
/** Trailing audio options on an example or dialogue line: `{say: …}` (what the voice says instead of the
 *  display text) and `{speed: 0.8}` (ElevenLabs speed for this line only). Any order; not shown on screen. */
export interface AudioOpts { say?: string; speed?: number }
const OPT = /\s*\{(say|speed):\s*([^{}]+?)\s*\}\s*$/u;
export function splitAudioOpts(text: string, rel: string, ln: number, issues: Issues): { text: string; opts: AudioOpts } {
  const opts: AudioOpts = {};
  let s = text;
  for (let m = OPT.exec(s); m; m = OPT.exec(s)) {
    if (m[1] === 'say') opts.say = m[2]!;
    else {
      const v = Number(m[2]);
      if (v >= 0.7 && v <= 1.2) opts.speed = v;
      else issues.error(rel, `{speed: ${m[2]}} must be between 0.7 and 1.2`, ln);
    }
    s = s.slice(0, m.index);
  }
  return { text: s.trim(), opts };
}

/** Parses grammar.md per FORMAT.md §3. Missing file → []. */
export function loadGrammar(file: string, rel: string, weekId: string, issues: Issues): GrammarPoint[] {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const points: GrammarPoint[] = [];
  let cur: GrammarPoint | null = null;
  let inExamples = false;
  let bodyLines: string[] = [];

  const flush = () => {
    if (!cur) return;
    cur.body = bodyLines.join('\n').trim();
    if (cur.examples.length < 2) issues.warn(rel, `"${cur.pattern}" has ${cur.examples.length} example(s); give 2–6`);
    if (cur.examples.length > 6) issues.warn(rel, `"${cur.pattern}" has ${cur.examples.length} examples; keep to 6`);
    points.push(cur);
    cur = null;
    bodyLines = [];
    inExamples = false;
  };

  lines.forEach((raw, i) => {
    const ln = i + 1;
    const line = raw.trimEnd();
    if (line.startsWith('## ')) {
      flush();
      const m = H2.exec(line);
      if (!m) {
        const m2 = H2_NOLABEL.exec(line);
        issues.error(rel, 'grammar heading must be "## <pattern> — <English label>"', ln);
        cur = { id: `${weekId}-g${points.length + 1}`, pattern: m2?.[1]?.trim() ?? line, label: '', body: '', examples: [], tips: [] };
      } else {
        cur = { id: `${weekId}-g${points.length + 1}`, pattern: m[1]!.trim(), label: m[2]!.trim(), body: '', examples: [], tips: [] };
      }
      return;
    }
    if (line.startsWith('# ')) {
      issues.error(rel, 'use "## " for grammar points; "# " is not allowed here', ln);
      return;
    }
    if (/^#{4,}\s/.test(line)) {
      issues.error(rel, 'headings deeper than ### are not allowed', ln);
      return;
    }
    if (!cur) {
      if (line.trim()) issues.error(rel, 'text before the first "## " heading', ln);
      return;
    }
    if (/^###\s+examples\s*$/i.test(line)) {
      inExamples = true;
      return;
    }
    if (line.startsWith('### ')) {
      inExamples = false;
      issues.warn(rel, `unexpected sub-heading "${line}"; only "### Examples" is rendered`, ln);
      return;
    }
    if (line.startsWith('>')) {
      cur.tips.push(line.replace(/^>\s?/, '').trim());
      return;
    }
    if (inExamples) {
      if (!line.trim()) return;
      const { text, opts } = splitAudioOpts(line, rel, ln, issues);
      const m = EXAMPLE.exec(text);
      if (!m) {
        issues.error(rel, 'example must be "- <target sentence> — <English>" (optionally followed by {say: …} / {speed: …})', ln);
        return;
      }
      cur.examples.push({ tl: m[1]!.trim(), en: m[2]!.trim(), ...opts });
      return;
    }
    if (/<[a-z][^>]*>/i.test(line)) issues.error(rel, 'HTML is not allowed in content files', ln);
    bodyLines.push(line);
  });
  flush();
  for (const p of points) {
    const sentences = p.body.split(/[.!?](\s|$)/).filter((s) => s.trim().length > 1).length;
    if (sentences > 4) issues.warn(rel, `"${p.pattern}": body is ${sentences} sentences; keep to 1–3`);
  }
  return points;
}
