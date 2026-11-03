import { Bookmark } from 'lucide-react';
import type { Week } from '@/content/types';
import { t } from '@/i18n/t';
import { progress, useProgress } from '@/state/progress';
import { Markdown } from '@/components/ui/Markdown';
import { PlayButton } from '@/components/ui/PlayButton';
import { useState } from 'react';
import s from './GrammarTab.module.css';

/** Reading only: one block per grammar point, examples with ▶ and a translation toggle. */
export function GrammarTab({ week }: { week: Week }) {
  const [showEn, setShowEn] = useState(true);
  const prog = useProgress();
  const scope = `${week.level}/week-${String(week.week).padStart(2, '0')}`;
  return (
    <div className={s.wrap}>
      <div className={s.toolbar}>
        <label className={s.toggle}>
          <input type="checkbox" checked={showEn} onChange={(e) => setShowEn(e.target.checked)} /> {t('grammar.showTranslation')}
        </label>
      </div>
      {week.grammar.map((g) => (
        <article key={g.id} className={s.point} id={g.id}>
          <h2 className={s.pattern}><span className="tl">{g.pattern}</span> <span className={s.label}>{g.label}</span></h2>
          <div className={s.body}><Markdown text={g.body} /></div>
          <ul className={s.examples}>
            {g.examples.map((ex, i) => {
              const saved = prog.savedExamples.includes(`${g.id}|${i}`);
              return (
                <li key={i} className={s.example}>
                  <PlayButton id={`${g.id}-${i}`} text={ex.tl} scope={scope} weekId={week.id} />
                  <span className={s.exText}>
                    <span className="tl">{ex.tl}</span>
                    {showEn && <span className={s.en}>{ex.en}</span>}
                  </span>
                  <button type="button" className={s.save} data-on={saved} aria-pressed={saved} aria-label={t('grammar.save')} onClick={() => progress.toggleSavedExample(g.id, i)}>
                    <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
                  </button>
                </li>
              );
            })}
          </ul>
          {g.tips.map((tip, i) => <p key={i} className={s.tip}><Markdown text={tip} /></p>)}
        </article>
      ))}
    </div>
  );
}
