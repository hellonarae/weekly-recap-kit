/**
 * In-browser recording. Blobs live in memory only — never uploaded (CLAUDE.md privacy rule).
 * Why the mime juggling: Chrome/Firefox record webm/opus, Safari (incl. iOS 14.5+) records mp4/aac,
 * and asking for an unsupported type throws. We pick the first supported one.
 */
export type MicState = 'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported';

const CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', ''];

export function recordingSupported(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
}

export class Recorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mime = '';

  async init(): Promise<MicState> {
    if (!recordingSupported()) return 'unsupported';
    if (this.stream) return 'ready';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mime = CANDIDATES.find((m) => !m || MediaRecorder.isTypeSupported(m)) ?? '';
      return 'ready';
    } catch {
      return 'denied';
    }
  }

  get recording(): boolean { return this.rec?.state === 'recording'; }

  start(): void {
    if (!this.stream) throw new Error('Recorder not initialised');
    this.chunks = [];
    this.rec = this.mime ? new MediaRecorder(this.stream, { mimeType: this.mime }) : new MediaRecorder(this.stream);
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start(250);
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const r = this.rec;
      if (!r || r.state === 'inactive') { resolve(new Blob(this.chunks, { type: this.mime || 'audio/webm' })); return; }
      r.onstop = () => resolve(new Blob(this.chunks, { type: r.mimeType || this.mime || 'audio/webm' }));
      r.stop();
    });
  }

  release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.rec = null;
  }
}

/** Short beep before a recording starts (Repeat mode). */
export function beep(ms = 150, freq = 880): Promise<void> {
  return new Promise((resolve) => {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + ms / 1000);
      osc.onended = () => { void ctx.close(); resolve(); };
    } catch { resolve(); }
  });
}

export function playBlob(blob: Blob): Promise<HTMLAudioElement> {
  const el = new Audio(URL.createObjectURL(blob));
  return new Promise((resolve) => {
    el.onended = () => { URL.revokeObjectURL(el.src); resolve(el); };
    el.onerror = () => resolve(el);
    void el.play().catch(() => resolve(el));
  });
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
