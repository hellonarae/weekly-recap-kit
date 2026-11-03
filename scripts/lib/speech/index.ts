// Spoken-text adapters by language (SPEC §8). Display text stays on screen; the voice gets the adapter's output.
// Adding a language = a new file here that exports toSpeech(text) and a line in RULES. Unknown languages pass through
// (lone words still get a full stop so the voice does not trail off).
import { toSpeech as ko } from './ko';

const RULES: Record<string, (text: string) => string> = { ko };

export function toSpeech(text: string, lang: string): string {
  const rule = RULES[lang.slice(0, 2).toLowerCase()];
  if (rule) return rule(text);
  const s = text.replace(/\s+/g, ' ').trim();
  return /[.?!…]$/.test(s) ? s : s + '.';
}
