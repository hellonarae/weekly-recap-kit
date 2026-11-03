import type { QuizItem } from '@/content/types';

/** Items the runner can show: authored types plus the auto-generated ones. */
export type FlashcardItem = { id: string; type: 'flashcard'; tl: string; en: string; speaker?: string };
export type LineOrderItem = { id: string; type: 'line_order'; lines: { speaker: string; tl: string }[]; explain?: string };
export type ListenChooseItem = { id: string; type: 'listen_choose'; text: string; speaker: string; options: string[]; answer: number; explain?: string };
export type RunnerItem = QuizItem | FlashcardItem | LineOrderItem | ListenChooseItem;
export type RunnerType = RunnerItem['type'];
