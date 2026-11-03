/**
 * Turns display text into what the TTS should say. The screen keeps "010-3681-4795예요" and
 * "12월 23일"; the voice gets "공일공 삼육팔일 사칠구오예요" and "십이월 이십삼일".
 * Rules (this adapter is selected for target_language ko by ./index.ts):
 *  - hyphenated digit groups (phone numbers) → digit by digit, Sino-Korean, groups separated by a pause
 *  - number + 시/개/명/살/마리/권/장/병/잔/송이/그루 → native Korean (한 시, 두 개 … up to 99)
 *  - any other number → Sino-Korean (십이월, 이십삼일, 삼십분, 이호선, 일층, 백 원)
 *  - a vocabulary row like "1월 (일월)" or "0 공" (digits + their Hangul reading, brackets optional) → the Hangul part only
 *  - a lone word gets a full stop so the voice does not trail off
 */
const DIGITS = ['공', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const NATIVE_ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_ONES_ATTR = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const NATIVE_TENS_ATTR = ['', '열', '스무', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const NATIVE_COUNTERS = /^(시|개|명|살|마리|권|장|병|잔|송이|그루|번째|시간|달)/;

export function sino(n: number): string {
  if (n === 0) return '영';
  const units = ['', '십', '백', '천'];
  const big = ['', '만', '억'];
  let out = '';
  let group = 0;
  while (n > 0) {
    const part = n % 10000;
    if (part) {
      let s = '';
      let p = part;
      for (let u = 0; p > 0 && u < 4; u++) {
        const d = p % 10;
        if (d) s = (d === 1 && u > 0 ? '' : DIGITS[d]!) + units[u]! + s;
        p = Math.floor(p / 10);
      }
      out = s + big[group] + out;
    }
    n = Math.floor(n / 10000);
    group++;
  }
  return out;
}

/** Month names: 6월 = 유월, 10월 = 시월 */
export function month(n: number): string {
  return n === 6 ? '유월' : n === 10 ? '시월' : sino(n) + '월';
}

export function native(n: number, attributive = true): string {
  if (n <= 0 || n > 99) return sino(n);
  const t = Math.floor(n / 10), o = n % 10;
  if (o === 0) return (attributive ? NATIVE_TENS_ATTR : NATIVE_TENS)[t]!;
  return NATIVE_TENS[t]! + (attributive ? NATIVE_ONES_ATTR : NATIVE_ONES)[o]!;
}

export function toSpeech(text: string): string {
  let s = text;
  // "1월 (일월)", "1월 일월", "0 공" — vocabulary rows that already carry the reading: keep the reading only
  const row = /^(\d+)(월|일)?\s+\(?([가-힣]+)\)?$/u.exec(s);
  if (row) {
    const n = Number(row[1]), suf = row[2] ?? '';
    const expected = suf === '월' ? month(n) : sino(n) + suf;
    if (row[3] === expected || (n === 0 && row[3] === '공')) s = row[3]!;
  }
  // phone numbers: 010-3681-4795 → 공일공 삼육팔일 사칠구오
  s = s.replace(/\d+(?:\s*-\s*\d+)+/g, (m) => m.split(/\s*-\s*/).map((g) => [...g].map((d) => DIGITS[Number(d)]).join('')).join(' '));
  // numbers with a counter
  s = s.replace(/(\d+)\s*(?=[가-힣])/gu, (m, num: string, offset: number) => {
    const after = s.slice(offset + m.length);
    const n = Number(num);
    const nativeCounter = NATIVE_COUNTERS.test(after) && !/^시[작간]/.test(after);
    if (after.startsWith('월')) return month(n).slice(0, -1);
    return nativeCounter ? native(n) + ' ' : sino(n);
  });
  // bare numbers
  s = s.replace(/\d+/g, (m) => sino(Number(m)));
  s = s.replace(/\s+/g, ' ').trim();
  // single word / short phrase without end punctuation: add a full stop so the voice doesn't trail
  if (!/[.?!…]$/.test(s)) s += '.';
  return s;
}
