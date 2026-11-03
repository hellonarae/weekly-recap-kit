import { useEffect, useState } from 'react';
import type { Week } from '@/content/types';
import { t } from '@/i18n/t';
import { useAudio } from '@/audio/AudioService';
import { DialogueStage } from './DialogueStage';
import s from './Dialogue.module.css';

export function DialogueTab({ week }: { week: Week }) {
  const [di, setDi] = useState(0);
  const audio = useAudio();
  const scope = `${week.level}/week-${String(week.week).padStart(2, '0')}`;
  useEffect(() => { void audio.loadScope(scope); }, [scope]); // eslint-disable-line
  const d = week.dialogues[di];
  if (!d) return null;
  return (
    <div className={s.tab}>
      {week.dialogues.length > 1 && (
        <div className={s.picker} role="tablist">
          {week.dialogues.map((x, i) => (
            <button key={x.id} type="button" role="tab" aria-selected={i === di} className={s.pick} onClick={() => { audio.stop(); setDi(i); }}>
              {x.title ?? t('dialogue.n', { n: i + 1 })}
            </button>
          ))}
        </div>
      )}
      <DialogueStage key={d.id} week={week} dialogue={d} scope={scope} />
    </div>
  );
}
