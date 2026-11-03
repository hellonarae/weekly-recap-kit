import { z } from 'zod';
import type { Unit, VocabEntry } from '../../src/content/types';
import { loadYaml } from './yaml';
import type { Issues } from './issues';

const IMG = /^(flag:[a-z]{2}(-[a-z]+)?|icon:[a-z0-9-]+|photo|file:[A-Za-z0-9._-]+|color:#[0-9a-fA-F]{6})$/;

/** Entry schema. The course's language code (ko, es…) is accepted as an alias of tl via passthrough. */
export function entrySchema(_lang: string) {
  return z
    .object({
      n: z.number().int().optional(),
      tl: z.string().min(1).optional(),
      en: z.string().min(1),
      cat: z.string().optional(),
      kind: z.enum(['word', 'phrase', 'expression']).default('word'),
      note: z.string().optional(),
      audio: z.boolean().default(true),
      say: z.string().optional(),
      img: z.string().regex(IMG, 'img must be flag:<cc>, icon:<name>, photo, file:<name> or color:#rrggbb').optional(),
    })
    .passthrough();
}

export function vocabSchema(lang: string) {
  return z.object({
    level: z.string(),
    units: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        entries: z.array(entrySchema(lang)),
      }),
    ),
  });
}

type RawEntry = z.infer<ReturnType<typeof entrySchema>>;

/** Normalise a raw entry to VocabEntry; returns null (after reporting) when tl is missing/mixed. */
export function toEntry(raw: RawEntry, lang: string, rel: string, line: number | undefined, issues: Issues, keyUsed: { tl: boolean; alias: boolean }): Omit<VocabEntry, 'n'> & { n: number | undefined } | null {
  const aliasRaw = (raw as Record<string, unknown>)[lang];
  const alias = typeof aliasRaw === 'string' && aliasRaw.trim() ? aliasRaw : undefined;
  if (raw.tl !== undefined && alias !== undefined) {
    issues.error(rel, `entry has both tl and ${lang}; use one key`, line);
    return null;
  }
  const tl = raw.tl ?? alias;
  if (tl === undefined) {
    issues.error(rel, `entry "${raw.en}" has no target-language text (tl or ${lang})`, line);
    return null;
  }
  if (raw.tl !== undefined) keyUsed.tl = true;
  if (alias !== undefined) keyUsed.alias = true;
  const e: Omit<VocabEntry, 'n'> & { n: number | undefined } = {
    n: raw.n,
    tl: tl.trim(),
    en: raw.en.trim(),
    kind: raw.kind,
    audio: raw.audio,
  };
  if (raw.cat) e.cat = raw.cat.trim();
  if (raw.note) e.note = raw.note.trim();
  if (raw.img) e.img = raw.img;
  if (raw.say) e.say = raw.say.trim();
  return e;
}

export function loadVocab(file: string, rel: string, lang: string, levelId: string, issues: Issues): Unit[] {
  const { data, lineOf } = loadYaml(file, rel, vocabSchema(lang), issues);
  if (!data) return [];
  if (data.level !== levelId) issues.warn(rel, `level: "${data.level}" does not match the level id "${levelId}" in course.yml`, lineOf(['level']));
  const units: Unit[] = [];
  const seenUnit = new Set<string>();
  const keyUsed = { tl: false, alias: false };
  data.units.forEach((u, ui) => {
    if (seenUnit.has(u.id)) issues.error(rel, `duplicate unit id "${u.id}"`, lineOf(['units', ui, 'id']));
    seenUnit.add(u.id);
    const seenN = new Set<number>();
    const entries: VocabEntry[] = [];
    u.entries.forEach((raw, ei) => {
      const line = lineOf(['units', ui, 'entries', ei]);
      const e = toEntry(raw, lang, rel, line, issues, keyUsed);
      if (!e) return;
      if (e.n === undefined) {
        issues.error(rel, `entry "${e.tl}" in unit ${u.id} has no n`, line);
        return;
      }
      if (seenN.has(e.n)) issues.error(rel, `duplicate n=${e.n} in unit ${u.id}`, line);
      seenN.add(e.n);
      entries.push({ ...e, n: e.n, unit: u.id });
    });
    units.push({ id: u.id, label: u.label, entries, weeks: [] });
  });
  if (keyUsed.tl && keyUsed.alias) issues.error(rel, `mixes tl: and ${lang}: keys; use one throughout the file`);
  return units;
}

/** "1-10, 18-21" → predicate on n */
export function parseRange(spec: string): ((n: number) => boolean) | null {
  const parts = spec.split(',').map((s) => s.trim()).filter(Boolean);
  const tests: ((n: number) => boolean)[] = [];
  for (const p of parts) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(p);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (b < a) return null;
    tests.push((n) => n >= a && n <= b);
  }
  return (n) => tests.some((t) => t(n));
}
