import fs from 'node:fs';
import type { Dialogue, DialogueItem } from '../../src/content/types';
import type { Issues } from './issues';
import { splitAudioOpts, type AudioOpts } from './grammar';

const TITLE = /^#\s+(.+?)(?:\s+[—–-]{1,2}\s+(.+))?$/;
const LINE = /^([^:\s][^:]*?):\s+(.+)$/;

/** Parses dialogue.md per FORMAT.md §4. Missing file → []. */
export function loadDialogues(file: string, rel: string, weekId: string, speakers: string[], issues: Issues): Dialogue[] {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const dialogues: Dialogue[] = [];
  let cur: Dialogue | null = null;
  let pendingLine: { speaker: string; tl: string; opts: AudioOpts; ln: number } | null = null;

  const closePending = () => {
    if (pendingLine) {
      issues.error(rel, `line "${pendingLine.speaker}: …" has no "> translation" under it`, pendingLine.ln);
      cur?.items.push({ kind: 'line', speaker: pendingLine.speaker, tl: pendingLine.tl, en: '', ...pendingLine.opts });
      pendingLine = null;
    }
  };
  const flush = () => {
    closePending();
    if (!cur) return;
    const n = cur.items.filter((i) => i.kind === 'line').length;
    if (n === 0) issues.error(rel, `dialogue "${cur.title ?? cur.id}" has no lines`);
    if (n > 12) issues.warn(rel, `dialogue "${cur.title ?? cur.id}" has ${n} lines; keep to 12`);
    dialogues.push(cur);
    cur = null;
  };

  lines.forEach((raw, i) => {
    const ln = i + 1;
    const line = raw.trimEnd();
    if (!line.trim()) return;
    if (line.startsWith('# ')) {
      flush();
      const m = TITLE.exec(line);
      cur = { id: `${weekId}-d${dialogues.length + 1}`, title: m?.[2]?.trim(), items: [] };
      return;
    }
    if (!cur) {
      issues.error(rel, 'text before the first "# Dialogue" heading', ln);
      return;
    }
    if (line.startsWith('>')) {
      if (!pendingLine) {
        issues.error(rel, 'translation line without a dialogue line above it', ln);
        return;
      }
      cur.items.push({ kind: 'line', speaker: pendingLine.speaker, tl: pendingLine.tl, en: line.replace(/^>\s?/, '').trim(), ...pendingLine.opts });
      pendingLine = null;
      return;
    }
    closePending();
    if (/^\(.*\)$/.test(line.trim())) {
      const d: DialogueItem = { kind: 'direction', text: line.trim().slice(1, -1) };
      cur.items.push(d);
      return;
    }
    const m = LINE.exec(line);
    if (!m) {
      issues.error(rel, 'expected "Speaker: text", "> translation" or "(stage direction)"', ln);
      return;
    }
    const speaker = m[1]!.trim();
    if (!speakers.includes(speaker)) issues.error(rel, `unknown speaker "${speaker}" (add it to course.yml → speakers)`, ln);
    const { text: tl, opts } = splitAudioOpts(m[2]!, rel, ln, issues);
    pendingLine = { speaker, tl, opts, ln };
  });
  flush();
  if (dialogues.length > 3) issues.warn(rel, `${dialogues.length} dialogues; keep to 1–3`);
  return dialogues;
}
