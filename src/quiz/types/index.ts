import type { ComponentType } from 'react';
import type { RunnerItem, RunnerType } from '../items';

/** What a renderer reports back. `answer` is kept for the event log / quiz_answers table. */
export interface AnswerReport { correct: boolean; answer: unknown }

export interface RendererProps<T extends RunnerItem = RunnerItem> {
  item: T;
  scope: string;
  /** Called once per item when the learner commits an answer. */
  onAnswer(report: AnswerReport): void;
  /** True after onAnswer: renderers lock input and show the correct answer. */
  done: boolean;
}

export interface QuizTypeDef<T extends RunnerItem = RunnerItem> {
  type: T['type'];
  Renderer: ComponentType<RendererProps<T>>;
  /** Short label for the end-of-quiz list. */
  summary(item: T): string;
}

export const registry = new Map<RunnerType, QuizTypeDef>();

export function registerQuizType<T extends RunnerItem>(def: QuizTypeDef<T>): void {
  registry.set(def.type, def as unknown as QuizTypeDef);
}
