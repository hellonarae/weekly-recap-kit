import content from '@/generated/content.json';
import type { ContentBundle, Level, Week } from '@/content/types';

// content.json is produced at build time; the app only ever reads it.
export const bundle = content as unknown as ContentBundle;
export const course = bundle.course;
export const levels: Level[] = bundle.levels;

export function levelById(id: string | undefined): Level | undefined {
  return levels.find((l) => l.id === id);
}

export function weekOf(level: Level, n: number): Week | undefined {
  return level.weeks.find((w) => w.week === n);
}

/** Weeks a student should see: published, newest first. */
export function visibleWeeks(level: Level): Week[] {
  return [...level.weeks].filter((w) => w.status === 'published').sort((a, b) => b.week - a.week);
}
