import { useMemo, useState } from 'react';
import { Download, Star, X } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import type { Level, VocabEntry, Week } from '@/content/types';
import { course, levelById } from '@/config/course';
import { t } from '@/i18n/t';
import { progress, useProgress } from '@/state/progress';
import { useAudio } from '@/audio/AudioService';
import { useTrack } from '@/modules/useEvents';
import { PlayButton } from '@/components/ui/PlayButton';
import { VocabImage } from '@/components/vocab/VocabImage';
import { AccountSection } from './Account';
import s from './MyPage.module.css';

interface WeekSaved { week: Week; words: VocabEntry[]; examples: { pointId: string; pattern: string; i: number; tl: string; en: string }[] }

/** Everything the student saved, grouped by week: starred words, bookmarked examples, last quiz score. Device-local until the auth module syncs it (decision 002). */
function collect(level: Level, prog: ReturnType<typeof useProgress>): WeekSaved[] {
  const starKeys = new Set(prog.stars.filter((k) => k.startsWith(`${level.id}|`)).map((k) => k.slice(level.id.length + 1)));
  const claimed = new Set<string>();
  return level.weeks.map((week) => {
    const words = week.vocab.filter((e) => starKeys.has(e.tl) && !claimed.has(e.tl) && claimed.add(e.tl));
    const examples = week.grammar.flatMap((g) => g.examples.map((ex, i) => ({ pointId: g.id, pattern: g.pattern, i, tl: ex.tl, en: ex.en })).filter((x) => prog.savedExamples.includes(`${x.pointId}|${x.i}`)));
    return { week, words, examples };
  }).filter((w) => w.words.length || w.examples.length || prog.weeks[w.week.id]?.quiz);
}

export function MyPage() {
  const { level: levelId } = useParams();
  const remembered = (() => { try { return localStorage.getItem('recap.level') ?? undefined; } catch { return undefined; } })();
  const level = levelById(levelId) ?? levelById(remembered) ?? levelById(course.levels[0]?.id);
  const prog = useProgress();
  const audio = useAudio();
  const track = useTrack();
  const [busy, setBusy] = useState<string | null>(null);
  const saved = useMemo(() => (level ? collect(level, prog) : []), [level, prog]);
  if (!level) return null;
  const vocabScope = `${level.id}/vocab`;
  const weekScope = (w: Week) => `${w.level}/week-${String(w.week).padStart(2, '0')}`;

  const exportSaved = async (items: WeekSaved[], title: string, stem: string) => {
    setBusy(stem);
    track('export_anki', undefined, { what: 'saved', weeks: items.map((x) => x.week.week) });
    try {
      const { exportVocab } = await import('@/export/exportVocab');
      const entries = items.flatMap((x) => x.words);
      const sentences = items.flatMap((x) => x.examples.map((ex) => ({ tl: ex.tl, en: ex.en, note: ex.pattern, audioUrl: audio.fileUrl({ text: ex.tl, scope: weekScope(x.week), speed: 1 }) })));
      await exportVocab({ entries, level: level.id, levelLabel: level.label, id: `${level.id}-saved`, title, fileStem: stem }, (e) => audio.fileUrl({ text: e.tl, scope: vocabScope, speed: 1 }), sentences);
    } finally { setBusy(null); }
  };

  const total = saved.reduce((n, x) => n + x.words.length + x.examples.length, 0);
  return (
    <div className={s.wrap}>
      <h1>{t('my.title')}</h1>
      <p className="small">{t('my.intro')}</p>
      {saved.length === 0 && <p className={s.empty}>{t('my.empty')}</p>}
      {total > 0 && course.vocab.anki_export !== 'off' && (
        <button type="button" className={s.export} disabled={busy !== null} onClick={() => exportSaved(saved, 'My saved items', 'saved_all')}>
          <Download size={16} aria-hidden="true" /> {busy === 'saved_all' ? t('vocab.exporting') : t('my.exportAll', { n: total })}
        </button>
      )}
      {saved.map(({ week, words, examples }) => {
        const q = prog.weeks[week.id]?.quiz;
        return (
          <section key={week.id} className={s.week}>
            <header className={s.head}>
              <Link to={`/${level.id}/week/${week.week}`} className={s.weekLink}><span className={s.num}>{week.week}</span> {week.title}</Link>
              {q && <span className="small">{t('my.quiz', { score: q.score, total: q.total })}</span>}
              {(words.length + examples.length > 0) && course.vocab.anki_export !== 'off' && (
                <button type="button" className={s.miniExport} disabled={busy !== null} onClick={() => exportSaved([{ week, words, examples }], `Week ${week.week} saved`, `week${String(week.week).padStart(2, '0')}_saved`)}>
                  <Download size={14} aria-hidden="true" /> Anki
                </button>
              )}
            </header>
            {words.length > 0 && (
              <ul className={s.list}>
                {words.map((e) => (
                  <li key={e.tl} className={s.item}>
                    {e.audio && <PlayButton id={`my-${e.tl}`} text={e.tl} scope={vocabScope} />}
                    <span><span className="tl">{e.tl}</span><span className={s.en}> {e.en}</span></span>
                    <VocabImage entry={e} level={level.id} size={32} />
                    <button type="button" className={s.icon} aria-label={t('vocab.star')} onClick={() => progress.toggleStar(level.id, e.tl)}><Star size={16} fill="currentColor" /></button>
                  </li>
                ))}
              </ul>
            )}
            {examples.length > 0 && (
              <ul className={s.list}>
                {examples.map((ex) => (
                  <li key={`${ex.pointId}|${ex.i}`} className={s.item}>
                    <PlayButton id={`myg-${ex.pointId}-${ex.i}`} text={ex.tl} scope={weekScope(week)} />
                    <span><span className="tl">{ex.tl}</span><br /><span className={s.en}>{ex.en} · <em>{ex.pattern}</em></span></span>
                    <span />
                    <button type="button" className={s.icon} aria-label={t('review.remove')} onClick={() => progress.toggleSavedExample(ex.pointId, ex.i)}><X size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <AccountSection />
    </div>
  );
}
