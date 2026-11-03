import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { levels, visibleWeeks } from '@/config/course';
import { useAuthState } from '@/auth/context';
import { useProgress } from '@/state/progress';
import { t } from '@/i18n/t';
import s from './Home.module.css';

const LEVEL_KEY = 'recap.level';

/** Levels this user may open: all, or profile.levels when the teacher restricted them (decision 002.3). */
export function useVisibleLevels() {
  const { visibleLevels } = useAuthState();
  return levels.filter((l) => visibleLevels.includes(l.id));
}

export function useLevel() {
  const visible = useVisibleLevels();
  const [levelId, setLevelId] = useState<string>(() => {
    try { return localStorage.getItem(LEVEL_KEY) ?? levels[0]?.id ?? ''; } catch { return levels[0]?.id ?? ''; }
  });
  useEffect(() => { try { localStorage.setItem(LEVEL_KEY, levelId); } catch { /* private mode */ } }, [levelId]);
  const level = visible.find((l) => l.id === levelId) ?? visible[0];
  return { level, setLevelId };
}

export function LevelPicker({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  const visible = useVisibleLevels();
  if (visible.length < 2) return null;
  return (
    <div className={s.levels} role="group" aria-label={t('home.pickLevel')}>
      {visible.map((l) => (
        <button key={l.id} className={s.levelBtn} aria-pressed={l.id === current} onClick={() => onPick(l.id)}>{l.label}</button>
      ))}
    </div>
  );
}

export function ViewToggle({ levelId }: { levelId: string }) {
  return (
    <div className={s.toggle}>
      <NavLink to="/" end>{t('nav.weeks')}</NavLink>
      <NavLink to={`/${levelId}/units`}>{t('nav.units')}</NavLink>
    </div>
  );
}

export function Home() {
  const { level, setLevelId } = useLevel();
  const prog = useProgress();
  if (!level) return <p className={s.empty}>{t('home.noWeeks')}</p>;
  const weeks = visibleWeeks(level);
  return (
    <>
      <h1>{level.label}</h1>
      <LevelPicker current={level.id} onPick={setLevelId} />
      <ViewToggle levelId={level.id} />
      {weeks.length === 0 ? (
        <p className={s.empty}>{t('home.noWeeks')}</p>
      ) : (
        <ul className={s.list}>
          {weeks.map((w) => (
            <li key={w.id}>
              <Link className={s.row} to={`/${level.id}/week/${w.week}`}>
                <span className={s.num}><small>{t('home.week', { n: '' }).trim()}</small>{w.week}</span>
                <span className={s.title}>{w.title}</span>
                <span className={s.meta}>
                  {w.estimated_minutes && <span className="small">{t('home.minutes', { n: w.estimated_minutes })}</span>}
                  <span className={s.dots} aria-hidden="true">
                    {/* vocab · grammar · dialogue · quiz — filled when the student has opened that tab */}
                    {([['vocab', w.vocab.length > 0], ['grammar', w.grammar.length > 0], ['dialogue', w.dialogues.length > 0], ['quiz', w.quiz.length + w.auto.length > 0]] as const).map(([tb, has]) => (
                      <span key={tb} className={s.dot} data-on={Boolean(prog.weeks[w.id]?.tabs[tb])} style={has ? undefined : { opacity: 0.3 }} />
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
