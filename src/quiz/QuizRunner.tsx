import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { Week } from '@/content/types';
import { t } from '@/i18n/t';
import { progress } from '@/state/progress';
import { useTrack } from '@/modules/useEvents';
import { registry, type AnswerReport } from './types';
import './types/register';
import type { RunnerItem } from './items';
import { autoItems } from './auto';
import { shuffle } from './normalize';
import s from './types/Quiz.module.css';

interface Props { week: Week; onlyIds?: string[]; onExit(): void }

function buildItems(week: Week, onlyIds?: string[]): RunnerItem[] {
  const authored: RunnerItem[] = week.shuffle_quiz ? shuffle(week.quiz) : week.quiz;
  const all = [...authored, ...autoItems(week)];
  return onlyIds ? all.filter((i) => onlyIds.includes(i.id)) : all;
}

/** One item per screen, immediate feedback, explanation when wrong, end screen with retry. */
export function QuizRunner({ week, onlyIds, onExit }: Props) {
  const [items, setItems] = useState<RunnerItem[]>(() => buildItems(week, onlyIds));
  const [i, setI] = useState(0);
  const [report, setReport] = useState<AnswerReport | null>(null);
  const [results, setResults] = useState<{ id: string; correct: boolean }[]>([]);
  const start = useRef(Date.now());
  const itemStart = useRef(Date.now());
  const track = useTrack();
  const scope = `${week.level}/week-${String(week.week).padStart(2, '0')}`;
  const item = items[i];
  const finished = i >= items.length;

  useEffect(() => { track('quiz_start', week.id, { total: items.length, retry: Boolean(onlyIds) }); /* eslint-disable-line */ }, []);

  const wrong = useMemo(() => results.filter((r) => !r.correct).map((r) => r.id), [results]);
  useEffect(() => {
    if (!finished || items.length === 0) return;
    const score = results.filter((r) => r.correct).length;
    const ms = Date.now() - start.current;
    progress.recordQuiz(week.id, { score, total: items.length, ms, at: new Date().toISOString(), wrong }, onlyIds);
    track('quiz_finish', week.id, { score, total: items.length, ms });
  }, [finished]); // eslint-disable-line

  if (items.length === 0) return <p>{t('quiz.empty')}</p>;

  if (finished) {
    const score = results.filter((r) => r.correct).length;
    const secs = Math.round((Date.now() - start.current) / 1000);
    return (
      <div className={s.end}>
        <h2>{t('quiz.done')}</h2>
        <p className={s.score}><strong>{score}</strong> / {items.length}</p>
        <p className="small">{t('quiz.time', { m: Math.floor(secs / 60), s: secs % 60 })}</p>
        {wrong.length > 0 && (
          <ul className={s.wrongList}>
            {wrong.map((id) => { const it = items.find((x) => x.id === id)!; const def = registry.get(it.type); return <li key={id}><X size={14} /> {def?.summary(it)}</li>; })}
          </ul>
        )}
        <div className={s.options}>
          {wrong.length > 0 && <button type="button" className={s.option} onClick={() => { setItems(buildItems(week, wrong)); setI(0); setResults([]); setReport(null); start.current = Date.now(); }}>{t('quiz.retryWrong')}</button>}
          <button type="button" className={s.option} onClick={() => { setItems(buildItems(week)); setI(0); setResults([]); setReport(null); start.current = Date.now(); }}>{t('quiz.retryAll')}</button>
          <button type="button" className={s.option} onClick={onExit}>{t('quiz.exit')}</button>
        </div>
      </div>
    );
  }

  const def = registry.get(item!.type);
  if (!def) return <p>Unknown quiz type {item!.type}</p>;
  const Renderer = def.Renderer;
  const explain = 'explain' in item! ? item!.explain : undefined;

  const onAnswer = (r: AnswerReport) => {
    if (report) return;
    setReport(r);
    setResults((x) => [...x, { id: item!.id, correct: r.correct }]);
    track('quiz_answer', week.id, { item: item!.id, type: item!.type, correct: r.correct, ms: Date.now() - itemStart.current });
  };
  const next = () => { setReport(null); setI((x) => x + 1); itemStart.current = Date.now(); };

  return (
    <div className={s.runner}>
      <div className={s.progress} role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={i}><span style={{ width: `${(i / items.length) * 100}%` }} /></div>
      <p className="small">{t('quiz.counter', { i: i + 1, n: items.length })}</p>
      <div key={item!.id} className={s.item} data-feedback={report ? (report.correct ? 'correct' : 'wrong') : 'none'}>
        <Renderer item={item!} scope={scope} onAnswer={onAnswer} done={report !== null} />
      </div>
      {report && (
        <div className={s.feedback} data-state={report.correct ? 'correct' : 'wrong'} role="status">
          <span className={s.feedbackIcon}>{report.correct ? <Check size={20} /> : <X size={20} />}</span>
          <span>{report.correct ? t('quiz.correct') : (explain || t('quiz.wrong'))}</span>
          <button type="button" className={s.next} onClick={next} autoFocus>{i + 1 < items.length ? t('quiz.next') : t('quiz.finish')}</button>
        </div>
      )}
    </div>
  );
}
