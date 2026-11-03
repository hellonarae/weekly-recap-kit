/** Event sink for modules.tracking: batches `events` rows and flushes every 60 s or when the page hides
 *  (SPEC §9). Heartbeat every 30 s while the tab is visible and the learner touched the page in the last
 *  2 minutes → active minutes = heartbeats × 0.5. Records only while the learner has consented.
 *  Flushes use fetch(keepalive) straight to PostgREST so a flush on pagehide survives navigation. */
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '@/lib/supabase';
import type { EventRecord, EventSink } from './events';

const FLUSH_MS = 60_000;
const HEARTBEAT_MS = 30_000;
const IDLE_MS = 120_000;

interface Identity { userId: string; code: string | null }

export interface SupabaseSink extends EventSink {
  /** Called by AuthRoot whenever the profile changes; null stops recording. */
  setIdentity(id: Identity | null): void;
  flush(): Promise<void>;
  dispose(): void;
}

export function createSupabaseSink(): SupabaseSink {
  let identity: Identity | null = null;
  let queue: (EventRecord & { userId: string; code: string | null })[] = [];
  let lastInteraction = Date.now();
  let lastWeek: string | undefined;
  let lastTab: string | undefined;

  const touch = () => { lastInteraction = Date.now(); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'scroll']) window.addEventListener(ev, touch, { passive: true });

  async function flush(): Promise<void> {
    if (!queue.length || !supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    const batch = queue;
    queue = [];
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) { queue = [...batch, ...queue]; return; }
    const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}`, Prefer: 'return=minimal' };
    const rows = batch.map((e) => ({ user_id: e.userId, code: e.code, type: e.type, week_id: e.weekId ?? null, payload: e.payload ?? {}, created_at: e.at }));
    const answers = batch.filter((e) => e.type === 'quiz_answer' && e.weekId).map((e) => ({
      user_id: e.userId, code: e.code, week_id: e.weekId, item_id: String(e.payload?.item ?? ''), type: String(e.payload?.type ?? ''),
      correct: Boolean(e.payload?.correct), answer: e.payload?.answer ?? null, ms: typeof e.payload?.ms === 'number' ? e.payload.ms : null, created_at: e.at,
    }));
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/events`, { method: 'POST', headers, body: JSON.stringify(rows), keepalive: true });
      if (!r.ok) throw new Error(`events ${r.status}`);
      if (answers.length) await fetch(`${SUPABASE_URL}/rest/v1/quiz_answers`, { method: 'POST', headers, body: JSON.stringify(answers), keepalive: true });
    } catch (e) {
      console.warn('[events] flush failed; will retry', e);
      queue = [...batch, ...queue].slice(-500);
    }
  }

  const timer = window.setInterval(() => void flush(), FLUSH_MS);
  const heartbeat = window.setInterval(() => {
    if (!identity || document.visibilityState !== 'visible' || Date.now() - lastInteraction > IDLE_MS) return;
    if (!/\/week\//.test(window.location.pathname)) return; // only study time counts
    sink.record({ type: 'heartbeat', weekId: lastWeek, payload: { tab: lastTab } });
  }, HEARTBEAT_MS);
  const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', () => void flush());

  const sink: SupabaseSink = {
    record(e) {
      if (!identity) return;
      if (e.type === 'tab_open') { lastWeek = e.weekId; lastTab = typeof e.payload?.tab === 'string' ? e.payload.tab : undefined; }
      queue.push({ ...e, at: new Date().toISOString(), userId: identity.userId, code: identity.code });
      if (e.type === 'quiz_finish' || e.type === 'export_anki' || queue.length >= 50) void flush();
    },
    setIdentity(id) { if (!id && identity) void flush(); identity = id; },
    flush,
    dispose() {
      window.clearInterval(timer); window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onHide);
      for (const ev of ['pointerdown', 'keydown', 'touchstart', 'scroll']) window.removeEventListener(ev, touch);
    },
  };
  return sink;
}
