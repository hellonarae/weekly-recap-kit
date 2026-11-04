import type { AudioProvider, SpeechRequest } from './AudioProvider';

/**
 * macOS/iOS ship the same character voices in every language ("Eddy (Spanish (Spain))", "Flo (French (France))" …)
 * and Chrome lists them before the language's regular voice, so taking the first match gave every speaker Eddy, a male
 * voice. The Web Speech API has no gender field: these names are the only voices whose gender we know. A language's
 * regular system voice (Mónica, Amélie, Microsoft Helena…) is usually female, so it leads for female speakers and comes
 * after the known male voices for male ones.
 */
const CHARACTER_VOICES: Record<string, 'f' | 'm'> = { Flo: 'f', Sandy: 'f', Shelley: 'f', Grandma: 'f', Eddy: 'm', Reed: 'm', Rocko: 'm', Grandpa: 'm' };
const NOVELTY = new Set(['Grandma', 'Grandpa', 'Rocko']);
const characterGender = (v: SpeechSynthesisVoice): 'f' | 'm' | undefined => CHARACTER_VOICES[v.name.split(' (')[0]!];
/** Lower is better: the regular local voice, then Chrome's online Google voice, then character voices, novelty last. */
function rank(v: SpeechSynthesisVoice): number {
  const base = v.name.split(' (')[0]!;
  if (!(base in CHARACTER_VOICES)) return v.localService ? 0 : 1;
  return NOVELTY.has(base) ? 3 : 2;
}

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
    const found = exact.length ? exact : all.filter((v) => v.lang.toLowerCase().startsWith(base));
    return found.map((v, i) => ({ v, i })).sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i).map(({ v }) => v);
  }

  /** The voices a speaker of this gender may use, best first (see CHARACTER_VOICES). */
  private poolFor(voices: SpeechSynthesisVoice[], gender: 'f' | 'm' | undefined): SpeechSynthesisVoice[] {
    if (!gender) return voices;
    const known = voices.filter((v) => characterGender(v) === gender);
    const unknown = voices.filter((v) => characterGender(v) === undefined);
    const pool = gender === 'f' ? [...unknown, ...known] : [...known, ...unknown];
    return pool.length ? pool : voices;
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
        // Same-gender speakers rotate through their pool; if it is too small, nudge pitch ±10 % to tell them apart.
        const pool = this.poolFor(voices, sp?.gender);
        const sameGender = this.speakerOrder.filter((s) => this.speakers[s]?.gender === sp?.gender);
        const idx = Math.max(0, sameGender.indexOf(req.speaker));
        u.voice = pool[idx % pool.length] ?? null;
        if (pool.length < sameGender.length) u.pitch = 1 + (idx % 2 === 0 ? 0.1 : -0.1);
        // A male speaker on a voice not known to be male (often the female default): lower it a little.
        if (sp?.gender === 'm' && u.voice && characterGender(u.voice) !== 'm') u.pitch -= 0.15;
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
