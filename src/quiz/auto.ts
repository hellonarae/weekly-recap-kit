import type { Week } from '@/content/types';
import { shuffle } from './normalize';
import type { RunnerItem } from './items';

/** The four auto quiz types from week.yml → auto. They are rebuilt (re-shuffled) every run. */
export function autoItems(week: Week): RunnerItem[] {
  const out: RunnerItem[] = [];
  const words = week.vocab.filter((v) => v.kind === 'word');
  const lines = week.dialogues.flatMap((d) => d.items.filter((i): i is Extract<typeof i, { kind: 'line' }> => i.kind === 'line'));

  if (week.auto.includes('flashcards') && week.vocab.length) {
    shuffle(week.vocab).slice(0, 8).forEach((v, i) => out.push({ id: `${week.id}-fc${i}`, type: 'flashcard', tl: v.tl, en: v.en }));
  }
  if (week.auto.includes('match_vocab') && words.length >= 4) {
    out.push({ id: `${week.id}-mv`, type: 'match', pairs: shuffle(words).slice(0, 6).map((w) => [w.tl, w.en] as [string, string]) });
  }
  if (week.auto.includes('dialogue_order')) {
    const d = week.dialogues.find((x) => x.items.filter((i) => i.kind === 'line').length >= 3);
    if (d) {
      const ls = d.items.filter((i): i is Extract<typeof i, { kind: 'line' }> => i.kind === 'line').slice(0, 6);
      out.push({ id: `${week.id}-do`, type: 'line_order', lines: ls.map((l) => ({ speaker: l.speaker, tl: l.tl })) });
    }
  }
  if (week.auto.includes('listen_choose') && lines.length >= 4) {
    const uniq = [...new Map(lines.map((l) => [l.en, l])).values()];
    if (uniq.length >= 4) {
      shuffle(uniq).slice(0, 4).forEach((l, i) => {
        const distractors = shuffle(uniq.filter((x) => x.en !== l.en)).slice(0, 3).map((x) => x.en);
        const options = shuffle([l.en, ...distractors]);
        out.push({ id: `${week.id}-lc${i}`, type: 'listen_choose', text: l.tl, speaker: l.speaker, options, answer: options.indexOf(l.en) });
      });
    }
  }
  return out;
}
