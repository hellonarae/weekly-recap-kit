import { createContext, useContext } from 'react';
import { nullSink, type EventSink, type EventType } from './events';

/** Phase E swaps nullSink for a Supabase-backed sink when modules.tracking is on. */
export const EventsContext = createContext<EventSink>(nullSink);

export function useTrack() {
  const sink = useContext(EventsContext);
  return (type: EventType, weekId?: string, payload?: Record<string, unknown>) => sink.record({ type, weekId, payload });
}
