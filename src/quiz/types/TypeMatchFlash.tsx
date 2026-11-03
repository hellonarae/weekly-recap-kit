import { useMemo, useState } from 'react';
import type { QuizItem } from '@/content/types';
import type { FlashcardItem } from '../items';
import type { RendererProps } from './index';
import { answersMatch, charDiff, shuffle } from '../normalize';
import { t } from '@/i18n/t';
import { PlayButton } from '@/components/ui/PlayButton';
import s from './Quiz.module.css';

type TypeItem = Extract<QuizItem, { type: 'type' }>;
type Match = Extract<QuizItem, { type: 'match' }>;

export function TypeRenderer({ item, onAnswer, done }: RendererProps<TypeItem>) {
  const [v, setV] = useState('');
  const ok = done && answersMatch(v, item.answer, item.accept);
  const submit = () => { if (!done && v.trim()) onAnswer({ correct: answersMatch(v, item.answer, item.accept), answer: v }); };
  return (
    <>
      <p className={s.prompt}>{item.prompt}</p>
      <form className={s.typeForm} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input className={`${s.input} tl`} value={v} onChange={(e) => setV(e.target.value)} disabled={done} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label={t('quiz.typeHere')} placeholder={t('quiz.typeHere')} data-state={!done ? 'idle' : ok ? 'correct' : 'wrong'} />
        {!done && <button type="submit" className={s.check} disabled={!v.trim()}>{t('quiz.check')}</button>}
      </form>
      {done && !ok && (
        <p className={`${s.expected} tl`} aria-label={t('quiz.expected')}>
          {charDiff(v.trim(), item.answer).map((d, i) => <span key={i} className={d.op === 'same' ? '' : d.op === 'add' ? s.diffAdd : s.diffDel}>{d.ch}</span>)}
        </p>
      )}
    </>
  );
}

/** Tap a left item then a right item. A wrong pair shakes and counts as a mistake; the item is correct with zero mistakes. */
export function MatchRenderer({ item, onAnswer, done }: RendererProps<Match>) {
  const left = useMemo(() => shuffle(item.pairs.map((p, i) => ({ i, text: p[0] }))), [item]);
  const right = useMemo(() => shuffle(item.pairs.map((p, i) => ({ i, text: p[1] }))), [item]);
  const [sel, setSel] = useState<{ side: 'l' | 'r'; i: number } | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState<number | null>(null);

  const pick = (side: 'l' | 'r', i: number) => {
    if (done || matched.includes(i)) return;
    if (!sel || sel.side === side) { setSel({ side, i }); return; }
    if (sel.i === i) {
      const m = [...matched, i];
      setMatched(m); setSel(null);
      if (m.length === item.pairs.length) onAnswer({ correct: mistakes === 0, answer: { mistakes } });
    } else {
      setMistakes((x) => x + 1); setShake(i); setSel(null);
      setTimeout(() => setShake(null), 350);
    }
  };
  const Col = ({ side, items }: { side: 'l' | 'r'; items: { i: number; text: string }[] }) => (
    <div className={s.matchCol}>
      {items.map((it) => (
        <button key={it.i} type="button" className={`${s.option} ${side === 'l' ? 'tl' : ''}`} data-state={matched.includes(it.i) ? 'correct' : shake === it.i ? 'wrong' : 'idle'} data-selected={sel?.side === side && sel.i === it.i} disabled={done || matched.includes(it.i)} onClick={() => pick(side, it.i)}>
          {it.text}
        </button>
      ))}
    </div>
  );
  return (
    <>
      <p className={s.prompt}>{t('quiz.matchPrompt')}</p>
      <div className={s.match}><Col side="l" items={left} /><Col side="r" items={right} /></div>
      {mistakes > 0 && <p className="small">{t('quiz.mistakes', { n: mistakes })}</p>}
    </>
  );
}

export function FlashcardRenderer({ item, onAnswer, done, scope }: RendererProps<FlashcardItem>) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <div className={s.flash} onClick={() => setRevealed(true)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setRevealed(true); }}>
        <span className={`tl ${s.flashWord}`}>{item.tl}</span>
        <PlayButton id={`fc-${item.id}`} text={item.tl} scope={scope} size="large" />
        {revealed ? <span className={s.flashGloss}>{item.en}</span> : <span className={s.zoneHint}>{t('quiz.tapToReveal')}</span>}
      </div>
      {revealed && !done && (
        <div className={s.options}>
          <button type="button" className={s.option} onClick={() => onAnswer({ correct: true, answer: 'knew' })}>{t('quiz.knewIt')}</button>
          <button type="button" className={s.option} onClick={() => onAnswer({ correct: false, answer: 'didnt' })}>{t('quiz.didntKnow')}</button>
        </div>
      )}
    </>
  );
}
