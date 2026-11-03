import type { AudioProvider, SpeechRequest } from './AudioProvider';

export interface AudioIndexItem { key: string; speaker?: string; text: string; file: string }
export interface AudioIndex { items: AudioIndexItem[] }

/**
 * Plays build-time mp3s (Phase D) from public/_audio/<scope>/. Indexes are fetched once per scope.
 *
 * iOS Safari rules shape this class: audio may only start inside a user gesture, and a sequence
 * (Play all, Role-play) can only continue if the SAME <audio> element that was unlocked by that gesture
 * is reused. So there is exactly one element, created on the first gesture and kept for the session,
 * and play() must stay synchronous — the caller preloads the index with load() and asks isLoaded().
 */
export class FileAudioProvider implements AudioProvider {
  readonly name = 'file' as const;
  private indexes = new Map<string, Map<string, string>>();
  private pending = new Map<string, Promise<void>>();
  private el: HTMLAudioElement | null = null;
  private token = 0;

  constructor(private readonly base: string) {}

  /** Fetch a scope's index once. Safe to call repeatedly. */
  load(scope: string): Promise<void> {
    if (this.indexes.has(scope)) return Promise.resolve();
    const p = this.pending.get(scope);
    if (p) return p;
    const run = (async () => {
      const map = new Map<string, string>();
      try {
        const res = await fetch(`${this.base}_audio/${scope}/index.json`);
        if (res.ok) {
          const idx = (await res.json()) as AudioIndex;
          for (const it of idx.items) map.set(`${it.speaker ?? ''}\u0000${it.text}`, `${this.base}_audio/${scope}/${it.file}`);
        }
      } catch { /* offline or no audio: fall back */ }
      this.indexes.set(scope, map);
      this.pending.delete(scope);
    })();
    this.pending.set(scope, run);
    return run;
  }

  isLoaded(scope: string | undefined): boolean {
    return !scope || this.indexes.has(scope);
  }

  urlFor(req: SpeechRequest): string | undefined {
    if (!req.scope) return undefined;
    return this.indexes.get(req.scope)?.get(`${req.speaker ?? ''}\u0000${req.text}`);
  }

  canPlay(req: SpeechRequest): boolean {
    return this.urlFor(req) !== undefined;
  }

  private element(): HTMLAudioElement {
    if (!this.el) {
      this.el = new Audio();
      this.el.preload = 'auto';
      (this.el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    }
    return this.el;
  }

  play(req: SpeechRequest): Promise<void> {
    const url = this.urlFor(req);
    if (!url) return Promise.resolve();
    const el = this.element();
    const my = ++this.token;
    return new Promise((resolve) => {
      const done = () => { if (this.token === my) { el.onended = null; el.onerror = null; resolve(); } };
      el.onended = done;
      el.onerror = done;
      el.src = url;
      el.playbackRate = req.speed;
      // Must be called synchronously within the gesture on iOS; a rejected promise (blocked) resolves us.
      void el.play().then(() => { el.playbackRate = req.speed; }).catch(done);
    });
  }

  stop(): void {
    this.token++;
    if (this.el && !this.el.paused) this.el.pause();
  }
}
