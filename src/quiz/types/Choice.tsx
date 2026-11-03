import { useState } from 'react';
import type { QuizItem } from '@/content/types';
import type { ListenChooseItem } from '../items';
import type { RendererProps } from './index';
import { PlayButton } from '@/components/ui/PlayButton';
import { useAudio } from '@/audio/AudioService';
import { useEffect } from 'react';
import s from './Quiz.module.css';

type Mcq = Extract<QuizItem, { type: 'mcq' }>;
type Blank = Extract<QuizItem, { type: 'blank' }>;
type Tf = Extract<QuizItem, { type: 'tf' }>;

function Options({ options, answer, done, picked, onPick }: { options: string[]; answer: number; done: boolean; picked: number | null; onPick(i: number): void }) {
  return (
    <div className={s.options} role="group">
      {options.map((o, i) => {
        const state = !done ? 'idle' : i === answer ? 'correct' : i === picked ? 'wrong' : 'idle';
        return (
          <button key={i} type="button" className={`${s.option} tl`} data-state={state} disabled={done} onClick={() => onPick(i)} aria-pressed={picked === i}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function McqRenderer({ item, onAnswer, done }: RendererProps<Mcq>) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <>
      <p className={`${s.prompt} tl`}>{item.prompt}</p>
      <Options options={item.options} answer={item.answer} done={done} picked={picked} onPick={(i) => { setPicked(i); onAnswer({ correct: i === item.answer, answer: i }); }} />
    </>
  );
}

export function BlankRenderer({ item, onAnswer, done }: RendererProps<Blank>) {
  const [picked, setPicked] = useState<number | null>(null);
  const [before, after] = item.sentence.split('___');
  const fill = picked !== null ? item.options[picked] : null;
  return (
    <>
      <p className={`${s.prompt} tl`}>
        {before}<span className={s.gap} data-filled={fill !== null} data-state={done ? (picked === item.answer ? 'correct' : 'wrong') : 'idle'}>{fill ?? '___'}</span>{after}
      </p>
      <Options options={item.options} answer={item.answer} done={done} picked={picked} onPick={(i) => { setPicked(i); onAnswer({ correct: i === item.answer, answer: i }); }} />
    </>
  );
}

export function TfRenderer({ item, onAnswer, done }: RendererProps<Tf>) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const opts = [true, false];
  return (
    <>
      <p className={s.prompt}>{item.statement}</p>
      <div className={s.options}>
        {opts.map((v) => {
          const state = !done ? 'idle' : v === item.answer ? 'correct' : v === picked ? 'wrong' : 'idle';
          return <button key={String(v)} type="button" className={s.option} data-state={state} disabled={done} onClick={() => { setPicked(v); onAnswer({ correct: v === item.answer, answer: v }); }}>{v ? 'True' : 'False'}</button>;
        })}
      </div>
    </>
  );
}

export function ListenChooseRenderer({ item, onAnswer, done, scope }: RendererProps<ListenChooseItem>) {
  const [picked, setPicked] = useState<number | null>(null);
  const audio = useAudio();
  // Auto-play shortly after mount. The delay lets the previous item's stop() settle; Safari may still
  // require one manual ▶ before it allows speech, so the button stays visible.
  useEffect(() => {
    const id = setTimeout(() => { void audio.play(`lc-${item.id}`, { text: item.text, speaker: item.speaker, scope, speed: audio.speed }); }, 250);
    return () => { clearTimeout(id); audio.stop(); };
  }, [item.id]); // eslint-disable-line
  return (
    <>
      <div className={s.listen}>
        <PlayButton id={`lc-${item.id}`} text={item.text} speaker={item.speaker} scope={scope} size="large" />
        {done && <span className="tl">{item.text}</span>}
      </div>
      <Options options={item.options} answer={item.answer} done={done} picked={picked} onPick={(i) => { setPicked(i); onAnswer({ correct: i === item.answer, answer: i }); }} />
    </>
  );
}
