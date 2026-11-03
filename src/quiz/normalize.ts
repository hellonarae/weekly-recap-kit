/** Lenient comparison for typed answers: whitespace, punctuation, full-width characters, trailing 요./요?. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // full-width → ASCII
    .replace(/[.?!。？！,，'"“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function answersMatch(given: string, answer: string, accept: string[] = []): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  return [answer, ...accept].some((a) => normalizeAnswer(a) === g);
}

export type DiffOp = { op: 'same' | 'add' | 'del'; ch: string };

/** Character-level diff (LCS) of what the learner typed vs the expected answer — shown on a wrong answer. */
export function charDiff(given: string, expected: string): DiffOp[] {
  const a = [...given], b = [...expected];
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ op: 'same', ch: a[i]! }); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { out.push({ op: 'del', ch: a[i]! }); i++; }
    else { out.push({ op: 'add', ch: b[j]! }); j++; }
  }
  while (i < n) out.push({ op: 'del', ch: a[i++]! });
  while (j < m) out.push({ op: 'add', ch: b[j++]! });
  return out;
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
