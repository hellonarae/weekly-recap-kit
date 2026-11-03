import { useMemo, useState } from 'react';
import { Download, Search, Star } from 'lucide-react';
import type { VocabEntry } from '@/content/types';
import { course } from '@/config/course';
import { t } from '@/i18n/t';
import { progress, useProgress } from '@/state/progress';
import { useTrack } from '@/modules/useEvents';
import { useAudio } from '@/audio/AudioService';
import { PlayButton } from '@/components/ui/PlayButton';
import { FlipDeck } from './FlipDeck';
import { VocabImage } from './VocabImage';
import s from './VocabTab.module.css';

export interface VocabSource { entries: VocabEntry[]; level: string; levelLabel: string; id: string; /** deck name suffix, e.g. "Week 4" or "준비1" */ title: string; fileStem: string }

export function VocabTab({ source }: { source: VocabSource }) {
  const week = { vocab: source.entries, level: source.level, id: source.id };
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const track = useTrack();
  const audio = useAudio();
  const prog = useProgress();
  const scope = `${week.level}/vocab`;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return week.vocab;
    return week.vocab.filter((e) => e.tl.includes(needle) || e.en.toLowerCase().includes(needle) || (e.cat ?? '').toLowerCase().includes(needle));
  }, [q, week.vocab]);

  const groups = useMemo(() => {
    const m = new Map<string, VocabEntry[]>();
    for (const e of filtered) {
      const k = e.cat ?? '';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return [...m.entries()];
  }, [filtered]);

  const onExport = async () => {
    setBusy(true);
    track('export_anki', week.id, { format: course.vocab.anki_export, count: week.vocab.length });
    try {
      // Loaded on demand: sql.js (wasm) and the SVG renderer are only needed for the export.
      const { exportVocab } = await import('@/export/exportVocab');
      await exportVocab(source, (e) => audio.fileUrl({ text: e.tl, scope, speed: 1 }));
    } finally { setBusy(false); }
  };

  return (
    <div className={s.wrap}>
      <FlipDeck entries={week.vocab} level={week.level} weekId={week.id} scope={scope} />

      <div className={s.listHead}>
        <label className={s.search}>
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('vocab.search')} aria-label={t('vocab.search')} />
        </label>
        {course.vocab.anki_export !== 'off' && (
          <button type="button" className={s.export} onClick={onExport} disabled={busy}>
            <Download size={16} aria-hidden="true" /> {busy ? t('vocab.exporting') : t('vocab.export')}
          </button>
        )}
      </div>

      {groups.map(([cat, entries]) => (
        <section key={cat || '_'} className={s.group}>
          {cat && <p className={s.cat}>{cat}</p>}
          <ul className={s.list}>
            {entries.map((e) => {
              const starred = prog.stars.includes(`${week.level}|${e.tl}`);
              return (
                <li key={`${e.unit ?? 'x'}-${e.n}-${e.tl}`} className={s.row}>
                  {e.audio && <PlayButton id={`v-${e.tl}`} text={e.tl} scope={scope} weekId={week.id} />}
                  <span className={`tl ${s.tl}`}>{e.tl}</span>
                  <span className={s.en}>{e.en}{e.note && <span className={s.note}> · {e.note}</span>}</span>
                  <VocabImage entry={e} level={week.level} size={36} />
                  <button type="button" className={s.star} data-on={starred} aria-pressed={starred} aria-label={t('vocab.star')}
                    onClick={() => { const on = progress.toggleStar(week.level, e.tl); track(on ? 'star_add' : 'star_remove', week.id, { tl: e.tl }); }}>
                    <Star size={16} fill={starred ? 'currentColor' : 'none'} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {filtered.length === 0 && <p className="small">{t('vocab.noMatch')}</p>}
    </div>
  );
}
