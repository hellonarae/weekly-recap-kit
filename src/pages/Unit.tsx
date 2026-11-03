import { Link, useParams } from 'react-router-dom';
import { levelById } from '@/config/course';
import { useAuthState } from '@/auth/context';
import { t } from '@/i18n/t';
import { VocabTab } from '@/components/vocab/VocabTab';
import s from './Week.module.css';

/** Unit view: the unit's vocabulary deck/list/export and the weeks that taught it. */
export function Unit() {
  const { level: levelId, unit: unitId } = useParams();
  const { visibleLevels } = useAuthState();
  const level = levelById(levelId && visibleLevels.includes(levelId) ? levelId : undefined);
  const unit = level?.units.find((u) => u.id === unitId);
  if (!level || !unit) return <p>{t('units.none')}</p>;
  return (
    <>
      <section className={s.ticket}>
        <div className={s.num}><small>{t('home.unit')}</small>{unit.id.replace(/\D/g, '') || '·'}</div>
        <div>
          <h1 className={s.title}>{unit.label}</h1>
          {unit.weeks.length > 0 && (
            <div className={s.chips}>
              {unit.weeks.map((wid) => { const n = Number(wid.split('-w')[1]); return <Link key={wid} className={s.chip} to={`/${level.id}/week/${n}`}>{t('home.week', { n })}</Link>; })}
            </div>
          )}
        </div>
        <span />
      </section>
      <VocabTab source={{ entries: unit.entries, level: level.id, levelLabel: level.label, id: `${level.id}-u-${unit.id}`, title: unit.id, fileStem: `unit_${unit.id}` }} />
    </>
  );
}
