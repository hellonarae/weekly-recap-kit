/** Browser Supabase client. The anon key is public by design; RLS is the protection (CLAUDE.md §3).
 *  `null` when the env vars are missing so the app stays browsable while the project is being set up.
 *  Only files under src/auth/, src/modules/supabaseSink.ts and src/pages/Admin.tsx import this; they are
 *  loaded lazily and only when course.yml → modules.auth is "supabase", so the kit never ships it active. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        // implicit flow: the magic link carries the session itself, so it works even when the link opens in a
        // different browser than the one that asked for it (Mail app → default browser, phone in-app browsers).
        // PKCE (the default) needs a verifier stored by the requesting browser and silently fails otherwise.
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      })
    : null;
