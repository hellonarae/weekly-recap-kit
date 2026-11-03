import { z } from 'zod';
import type { QuizItem } from '../../src/content/types';
import { loadYaml } from './yaml';
import type { Issues } from './issues';

const base = { id: z.string().min(1), explain: z.string().optional() };
const ItemSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('mcq'), prompt: z.string().min(1), options: z.array(z.string().min(1)).min(2).max(4), answer: z.number().int() }),
  z.object({ ...base, type: z.literal('blank'), sentence: z.string().min(1), options: z.array(z.string().min(1)).min(2).max(4), answer: z.number().int() }),
  z.object({ ...base, type: z.literal('order'), prompt: z.string().min(1), chunks: z.array(z.string().min(1)).min(2).max(7), answer: z.string().min(1), accept: z.array(z.string()).default([]) }),
  z.object({ ...base, type: z.literal('type'), prompt: z.string().min(1), answer: z.string().min(1), accept: z.array(z.string()).default([]), chunks: z.array(z.string().min(1)).optional() }),
  z.object({ ...base, type: z.literal('match'), pairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])).min(2).max(8) }),
  z.object({ ...base, type: z.literal('tf'), statement: z.string().min(1), answer: z.boolean(), explain: z.string().optional() }),
]);
const QuizSchema = z.object({ items: z.array(ItemSchema).default([]) });

/** Can `answer` be built from a permutation of a subset of `chunks`? */
export function buildableFromChunks(answer: string, chunks: string[]): boolean {
  const pool = [...chunks];
  for (const word of answer.trim().split(/\s+/)) {
    const i = pool.indexOf(word);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return true;
}

export interface QuizOptions {
  typingQuizzes: boolean;
  /** Ids already used elsewhere in the level (uniqueness is level-wide). */
  seenIds: Set<string>;
  isRecap: boolean;
}

export function loadQuiz(file: string, rel: string, opts: QuizOptions, issues: Issues): QuizItem[] {
  const { data, lineOf } = loadYaml(file, rel, QuizSchema, issues);
  if (!data) return [];
  const out: QuizItem[] = [];
  data.items.forEach((it, i) => {
    const line = lineOf(['items', i]);
    if (opts.seenIds.has(it.id)) issues.error(rel, `duplicate item id "${it.id}"`, line);
    opts.seenIds.add(it.id);
    if (it.explain && it.explain.split(/\s+/).length > 20) issues.warn(rel, `${it.id}: explain is over 20 words`, lineOf(['items', i, 'explain']));

    switch (it.type) {
      case 'mcq':
        if (it.answer < 0 || it.answer >= it.options.length) issues.error(rel, `${it.id}: answer ${it.answer} is out of range (0–${it.options.length - 1})`, lineOf(['items', i, 'answer']));
        if (it.options.length < 3) issues.warn(rel, `${it.id}: mcq should have 3–4 options`, line);
        out.push(it);
        return;
      case 'blank': {
        const gaps = it.sentence.split('___').length - 1;
        if (gaps !== 1) issues.error(rel, `${it.id}: sentence must contain exactly one ___ (found ${gaps})`, lineOf(['items', i, 'sentence']));
        if (it.answer < 0 || it.answer >= it.options.length) issues.error(rel, `${it.id}: answer ${it.answer} is out of range (0–${it.options.length - 1})`, lineOf(['items', i, 'answer']));
        out.push(it);
        return;
      }
      case 'order': {
        const joined = it.answer.trim().split(/\s+/);
        const full = joined.length === it.chunks.length && buildableFromChunks(it.answer, it.chunks);
        if (!full) issues.error(rel, `${it.id}: answer must be all chunks joined by spaces in some order`, lineOf(['items', i, 'answer']));
        it.accept.forEach((a, k) => {
          if (!buildableFromChunks(a, it.chunks)) issues.error(rel, `${it.id}: accept "${a}" cannot be built from the chunks`, lineOf(['items', i, 'accept', k]));
        });
        if (it.chunks.length < 3) issues.warn(rel, `${it.id}: order items work best with 3–7 chunks`, line);
        out.push(it);
        return;
      }
      case 'type':
        if (opts.typingQuizzes) {
          out.push(it);
        } else if (it.chunks && it.chunks.length >= 2) {
          // Non-typing level: render as word-order. The answer must be buildable from the chunks.
          if (!buildableFromChunks(it.answer.replace(/[.?!。？！]/g, ''), it.chunks) && !buildableFromChunks(it.answer, it.chunks)) {
            issues.error(rel, `${it.id}: type→order conversion failed; answer is not buildable from chunks`, lineOf(['items', i, 'chunks']));
          }
          out.push({ id: it.id, type: 'order', prompt: it.prompt, chunks: it.chunks, answer: it.chunks.join(' '), accept: [it.answer, ...it.accept], explain: it.explain });
        } else {
          issues.warn(rel, `${it.id}: type item skipped on a level with typing_quizzes: false (add chunks to render it as order)`, line);
        }
        return;
      case 'match':
        if (it.pairs.length < 4) issues.warn(rel, `${it.id}: match should have 4–8 pairs`, line);
        out.push(it);
        return;
      case 'tf':
        if (!it.explain) {
          issues.error(rel, `${it.id}: tf items must have explain (the lesson is in the explanation)`, line);
          out.push({ ...it, explain: '' });
        } else {
          out.push({ ...it, explain: it.explain });
        }
        return;
    }
  });
  const n = data.items.length;
  const [lo, hi] = opts.isRecap ? [6, 8] : [6, 20];
  if (n < lo) issues.warn(rel, `${n} items; target is ${opts.isRecap ? '6–8' : '10–15'}`);
  if (n > hi) issues.warn(rel, `${n} items; that is a lot for one week`);
  return out;
}
