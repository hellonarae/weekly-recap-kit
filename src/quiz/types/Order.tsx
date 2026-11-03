import { useMemo, useState } from 'react';
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { QuizItem } from '@/content/types';
import type { LineOrderItem } from '../items';
import type { RendererProps } from './index';
import { answersMatch, shuffle } from '../normalize';
import { t } from '@/i18n/t';
import s from './Quiz.module.css';

type Order = Extract<QuizItem, { type: 'order' }>;

/**
 * Word-order quiz. Why both drag AND tap: on phones a tap-to-place flow is faster and more reliable
 * than dragging small chips, but desktop learners expect drag. Both write to the same `placed` list.
 * Placed chips are droppable slots too, so a chip (from the pool or already placed) can be dropped
 * *before* another chip to insert or reorder; tapping a placed chip removes it. Chunks carry an index
 * so duplicate words (e.g. two 씨) stay distinct.
 */
interface Chip { key: number; text: string }

function PoolChip({ chip, onTap, disabled }: { chip: Chip; onTap(): void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `pool-${chip.key}`, disabled, data: { key: chip.key } });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <button ref={setNodeRef} type="button" style={style} className={`${s.chip} tl`} data-dragging={isDragging} disabled={disabled} onClick={onTap} {...listeners} {...attributes}>
      {chip.text}
    </button>
  );
}

/** A placed chip: draggable (to reorder) and a drop target (insert before me). */
function PlacedChip({ chip, onTap, disabled, className }: { chip: Chip; onTap(): void; disabled: boolean; className: string }) {
  const drag = useDraggable({ id: `placed-${chip.key}`, disabled, data: { key: chip.key } });
  const drop = useDroppable({ id: `slot-${chip.key}`, disabled, data: { key: chip.key } });
  const style = drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` } : undefined;
  return (
    <span ref={drop.setNodeRef} className={s.slot} data-over={drop.isOver}>
      <button ref={drag.setNodeRef} type="button" style={style} className={className} data-dragging={drag.isDragging} disabled={disabled} onClick={onTap} {...drag.listeners} {...drag.attributes}>
        {chip.text}
      </button>
    </span>
  );
}

function AnswerZone({ children, state }: { children: React.ReactNode; state: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'answer' });
  return <div ref={setNodeRef} className={s.answerZone} data-over={isOver} data-state={state}>{children}</div>;
}

function useOrder(chunks: string[], isCorrect: (joined: string) => boolean, onAnswer: RendererProps['onAnswer'], done: boolean) {
  const pool = useMemo(() => shuffle(chunks.map((text, key) => ({ key, text }))), [chunks]);
  const [placed, setPlaced] = useState<Chip[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }));
  const remaining = pool.filter((c) => !placed.some((p) => p.key === c.key));
  const place = (c: Chip) => { if (!done) setPlaced((p) => [...p, c]); };
  const unplace = (c: Chip) => { if (!done) setPlaced((p) => p.filter((x) => x.key !== c.key)); };
  const onDragEnd = (e: DragEndEvent) => {
    if (done || !e.over) return;
    const key = (e.active.data.current as { key: number } | undefined)?.key;
    const chip = pool.find((x) => x.key === key);
    if (!chip) return;
    const overId = String(e.over.id);
    setPlaced((prev) => {
      const without = prev.filter((x) => x.key !== chip.key);
      if (overId === 'answer') return [...without, chip];
      if (overId.startsWith('slot-')) {
        const beforeKey = Number(overId.slice(5));
        if (beforeKey === chip.key) return prev;
        const idx = without.findIndex((x) => x.key === beforeKey);
        return idx < 0 ? [...without, chip] : [...without.slice(0, idx), chip, ...without.slice(idx)];
      }
      return prev;
    });
  };
  const joined = placed.map((c) => c.text).join(' ');
  const check = () => onAnswer({ correct: isCorrect(joined), answer: joined });
  return { remaining, placed, place, unplace, sensors, onDragEnd, joined, check };
}

export function OrderRenderer({ item, onAnswer, done }: RendererProps<Order>) {
  const o = useOrder(item.chunks, (j) => answersMatch(j, item.answer, item.accept), onAnswer, done);
  const state = !done ? 'idle' : answersMatch(o.joined, item.answer, item.accept) ? 'correct' : 'wrong';
  return (
    <DndContext sensors={o.sensors} onDragEnd={o.onDragEnd}>
      <p className={s.prompt}>{item.prompt}</p>
      <AnswerZone state={state}>
        {o.placed.length === 0 && <span className={s.zoneHint}>{t('quiz.orderHint')}</span>}
        {o.placed.map((c) => <PlacedChip key={c.key} chip={c} disabled={done} className={`${s.chip} ${s.chipPlaced} tl`} onTap={() => o.unplace(c)} />)}
      </AnswerZone>
      <p className={s.zoneHint}>{t('quiz.orderReorderHint')}</p>
      <div className={s.pool}>
        {o.remaining.map((c) => <PoolChip key={c.key} chip={c} disabled={done} onTap={() => o.place(c)} />)}
      </div>
      {!done && <button type="button" className={s.check} disabled={o.placed.length === 0} onClick={o.check}>{t('quiz.check')}</button>}
      {done && state === 'wrong' && <p className={s.expected}><span className="tl">{item.answer}</span></p>}
    </DndContext>
  );
}

export function LineOrderRenderer({ item, onAnswer, done }: RendererProps<LineOrderItem>) {
  const texts = item.lines.map((l) => `${l.speaker}: ${l.tl}`);
  const correct = texts.join('\n');
  const o = useOrder(texts, (j) => j === texts.join(' '), onAnswer, done);
  const state = !done ? 'idle' : o.joined === texts.join(' ') ? 'correct' : 'wrong';
  return (
    <DndContext sensors={o.sensors} onDragEnd={o.onDragEnd}>
      <p className={s.prompt}>{t('quiz.lineOrderPrompt')}</p>
      <AnswerZone state={state}>
        {o.placed.length === 0 && <span className={s.zoneHint}>{t('quiz.orderHint')}</span>}
        {o.placed.map((c) => <PlacedChip key={c.key} chip={c} disabled={done} className={`${s.line} tl`} onTap={() => o.unplace(c)} />)}
      </AnswerZone>
      <div className={s.poolLines}>
        {o.remaining.map((c) => <button key={c.key} type="button" className={`${s.line} tl`} disabled={done} onClick={() => o.place(c)}>{c.text}</button>)}
      </div>
      {!done && <button type="button" className={s.check} disabled={o.placed.length !== texts.length} onClick={o.check}>{t('quiz.check')}</button>}
      {done && state === 'wrong' && <pre className={`${s.expected} tl`}>{correct}</pre>}
    </DndContext>
  );
}
