/** Every learner action is an event. Tracking, rewards and the avatar all READ this; nothing writes bespoke counters. */
export type EventType =
  | 'login' | 'consent_given' | 'consent_withdrawn' | 'week_open' | 'tab_open' | 'heartbeat'
  | 'line_play' | 'record_start' | 'record_play' | 'shadow_complete' | 'roleplay_complete'
  | 'flashcard_flip' | 'star_add' | 'star_remove' | 'quiz_start' | 'quiz_answer' | 'quiz_finish' | 'export_anki';

export interface EventRecord {
  type: EventType;
  weekId?: string;
  payload?: Record<string, unknown>;
  at: string;
}

export interface EventSink {
  record(e: Omit<EventRecord, 'at'>): void;
}

/** Default sink when modules.tracking is off: drops everything. */
export const nullSink: EventSink = { record: () => undefined };
