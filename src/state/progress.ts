import { useSyncExternalStore } from 'react';

// Per-browser learner progress (localStorage). The event log (Phase E) is the research record;
// this store only drives UI state: status dots, Review tab, stars, saved examples.
export type TabId = 'vocab' | 'grammar' | 'dialogue' | 'quiz' | 'review';

export interface QuizResult {
  score: number;
  total: number;
  ms: number;
  at: string;
  /** item ids answered wrong in the last run */
  wrong: string[];
}

export interface WeekProgress {
  tabs: Partial<Record<TabId, true>>;
  quiz?: QuizResult;
  /** ids ever answered wrong and not yet cleared by a correct retry */
  wrongPool: string[];
}

export interface Progress {
  weeks: Record<string, WeekProgress>;
  /** `${level}|${tl}` */
  stars: string[];
  /** `${grammarPointId}|${exampleIndex}` */
  savedExamples: string[];
}

const KEY = 'recap.progress.v1';
const empty: Progress = { weeks: {}, stars: [], savedExamples: [] };
let state: Progress = load();
const listeners = new Set<() => void>();

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const p = JSON.parse(raw) as Partial<Progress>;
    return { weeks: p.weeks ?? {}, stars: p.stars ?? [], savedExamples: p.savedExamples ?? [] };
  } catch {
    return empty;
  }
}

function commit(next: Progress): void {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: in-memory only */ }
  listeners.forEach((l) => l());
}

function week(id: string): WeekProgress {
  return state.weeks[id] ?? { tabs: {}, wrongPool: [] };
}

export const progress = {
  get: () => state,
  markTab(weekId: string, tab: TabId): void {
    const w = week(weekId);
    if (w.tabs[tab]) return;
    commit({ ...state, weeks: { ...state.weeks, [weekId]: { ...w, tabs: { ...w.tabs, [tab]: true } } } });
  },
  recordQuiz(weekId: string, r: QuizResult, retriedIds?: string[]): void {
    const w = week(weekId);
    // wrongPool: add new wrongs; remove ids that were retried and got right this run
    const pool = new Set(w.wrongPool);
    r.wrong.forEach((id) => pool.add(id));
    (retriedIds ?? []).filter((id) => !r.wrong.includes(id)).forEach((id) => pool.delete(id));
    commit({ ...state, weeks: { ...state.weeks, [weekId]: { ...w, quiz: r, wrongPool: [...pool] } } });
  },
  toggleStar(level: string, tl: string): boolean {
    const k = `${level}|${tl}`;
    const has = state.stars.includes(k);
    commit({ ...state, stars: has ? state.stars.filter((s) => s !== k) : [...state.stars, k] });
    return !has;
  },
  isStarred: (level: string, tl: string) => state.stars.includes(`${level}|${tl}`),
  toggleSavedExample(pointId: string, index: number): boolean {
    const k = `${pointId}|${index}`;
    const has = state.savedExamples.includes(k);
    commit({ ...state, savedExamples: has ? state.savedExamples.filter((s) => s !== k) : [...state.savedExamples, k] });
    return !has;
  },
  /** Union with a progress object saved on the server (decision 002.2): tabs/stars/saved are unioned,
   *  a week's quiz result is kept from whichever ran last. */
  merge(remote: Partial<Progress> | null | undefined): void {
    if (!remote || typeof remote !== 'object') return;
    const weeks: Record<string, WeekProgress> = { ...state.weeks };
    for (const [id, rw] of Object.entries(remote.weeks ?? {})) {
      const lw = weeks[id] ?? { tabs: {}, wrongPool: [] };
      const quiz = !lw.quiz ? rw.quiz : !rw.quiz ? lw.quiz : (rw.quiz.at > lw.quiz.at ? rw.quiz : lw.quiz);
      weeks[id] = { tabs: { ...rw.tabs, ...lw.tabs }, wrongPool: [...new Set([...(rw.wrongPool ?? []), ...lw.wrongPool])], ...(quiz ? { quiz } : {}) };
    }
    const next: Progress = {
      weeks,
      stars: [...new Set([...state.stars, ...(remote.stars ?? [])])],
      savedExamples: [...new Set([...state.savedExamples, ...(remote.savedExamples ?? [])])],
    };
    if (JSON.stringify(next) !== JSON.stringify(state)) commit(next);
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useProgress(): Progress {
  return useSyncExternalStore(progress.subscribe, progress.get, progress.get);
}
