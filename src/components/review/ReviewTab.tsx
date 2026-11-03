import { useMemo, useState } from 'react';
import { Star, X } from 'lucide-react';
import type { Level, Week } from '@/content/types';
import { t } from '@/i18n/t';
import { progress, useProgress } from '@/state/progress';
import { PlayButton } from '@/components/ui/PlayButton';
import { QuizRunner } from '@/quiz/QuizRunner';
import s from './ReviewTab.module.css';

/** This week's wrong answers (retry), starred words, saved grammar examples. "All weeks" widens to the level. */
export function ReviewTab({ week, level }: { week: Week; level: Level }) {
  const prog = useProgress();
  const [all, setAll] = useState(false);
  const [retry, setRetry] = useState<Week | null>(null);
  const weeks = all ? level.weeks : [week];
  const scope = (w: Week) => `${w.level}/week-${String(w.week).padStart(2, '0')}`;

  const wrongByWeek = weeks.map((w) => ({ w, ids: prog.weeks[w.id]?.wrongPool ?? [] })).filter((x) => x.ids.length);
  const stars = useMemo(() => {
    const keys = new Set(prog.stars.filter((k) => k.startsWith(`${level.id}|`)).map((k) => k.slice(level.id.length + 1)));
    const pool = all ? level.units.flatMap((u) => u.entries).concat(level.weeks.flatMap((w) => w.vocab)) : week.vocab;
    const seen = new Set<string>();
    return pool.filter((e) => keys.has(e.tl) && !seen.has(e.tl) && seen.add(e.tl));
  }, [prog.stars, all, level, week]);
  const saved = weeks.flatMap((w) => w.grammar.flatMap((g) => g.examples.map((ex, i) => ({ w, g, ex, i, key: `${g.id}|${i}` })))).filter((x) => prog.savedExamples.includes(x.key));

  if (retry) return <QuizRunner week={retry} onlyIds={prog.weeks[retry.id]?.wrongPool ?? []} onExit={() => setRetry(null)} />;

  const empty = wrongByWeek.length === 0 && stars.length === 0 && saved.length === 0;
  return (
    <div className={s.wrap}>
      {level.weeks.length > 1 && (
        <label className={s.toggle}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('review.allWeeks')}</label>
      )}
      {empty && <p className={s.empty}>{t('review.empty')}</p>}

      {wrongByWeek.length > 0 && (
        <section className={s.section}>
          <h2>{t('review.wrong')}</h2>
          {wrongByWeek.map(({ w, ids }) => (
            <div key={w.id} className={s.row}>
              <span>{all && <strong>{t('home.week', { n: w.week })} · </strong>}{t('review.wrongCount', { n: ids.length })}</span>
              <button type="button" className={s.btn} onClick={() => setRetry(w)}>{t('quiz.retryWrong')}</button>
            </div>
          ))}
        </section>
      )}

      {stars.length > 0 && (
        <section className={s.section}>
          <h2>{t('review.starred')}</h2>
          <ul className={s.list}>
            {stars.map((e) => (
              <li key={e.tl} className={s.item}>
                {e.audio && <PlayButton id={`rv-${e.tl}`} text={e.tl} scope={`${level.id}/vocab`} />}
                <span className="tl">{e.tl}</span><span className={s.en}>{e.en}</span>
                <button type="button" className={s.icon} aria-label={t('vocab.star')} onClick={() => progress.toggleStar(level.id, e.tl)}><Star size={16} fill="currentColor" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {saved.length > 0 && (
        <section className={s.section}>
          <h2>{t('review.saved')}</h2>
          <ul className={s.list}>
            {saved.map((x) => (
              <li key={x.key} className={s.item}>
                <PlayButton id={`rvg-${x.key}`} text={x.ex.tl} scope={scope(x.w)} />
                <span><span className="tl">{x.ex.tl}</span><br /><span className={s.en}>{x.ex.en} · <em>{x.g.pattern}</em></span></span>
                <button type="button" className={s.icon} aria-label={t('review.remove')} onClick={() => progress.toggleSavedExample(x.g.id, x.i)}><X size={16} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
