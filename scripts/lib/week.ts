import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import type { Unit, VocabEntry, Week } from '../../src/content/types';
import { loadYaml } from './yaml';
import { entrySchema, parseRange, toEntry } from './vocab';
import type { Issues } from './issues';

const AUTO = ['flashcards', 'match_vocab', 'dialogue_order', 'listen_choose'] as const;

export function weekSchema(lang: string) {
  const vocabBlock = z.object({
    include: z.array(z.object({ unit: z.string(), range: z.string() })).default([]),
    extra: z.array(entrySchema(lang)).default([]),
  });
  return z.object({
    level: z.string(),
    week: z.number().int().positive(),
    title: z.string().min(1),
    units: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published']).default('published'),
    estimated_minutes: z.number().int().positive().optional(),
    vocab: vocabBlock.optional(),
    auto: z.array(z.enum(AUTO)).default([...AUTO]),
    shuffle_quiz: z.boolean().default(false),
  });
}

export interface WeekMeta {
  week: Omit<Week, 'grammar' | 'dialogues' | 'quiz'>;
}

/** Reads week.yml (+ optional vocab.yml) and resolves the week's vocabulary from the level's units. */
export function loadWeekMeta(dir: string, relDir: string, lang: string, levelId: string, units: Unit[], issues: Issues): WeekMeta | null {
  const rel = `${relDir}/week.yml`;
  const { data, lineOf } = loadYaml(path.join(dir, 'week.yml'), rel, weekSchema(lang), issues);
  if (!data) return null;
  if (data.level !== levelId) issues.error(rel, `level: "${data.level}" but the folder is under level ${levelId}`, lineOf(['level']));
  if (data.title.length > 40) issues.warn(rel, `title is ${data.title.length} chars; keep it under 40`, lineOf(['title']));
  if (data.estimated_minutes === undefined) issues.warn(rel, 'estimated_minutes missing', lineOf(['week']));

  const unitById = new Map(units.map((u) => [u.id, u]));
  data.units.forEach((id, i) => {
    if (!unitById.has(id)) issues.error(rel, `unknown unit id "${id}" (not in the level's vocab.yml)`, lineOf(['units', i]));
  });

  // Optional separate vocab.yml with the same shape as week.yml → vocab
  let vocabCfg = data.vocab;
  let vocabRel = rel;
  let vocabLineOf = (p: (string | number)[]) => lineOf(['vocab', ...p]);
  const sep = path.join(dir, 'vocab.yml');
  if (fs.existsSync(sep)) {
    if (vocabCfg) issues.warn(rel, 'both week.yml → vocab and vocab.yml exist; vocab.yml wins');
    vocabRel = `${relDir}/vocab.yml`;
    const sepSchema = weekSchema(lang).shape.vocab.unwrap();
    const loaded = loadYaml(sep, vocabRel, sepSchema, issues);
    vocabCfg = loaded.data ?? undefined;
    vocabLineOf = loaded.lineOf;
  }

  // Resolve: union of units' entries, narrowed by include ranges, plus extras.
  const includeByUnit = new Map<string, (n: number) => boolean>();
  vocabCfg?.include.forEach((inc, i) => {
    if (!unitById.has(inc.unit)) {
      issues.error(vocabRel, `include: unknown unit "${inc.unit}"`, vocabLineOf(['include', i, 'unit']));
      return;
    }
    if (!data.units.includes(inc.unit)) issues.warn(vocabRel, `include: unit "${inc.unit}" is not listed in units:`, vocabLineOf(['include', i]));
    const pred = parseRange(inc.range);
    if (!pred) {
      issues.error(vocabRel, `include: bad range "${inc.range}" (use "1-10, 18-21")`, vocabLineOf(['include', i, 'range']));
      return;
    }
    includeByUnit.set(inc.unit, pred);
  });

  const vocab: VocabEntry[] = [];
  for (const id of data.units) {
    const u = unitById.get(id);
    if (!u) continue;
    const pred = includeByUnit.get(id);
    for (const e of u.entries) if (!pred || pred(e.n)) vocab.push(e);
  }
  const keyUsed = { tl: false, alias: false };
  vocabCfg?.extra.forEach((raw, i) => {
    const e = toEntry(raw, lang, vocabRel, vocabLineOf(['extra', i]), issues, keyUsed);
    if (e) vocab.push({ ...e, n: e.n ?? 0 });
  });
  if ((vocabCfg?.extra.length ?? 0) > 10) issues.warn(vocabRel, `vocab.extra has ${vocabCfg?.extra.length} entries; keep it to 10`, vocabLineOf(['extra']));

  const id = `${levelId}-w${String(data.week).padStart(2, '0')}`;
  return {
    week: {
      id,
      level: levelId,
      week: data.week,
      title: data.title,
      units: data.units,
      status: data.status,
      estimated_minutes: data.estimated_minutes,
      vocab,
      auto: data.auto,
      shuffle_quiz: data.shuffle_quiz,
      dir: relDir,
    },
  };
}
