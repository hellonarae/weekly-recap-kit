import { useState } from 'react';
import type { Week } from '@/content/types';
import { t } from '@/i18n/t';
import { useProgress } from '@/state/progress';
import { QuizRunner } from './QuizRunner';
import s from './types/Quiz.module.css';

export function QuizTab({ week }: { week: Week }) {
  const [running, setRunning] = useState(false);
  const prog = useProgress();
  const last = prog.weeks[week.id]?.quiz;
  if (running) return <QuizRunner week={week} onExit={() => setRunning(false)} />;
  return (
    <div className={s.end}>
      <h2>{t('quiz.title')}</h2>
      <p>{t('quiz.intro', { n: week.quiz.length, auto: week.auto.length })}</p>
      {last && <p className="small">{t('quiz.last', { score: last.score, total: last.total })}</p>}
      <div className={s.options}>
        <button type="button" className={s.check} onClick={() => setRunning(true)}>{t('quiz.start')}</button>
      </div>
    </div>
  );
}
