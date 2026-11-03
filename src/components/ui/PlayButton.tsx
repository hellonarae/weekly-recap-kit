import { Play, Square } from 'lucide-react';
import { useAudio } from '@/audio/AudioService';
import { useTrack } from '@/modules/useEvents';
import s from './PlayButton.module.css';

interface Props {
  id: string;
  text: string;
  speaker?: string;
  scope?: string;
  weekId?: string;
  size?: 'small' | 'large';
  label?: string;
}

/** ▶ for one line/word. Highlights while playing; click again to stop. */
export function PlayButton({ id, text, speaker, scope, weekId, size = 'small', label }: Props) {
  const audio = useAudio();
  const track = useTrack();
  const active = audio.playingId === id;
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (active) { audio.stop(); return; }
    track('line_play', weekId, { id, speed: audio.speed });
    void audio.play(id, { text, speaker, scope, speed: audio.speed });
  };
  if (!audio.supported && !audio.hasFileAudio({ text, speaker, scope, speed: 1 })) return null;
  return (
    <button type="button" className={`${s.btn} ${size === 'large' ? s.large : ''}`} data-active={active} onClick={onClick} aria-label={label ?? `Play ${text}`} aria-pressed={active}>
      {active ? <Square size={size === 'large' ? 20 : 14} /> : <Play size={size === 'large' ? 20 : 14} />}
    </button>
  );
}
