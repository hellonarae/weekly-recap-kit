import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Pause, Play, Repeat, Square, User } from 'lucide-react';
import type { Dialogue, Week } from '@/content/types';
import { course } from '@/config/course';
import { t } from '@/i18n/t';
import { useAudio } from '@/audio/AudioService';
import { useTrack } from '@/modules/useEvents';
import { Recorder, beep, playBlob, recordingSupported, wait, type MicState } from '@/audio/recorder';
import s from './Dialogue.module.css';

type Mode = 'listen' | 'repeat' | 'shadow' | 'roleplay';
const MODES: Mode[] = ['listen', 'repeat', 'shadow', 'roleplay'];
const GAP_MS = 800;

interface Line { idx: number; speaker: string; tl: string; en: string }

/**
 * The dialogue stage: bubbles + a floating player bar with four modes. One sequencer (`runSeq`)
 * drives Listen / Shadow / Role-play so cancelling is a single token check. Recordings stay in memory.
 */
export function DialogueStage({ week, dialogue, scope }: { week: Week; dialogue: Dialogue; scope: string }) {
  const audio = useAudio();
  const track = useTrack();
  const lines = useMemo<Line[]>(() => dialogue.items.map((it, idx) => it.kind === 'line' ? { idx, speaker: it.speaker, tl: it.tl, en: it.en } : null).filter((x): x is Line => x !== null), [dialogue]);
  const speakers = useMemo(() => [...new Set(lines.map((l) => l.speaker))], [lines]);
  const [mode, setMode] = useState<Mode>('listen');
  const [showEn, setShowEn] = useState(true);
  const [active, setActive] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mic, setMic] = useState<MicState>(recordingSupported() ? 'idle' : 'unsupported');
  const [takes, setTakes] = useState<Record<number, Blob>>({});
  const [shadowTake, setShadowTake] = useState<Blob | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [repeatIdx, setRepeatIdx] = useState(0);
  const [repeatPhase, setRepeatPhase] = useState<'idle' | 'playing' | 'recording' | 'review'>('idle');
  const [status, setStatus] = useState<string>('');
  const token = useRef(0);
  const recorder = useRef(new Recorder());
  const stageRef = useRef<HTMLDivElement>(null);
  const shadowUrl = useObjectUrl(shadowTake);

  // `audio` is a fresh object every render; depend on its stable stop() so cancel() itself stays stable.
  // (Otherwise the effects below re-run on every render and pause audio right after it starts.)
  const stopAudio = audio.stop;
  const cancel = useCallback(() => { token.current++; stopAudio(); setRunning(false); setRecording(false); setActive(null); }, [stopAudio]);
  useEffect(() => () => { cancel(); recorder.current.release(); }, [cancel]);
  useEffect(() => { cancel(); setRepeatPhase('idle'); setRepeatIdx(0); setStatus(''); }, [mode, cancel]);

  const speakerColor = (sp: string) => `var(--speaker-${(speakers.indexOf(sp) % 6) + 1})`;
  const side = (sp: string) => (speakers.indexOf(sp) % 2 === 0 ? 'left' : 'right');

  const playLine = useCallback(async (l: Line) => {
    setActive(l.idx);
    const started = Date.now();
    await audio.play(`${dialogue.id}-${l.idx}`, { text: l.tl, speaker: l.speaker, scope, speed: audio.speed });
    return Date.now() - started;
  }, [audio, dialogue.id, scope]);

  const ensureMic = async (): Promise<boolean> => {
    if (mic === 'ready') return true;
    setMic('requesting');
    const st = await recorder.current.init();
    setMic(st);
    return st === 'ready';
  };

  // ---- Listen ----
  const listenAll = async () => {
    cancel();
    const my = ++token.current;
    setRunning(true);
    track('line_play', week.id, { mode: 'listen', all: true, speed: audio.speed });
    for (const l of lines) {
      if (token.current !== my) return;
      await playLine(l);
      if (token.current !== my) return;
      await wait(GAP_MS);
    }
    if (token.current === my) { setRunning(false); setActive(null); }
  };
  const listenOne = async (l: Line) => {
    cancel();
    const my = ++token.current;
    track('line_play', week.id, { mode, line: l.idx, speed: audio.speed });
    do { await playLine(l); if (token.current !== my) return; if (loop) await wait(400); } while (loop && token.current === my);
    if (token.current === my) setActive(null);
  };

  // ---- Repeat ----
  const repeatStep = async () => {
    const l = lines[repeatIdx];
    if (!l || !(await ensureMic())) return;
    cancel();
    const my = ++token.current;
    setRunning(true);
    setRepeatPhase('playing');
    const dur = await playLine(l);
    if (token.current !== my) return;
    await beep();
    setRepeatPhase('recording'); setRecording(true);
    track('record_start', week.id, { mode: 'repeat', line: l.idx });
    recorder.current.start();
    await wait(Math.max(1500, dur * 1.5 + 1000));
    const blob = await recorder.current.stop();
    if (token.current !== my) return;
    setRecording(false); setRunning(false);
    setTakes((x) => ({ ...x, [l.idx]: blob }));
    setRepeatPhase('review');
  };
  const playTake = async (idx: number, m: Mode) => { const b = takes[idx]; if (!b) return; cancel(); track('record_play', week.id, { mode: m, line: idx }); await playBlob(b); };

  // ---- Shadow ----
  const shadow = async () => {
    if (!(await ensureMic())) return;
    cancel();
    const my = ++token.current;
    setRunning(true); setRecording(true); setShadowTake(null);
    track('record_start', week.id, { mode: 'shadow' });
    recorder.current.start();
    for (const l of lines) {
      if (token.current !== my) { await recorder.current.stop(); return; }
      await playLine(l);
      await wait(GAP_MS);
    }
    const blob = await recorder.current.stop();
    if (token.current !== my) return;
    setShadowTake(blob); setRecording(false); setRunning(false); setActive(null);
    track('shadow_complete', week.id, { lines: lines.length });
  };

  // ---- Role-play ----
  const myTurn = useRef<((blob: Blob) => void) | null>(null);
  const roleplay = async () => {
    if (!role || !(await ensureMic())) return;
    cancel();
    const my = ++token.current;
    setRunning(true);
    for (const l of lines) {
      if (token.current !== my) return;
      if (l.speaker !== role) { await playLine(l); await wait(GAP_MS / 2); continue; }
      // My line: wait for tap → record → tap → stop
      setActive(l.idx);
      setStatus(t('dialogue.yourTurn'));
      const blob = await new Promise<Blob>((resolve) => { myTurn.current = resolve; });
      if (token.current !== my) return;
      setTakes((x) => ({ ...x, [l.idx]: blob }));
      setStatus('');
    }
    if (token.current === my) { setRunning(false); setActive(null); track('roleplay_complete', week.id, { role }); }
  };
  const toggleMyRecording = async () => {
    if (!recording) { setRecording(true); track('record_start', week.id, { mode: 'roleplay' }); recorder.current.start(); return; }
    const blob = await recorder.current.stop();
    setRecording(false);
    myTurn.current?.(blob); myTurn.current = null;
  };
  const roleplayBack = async () => {
    cancel();
    const my = ++token.current;
    setRunning(true);
    for (const l of lines) {
      if (token.current !== my) return;
      setActive(l.idx);
      if (l.speaker === role && takes[l.idx]) await playBlob(takes[l.idx]!);
      else await playLine(l);
      await wait(GAP_MS / 2);
    }
    if (token.current === my) { setRunning(false); setActive(null); }
  };

  const hasAllMine = role ? lines.filter((l) => l.speaker === role).every((l) => takes[l.idx]) : false;

  return (
    <div className={s.stage} ref={stageRef}>
      <div className={s.topbar}>
        <label className={s.toggle}><input type="checkbox" checked={showEn} onChange={(e) => setShowEn(e.target.checked)} /> {t('dialogue.showTranslation')}</label>
        {audio.lastSource === 'browser' && <span className={s.badge}>{t('dialogue.deviceVoice')}</span>}
      </div>

      <ol className={s.lines}>
        {dialogue.items.map((it, idx) => {
          if (it.kind === 'direction') return <li key={idx} className={s.direction}>({it.text})</li>;
          const l = lines.find((x) => x.idx === idx)!;
          const mine = mode === 'roleplay' && role === it.speaker;
          return (
            <li key={idx} className={s.line} data-side={side(it.speaker)} data-active={active === idx} data-mine={mine}>
              <span className={s.avatar} style={{ background: speakerColor(it.speaker) }} aria-hidden="true">{it.speaker.slice(0, 1)}</span>
              <button type="button" className={s.bubble} onClick={() => mode === 'listen' ? listenOne(l) : undefined}>
                <span className={s.speaker}>{it.speaker}</span>
                <span className={`tl ${s.tl}`}>{mine && running && active === idx ? '…' : it.tl}</span>
                {showEn && <span className={s.en}>{it.en}</span>}
                {takes[idx] && mode !== 'listen' && <span className={s.takeMark}><Mic size={12} /> {t('dialogue.recorded')}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <div className={s.player}>
        <div className={s.modes} role="tablist" aria-label={t('dialogue.mode')}>
          {MODES.map((m) => <button key={m} type="button" role="tab" aria-selected={mode === m} className={s.mode} onClick={() => setMode(m)}>{t(`dialogue.mode.${m}`)}</button>)}
        </div>

        {mic === 'denied' && mode !== 'listen' && <p className={s.warn}>{t('dialogue.micDenied')}</p>}
        {mic === 'unsupported' && mode !== 'listen' && <p className={s.warn}>{t('dialogue.micUnsupported')}</p>}

        {mode === 'listen' && (
          <div className={s.controls}>
            <button type="button" className={s.primary} onClick={running ? cancel : listenAll}>{running ? <Pause size={18} /> : <Play size={18} />} {running ? t('dialogue.stop') : t('dialogue.playAll')}</button>
            <button type="button" className={s.secondary} aria-pressed={loop} onClick={() => setLoop((x) => !x)}><Repeat size={16} /> {t('dialogue.loop')}</button>
            <Speed />
          </div>
        )}

        {mode === 'repeat' && (
          <div className={s.controls}>
            <p className={s.hint}>{t('dialogue.repeatHint')} · {t('dialogue.lineN', { i: repeatIdx + 1, n: lines.length })}</p>
            {repeatPhase !== 'review' && (
              <button type="button" className={s.primary} disabled={running} onClick={repeatStep}>
                {repeatPhase === 'recording' ? <><Mic size={18} /> {t('dialogue.recording')}</> : repeatPhase === 'playing' ? <><Play size={18} /> {t('dialogue.listening')}</> : <><Play size={18} /> {t('dialogue.playThenRecord')}</>}
              </button>
            )}
            {repeatPhase === 'review' && (
              <>
                <button type="button" className={s.secondary} onClick={() => playTake(lines[repeatIdx]!.idx, 'repeat')}><User size={16} /> {t('dialogue.me')}</button>
                <button type="button" className={s.secondary} onClick={() => listenOne(lines[repeatIdx]!)}><Play size={16} /> {t('dialogue.original')}</button>
                <button type="button" className={s.secondary} onClick={() => setRepeatPhase('idle')}><Mic size={16} /> {t('dialogue.again')}</button>
                <button type="button" className={s.primary} onClick={() => { setRepeatIdx((i) => Math.min(i + 1, lines.length - 1)); setRepeatPhase('idle'); }} disabled={repeatIdx >= lines.length - 1}>{t('dialogue.next')}</button>
              </>
            )}
            <Speed />
          </div>
        )}

        {mode === 'shadow' && (
          <div className={s.controls}>
            <p className={s.hint}>{t('dialogue.shadowHint')}</p>
            <button type="button" className={s.primary} onClick={running ? cancel : shadow}>{running ? <><Square size={18} /> {t('dialogue.stop')}</> : <><Mic size={18} /> {t('dialogue.startShadow')}</>}</button>
            {shadowTake && !running && (
              <div className={s.compare}>
                <button type="button" className={s.secondary} onClick={listenAll}><Play size={16} /> {t('dialogue.original')}</button>
                <audio controls src={shadowUrl} className={s.audioEl} aria-label={t('dialogue.me')} />
              </div>
            )}
            <Speed />
          </div>
        )}

        {mode === 'roleplay' && (
          <div className={s.controls}>
            <div className={s.roles}>
              <span className={s.hint}>{t('dialogue.pickRole')}</span>
              {speakers.map((sp) => <button key={sp} type="button" className={s.role} aria-pressed={role === sp} style={{ '--c': speakerColor(sp) } as React.CSSProperties} onClick={() => { if (!running) setRole(sp); }}>{sp}</button>)}
            </div>
            {status && running ? (
              <button type="button" className={s.primary} data-rec={recording} onClick={toggleMyRecording}><Mic size={18} /> {recording ? t('dialogue.tapToStop') : t('dialogue.tapToRecord')}</button>
            ) : (
              <button type="button" className={s.primary} disabled={!role} onClick={running ? cancel : roleplay}>{running ? <><Square size={18} /> {t('dialogue.stop')}</> : <><Play size={18} /> {t('dialogue.startRoleplay')}</>}</button>
            )}
            {hasAllMine && !running && <button type="button" className={s.secondary} onClick={roleplayBack}><Play size={16} /> {t('dialogue.playBack')}</button>}
            <Speed />
          </div>
        )}
      </div>
    </div>
  );
}

function Speed() {
  const audio = useAudio();
  if (course.audio.speed_options.length < 2) return null;
  return (
    <div className={s.speed} role="group" aria-label={t('dialogue.speed')}>
      {course.audio.speed_options.map((sp) => <button key={sp} type="button" aria-pressed={audio.speed === sp} onClick={() => audio.setSpeed(sp)}>{sp}×</button>)}
    </div>
  );
}

function useObjectUrl(blob: Blob | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) { setUrl(undefined); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
