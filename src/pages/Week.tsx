import { Suspense, lazy, useEffect } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { levelById, weekOf } from '@/config/course';
import { useAuthState } from '@/auth/context';
import { t } from '@/i18n/t';
import { progress, useProgress, type TabId } from '@/state/progress';
import { useTrack } from '@/modules/useEvents';
import { useAudio } from '@/audio/AudioService';
import { VocabTab } from '@/components/vocab/VocabTab';
import { GrammarTab } from '@/components/grammar/GrammarTab';
// Lazy: these pull in dnd-kit and the recorder, which the Vocabulary/Grammar tabs never need.
const DialogueTab = lazy(() => import('@/components/dialogue/DialogueTab').then((m) => ({ default: m.DialogueTab })));
const QuizTab = lazy(() => import('@/quiz/QuizTab').then((m) => ({ default: m.QuizTab })));
const ReviewTab = lazy(() => import('@/components/review/ReviewTab').then((m) => ({ default: m.ReviewTab })));
import s from './Week.module.css';

const TABS: TabId[] = ['vocab', 'grammar', 'dialogue', 'quiz', 'review'];

export function Week() {
  const { level: levelId, n, tab } = useParams();
  const { visibleLevels } = useAuthState();
  const level = levelById(levelId && visibleLevels.includes(levelId) ? levelId : undefined);
  const week = level && weekOf(level, Number(n));
  const track = useTrack();
  const audio = useAudio();
  const prog = useProgress();

  const available: TabId[] = TABS.filter((tb) => {
    if (!week) return false;
    if (tb === 'vocab') return week.vocab.length > 0;
    if (tb === 'dialogue') return week.dialogues.length > 0;
    if (tb === 'quiz') return week.quiz.length + week.auto.length > 0;
    if (tb === 'grammar') return week.grammar.length > 0;
    return true;
  });
  const current = (available.includes(tab as TabId) ? (tab as TabId) : available[0]) ?? 'review';

  useEffect(() => { if (week) { track('week_open', week.id); void audio.loadScope(`${week.level}/vocab`); void audio.loadScope(`${week.level}/week-${String(week.week).padStart(2, '0')}`); } }, [week?.id]); // eslint-disable-line
  useEffect(() => { if (week && tab) { progress.markTab(week.id, current); track('tab_open', week.id, { tab: current }); } audio.stop(); }, [week?.id, current, tab]); // eslint-disable-line

  if (!level || !week) return <p>{t('week.notFound')}</p>;
  if (!tab || !available.includes(tab as TabId)) return <Navigate to={`/${level.id}/week/${week.week}/${current}`} replace />;

  const done = prog.weeks[week.id]?.tabs ?? {};
  const doneCount = available.filter((tb) => tb !== 'review' && done[tb]).length;
  const total = available.filter((tb) => tb !== 'review').length;
  const pct = total ? doneCount / total : 0;

  return (
    <>
      <section className={s.ticket}>
        <div className={s.num}><small>{t('home.week', { n: '' }).trim()}</small>{week.week}</div>
        <div>
          <h1 className={s.title}>{week.title}</h1>
          {week.units.length > 0 && <div className={s.chips}>{week.units.map((u) => <span key={u} className={s.chip}>{u}</span>)}</div>}
        </div>
        <div className={s.ring} role="img" aria-label={t('week.progress', { n: doneCount, total })} style={{ background: `conic-gradient(var(--accent) ${pct * 360}deg, var(--primary-deep) 0)` }}><span>{doneCount}/{total}</span></div>
      </section>
      <nav className={s.tabs} aria-label="Week sections">
        {available.map((tb) => (
          <NavLink key={tb} to={`/${level.id}/week/${week.week}/${tb}`} data-done={Boolean(done[tb])}>{t(`week.tab.${tb}`)}</NavLink>
        ))}
      </nav>
      <section className={s.panel} key={current}>
        {current === 'vocab' && <VocabTab source={{ entries: week.vocab, level: week.level, levelLabel: level.label, id: week.id, title: `Week ${week.week}`, fileStem: `week${String(week.week).padStart(2, '0')}` }} />}
        {current === 'grammar' && <GrammarTab week={week} />}
        <Suspense fallback={<p className="small">…</p>}>
          {current === 'dialogue' && <DialogueTab week={week} />}
          {current === 'quiz' && <QuizTab week={week} />}
          {current === 'review' && <ReviewTab week={week} level={level} />}
        </Suspense>
      </section>
    </>
  );
}
