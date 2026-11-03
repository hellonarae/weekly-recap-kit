import type { AudioProvider, SpeechRequest } from './AudioProvider';

/**
 * Runtime fallback using the device's speechSynthesis. Why so defensive: iOS Safari only loads
 * voices after a user gesture, Chrome fires voiceschanged late, and some devices have one voice
 * per language — so we pick a different voice per speaker when we can and nudge the pitch when we can't.
 */
export class BrowserTtsProvider implements AudioProvider {
  readonly name = 'browser' as const;
  private speakerOrder: string[] = [];
  private current: SpeechSynthesisUtterance | null = null;

  constructor(private readonly speakers: Record<string, { gender: 'f' | 'm'; fallback: string }>) {
    this.speakerOrder = Object.keys(speakers);
  }

  static supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  canPlay(): boolean {
    return BrowserTtsProvider.supported();
  }

  private voicesFor(lang: string): SpeechSynthesisVoice[] {
    const all = speechSynthesis.getVoices();
    const base = lang.split('-')[0]!.toLowerCase();
    const exact = all.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase());
    return exact.length ? exact : all.filter((v) => v.lang.toLowerCase().startsWith(base));
  }

  play(req: SpeechRequest): Promise<void> {
    this.stop();
    // cancel() followed immediately by speak() drops the utterance on some engines; yield one tick.
    return new Promise<void>((r) => setTimeout(r, 30)).then(() => new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(req.text);
      const sp = req.speaker ? this.speakers[req.speaker] : undefined;
      u.lang = sp?.fallback ?? req.lang;
      u.rate = req.speed;
      const voices = this.voicesFor(u.lang);
      if (voices.length && req.speaker) {
        // Same-gender speakers rotate through the available voices; otherwise nudge pitch ±10 %.
        const sameGender = this.speakerOrder.filter((s) => this.speakers[s]?.gender === sp?.gender);
        const idx = Math.max(0, sameGender.indexOf(req.speaker));
        u.voice = voices[idx % voices.length] ?? null;
        if (voices.length < sameGender.length) u.pitch = 1 + (idx % 2 === 0 ? 0.1 : -0.1);
        if (sp?.gender === 'm') u.pitch -= 0.05;
      } else if (voices[0]) {
        u.voice = voices[0];
      }
      const done = () => { if (this.current === u) this.current = null; resolve(); };
      u.onend = done;
      u.onerror = done;
      this.current = u;
      speechSynthesis.speak(u);
    }));
  }

  stop(): void {
    if (this.current) { this.current = null; speechSynthesis.cancel(); }
  }
}
