import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { VocabEntry } from '@/content/types';
import { course } from '@/config/course';
import { t } from '@/i18n/t';
import { progress, useProgress } from '@/state/progress';
import { useTrack } from '@/modules/useEvents';
import { PlayButton } from '@/components/ui/PlayButton';
import { VocabImage } from './VocabImage';
import s from './FlipDeck.module.css';

interface Props { entries: VocabEntry[]; level: string; weekId: string; scope: string }

/** Card deck: target language on the front (+ ▶), gloss on the back. Tap to flip, swipe/arrow to move. */
export function FlipDeck({ entries, level, weekId, scope }: Props) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const track = useTrack();
  const prog = useProgress();
  const e = entries[i];
  const imgSide = course.vocab.card_image;

  useEffect(() => { setI(0); setFlipped(false); }, [entries]);

  if (!e) return null;
  const go = (d: number) => { setFlipped(false); setI((x) => (x + d + entries.length) % entries.length); };
  const flip = () => { setFlipped((f) => !f); if (!flipped) track('flashcard_flip', weekId, { tl: e.tl }); };
  const starred = prog.stars.includes(`${level}|${e.tl}`);

  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowRight') go(1);
    else if (ev.key === 'ArrowLeft') go(-1);
    else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); flip(); }
  };

  return (
    <section className={s.deck} aria-label={t('vocab.deck')}>
      <div
        className={s.card}
        data-flipped={flipped}
        role="button"
        tabIndex={0}
        onClick={flip}
        onKeyDown={onKey}
        onTouchStart={(ev) => { const p = ev.touches[0]!; touch.current = { x: p.clientX, y: p.clientY }; }}
        onTouchEnd={(ev) => {
          const st = touch.current; touch.current = null;
          if (!st) return;
          const p = ev.changedTouches[0]!;
          const dx = p.clientX - st.x, dy = p.clientY - st.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) { ev.preventDefault(); go(dx < 0 ? 1 : -1); }
        }}
      >
        <div className={s.inner}>
          <div className={`${s.face} ${s.front}`}>
            {e.cat && <span className={s.cat}>{e.cat}</span>}
            {imgSide === 'front' && <VocabImage entry={e} level={level} size={72} />}
            <span className={`tl ${s.word}`}>{e.tl}</span>
            <span className={s.tools}>
              {e.audio && <PlayButton id={`deck-${e.tl}`} text={e.tl} scope={scope} weekId={weekId} size="large" />}
            </span>
          </div>
          <div className={`${s.face} ${s.back}`}>
            {e.cat && <span className={s.cat}>{e.cat}</span>}
            {imgSide === 'back' && <VocabImage entry={e} level={level} size={72} />}
            <span className={s.gloss}>{e.en}</span>
            {e.note && <span className={s.note}>{e.note}</span>}
          </div>
        </div>
        <button type="button" className={s.star} data-on={starred} aria-pressed={starred} aria-label={t('vocab.star')}
          onClick={(ev) => { ev.stopPropagation(); const on = progress.toggleStar(level, e.tl); track(on ? 'star_add' : 'star_remove', weekId, { tl: e.tl }); }}>
          <Star size={18} fill={starred ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className={s.nav}>
        <button type="button" className={s.navBtn} onClick={() => go(-1)} aria-label={t('vocab.prev')}><ChevronLeft size={20} /></button>
        <span className={s.count}>{i + 1} / {entries.length}</span>
        <button type="button" className={s.navBtn} onClick={() => go(1)} aria-label={t('vocab.next')}><ChevronRight size={20} /></button>
      </div>
      <p className={`small ${s.hint}`}>{t('vocab.hint')}</p>
    </section>
  );
}
