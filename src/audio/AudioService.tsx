import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { course } from '@/config/course';
import type { SpeechRequest } from './AudioProvider';
import { BrowserTtsProvider } from './BrowserTtsProvider';
import { FileAudioProvider } from './FileAudioProvider';

export type Source = 'file' | 'browser' | 'none';

interface AudioApi {
  /** Plays and resolves when done. `id` lets UI highlight the active item. */
  play(id: string, req: Omit<SpeechRequest, 'lang'>): Promise<void>;
  stop(): void;
  playingId: string | null;
  /** Which source played last — drives the "device voice" badge. */
  lastSource: Source;
  /** Preload the file index for a scope (week or vocab). */
  loadScope(scope: string): Promise<void>;
  hasFileAudio(req: Omit<SpeechRequest, 'lang'>): boolean;
  fileUrl(req: Omit<SpeechRequest, 'lang'>): string | undefined;
  speed: number;
  setSpeed(s: number): void;
  supported: boolean;
}

const Ctx = createContext<AudioApi | null>(null);

export function AudioProviderRoot({ children }: { children: ReactNode }) {
  const file = useMemo(() => new FileAudioProvider(import.meta.env.BASE_URL), []);
  const tts = useMemo(() => new BrowserTtsProvider(course.speakers), []);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<Source>('none');
  const [speed, setSpeed] = useState<number>(course.audio.speed_options.includes(1) ? 1 : course.audio.speed_options[0] ?? 1);
  const seq = useRef(0);

  // Chrome loads voices asynchronously; touching getVoices() early makes the first play use the right one.
  useEffect(() => {
    if (!BrowserTtsProvider.supported()) return;
    speechSynthesis.getVoices();
    const on = () => speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', on);
    return () => speechSynthesis.removeEventListener('voiceschanged', on);
  }, []);

  const stop = useCallback(() => { file.stop(); tts.stop(); seq.current++; setPlayingId(null); }, [file, tts]);

  const play = useCallback(async (id: string, r: Omit<SpeechRequest, 'lang'>) => {
    stop();
    const my = ++seq.current;
    const req: SpeechRequest = { lang: course.app.target_language, ...r, speed: r.speed ?? speed };
    // Stay synchronous when the index is already loaded (iOS only allows audio to start inside the tap).
    if (!file.isLoaded(req.scope)) { await file.load(req.scope!); if (seq.current !== my) return; }
    const provider = file.canPlay(req) ? file : tts.canPlay() ? tts : null;
    setLastSource(provider?.name ?? 'none');
    if (!provider) return;
    setPlayingId(id);
    await provider.play(req);
    if (seq.current === my) setPlayingId(null);
  }, [file, tts, speed, stop]);

  const api = useMemo<AudioApi>(() => ({
    play, stop, playingId, lastSource, speed, setSpeed,
    loadScope: (s) => file.load(s),
    hasFileAudio: (r) => file.canPlay({ lang: course.app.target_language, ...r }),
    fileUrl: (r) => file.urlFor({ lang: course.app.target_language, ...r }),
    supported: BrowserTtsProvider.supported(),
  }), [play, stop, playingId, lastSource, speed, file]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAudio(): AudioApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAudio outside AudioProviderRoot');
  return v;
}
