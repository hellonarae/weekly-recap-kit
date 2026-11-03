import { Link, useParams } from 'react-router-dom';
import { levelById } from '@/config/course';
import { useAuthState } from '@/auth/context';
import { t } from '@/i18n/t';
import { LevelPicker, ViewToggle, useLevel } from './Home';
import s from './Home.module.css';

export function Units() {
  const { level: levelId } = useParams();
  const { setLevelId } = useLevel();
  const { visibleLevels } = useAuthState();
  const level = levelById(levelId && visibleLevels.includes(levelId) ? levelId : undefined);
  if (!level) return <p className={s.empty}>{t('units.none')}</p>;
  return (
    <>
      <h1>{level.label}</h1>
      <LevelPicker current={level.id} onPick={setLevelId} />
      <ViewToggle levelId={level.id} />
      {level.units.length === 0 ? (
        <p className={s.empty}>{t('units.none')}</p>
      ) : (
        <ul className={s.list}>
          {level.units.map((u) => (
            <li key={u.id}><Link className={s.row} to={`/${level.id}/unit/${encodeURIComponent(u.id)}`}>
              <span className={s.num}><small>{t('home.unit')}</small></span>
              <span>
                <span className={s.title}>{u.label}</span>
                <br />
                <span className="small">
                  {t('week.count.words', { n: u.entries.length })}
                  {u.weeks.length > 0 && <> · {t('units.taughtIn')} {u.weeks.map((wid) => {
                    const n = Number(wid.split('-w')[1]);
                    return <Link key={wid} to={`/${level.id}/week/${n}`}>{t('home.week', { n })}</Link>;
                  }).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ', ', el] : [el]), [])}</>}
                </span>
              </span>
              <span />
            </Link></li>
          ))}
        </ul>
      )}
    </>
  );
}
