import type { EventRecord } from '@/modules/events';

/** Reserved seam: a reward rule reads the event log and returns cosmetics to grant. Nothing uses it yet. */
export interface RewardRule {
  id: string;
  evaluate(events: EventRecord[]): string[];
}

export const noopRule: RewardRule = { id: 'noop', evaluate: () => [] };
