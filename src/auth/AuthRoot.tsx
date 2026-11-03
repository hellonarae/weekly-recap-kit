/** The real auth provider (modules.auth: supabase). Loaded lazily from App so builds with auth off never
 *  pull in supabase-js. Owns: session + profile, consent/withdraw/delete RPCs, the event sink identity,
 *  the feedback sink and the progress mirror (decision 002.2). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { course, levels } from '@/config/course';
import { AuthContext, defaultAuth, type AuthState, type AuthStatus, type Profile } from './context';
import { EventsContext } from '@/modules/useEvents';
import { createSupabaseSink } from '@/modules/supabaseSink';
import { FeedbackSinkContext, mailtoSink, type FeedbackSink } from '@/components/feedback/feedbackSink';
import { progress, type Progress } from '@/state/progress';

const DECLINED_KEY = 'recap.consent.declined';

export function AuthRoot({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unconfigured');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const sink = useMemo(() => createSupabaseSink(), []);
  const mirrored = useRef(false);
  const loggedIn = useRef(false);

  useEffect(() => {
    if (!supabase) { console.warn('[auth] modules.auth is "supabase" but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set; running without auth'); return; }
    const client = supabase;
    client.auth.getSession().then(({ data }) => { setSession(data.session); setStatus(data.session ? 'signedIn' : 'signedOut'); });
    const { data: sub } = client.auth.onAuthStateChange((_e, next) => {
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
      if (!next) { setProfile(null); mirrored.current = false; loggedIn.current = false; }
    });
    return () => { sub.subscription.unsubscribe(); sink.dispose(); };
  }, [sink]);

  const loadProfile = async (userId: string): Promise<Profile | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) { console.error('[auth] profile', error.message); return null; }
    return (data as Profile | null) ?? null;
  };

  // Profile on sign-in; record the login event; merge the server progress into this browser once.
  useEffect(() => {
    if (!supabase || !session) return;
    let cancelled = false;
    void loadProfile(session.user.id).then(async (p) => {
      if (cancelled || !p) return;
      setProfile(p);
      if (!mirrored.current) {
        mirrored.current = true;
        progress.merge(p.progress as Partial<Progress>);
        await supabase!.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('user_id', p.user_id);
      }
    });
    return () => { cancelled = true; };
  }, [session]);

  // Tracking identity follows consent; a login event is recorded once the identity exists.
  const consented = Boolean(profile?.consent_at && !profile.withdrawn_at);
  useEffect(() => {
    if (!course.modules.tracking) return;
    sink.setIdentity(consented && profile ? { userId: profile.user_id, code: profile.code } : null);
    if (consented && !loggedIn.current) { loggedIn.current = true; sink.record({ type: 'login' }); }
  }, [consented, profile?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress mirror: debounce local changes to profiles.progress (cross-device continue).
  useEffect(() => {
    if (!supabase || !profile) return;
    let timer: number | undefined;
    const unsub = progress.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void supabase!.from('profiles').update({ progress: progress.get() }).eq('user_id', profile.user_id); }, 2000);
    });
    return () => { unsub(); window.clearTimeout(timer); };
  }, [profile?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const feedbackSink = useMemo<FeedbackSink>(() => {
    if (!supabase) return mailtoSink;
    return {
      available: true,
      opensMail: false,
      async send(p) {
        const { data } = await supabase!.auth.getSession();
        const uid = data.session?.user.id;
        if (!uid) throw new Error('not signed in');
        const { error } = await supabase!.from('feedback').insert({ user_id: uid, code: profile?.code ?? null, kind: p.kind, message: p.message, page: p.page, user_agent: p.userAgent });
        if (error) throw new Error(error.message);
      },
    };
  }, [profile?.code]);

  const value = useMemo<AuthState>(() => ({
    ...defaultAuth,
    enabled: true,
    status,
    profile,
    isAdmin: profile?.role === 'admin',
    consented,
    visibleLevels: profile?.levels?.length ? levels.map((l) => l.id).filter((id) => profile.levels!.includes(id)) : levels.map((l) => l.id),
    async signIn(email, inviteCode) {
      if (!supabase) throw new Error('unconfigured');
      const domain = email.split('@')[1]?.toLowerCase() ?? '';
      const allowed = (course.auth?.allowed_domains ?? []).map((d) => d.toLowerCase());
      if (allowed.length && !allowed.includes(domain) && !inviteCode) throw new Error('needCode');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
          shouldCreateUser: true,
          data: inviteCode ? { invite_code: inviteCode.trim().toUpperCase() } : undefined,
        },
      });
      // The sign-up trigger raises for a bad domain / code; Supabase reports it as a generic database error.
      if (error) throw new Error(/database error|not allowed|invite/i.test(error.message) ? 'notAllowed' : error.message);
    },
    async verifyCode(email, token) {
      if (!supabase) throw new Error('unconfigured');
      const { error } = await supabase.auth.verifyOtp({ email, token: token.replace(/\s+/g, ''), type: 'email' });
      if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'badCode' : error.message);
    },
    async signInWithPassword(email, password) {
      if (!supabase) throw new Error('unconfigured');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(/invalid login/i.test(error.message) ? 'badPassword' : error.message);
    },
    async setPassword(password) {
      if (!supabase) throw new Error('unconfigured');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    async signOut() { await sink.flush(); await supabase?.auth.signOut(); },
    async giveConsent(name) {
      if (!supabase) return;
      const { data, error } = await supabase.rpc('give_consent', { prefix: course.auth?.code_prefix ?? 'P', name: name?.trim() || null });
      if (error) throw new Error(error.message);
      try { localStorage.removeItem(DECLINED_KEY); } catch { /* ignore */ }
      setProfile(data as Profile);
    },
    async withdraw() {
      if (!supabase) return;
      sink.setIdentity(null);
      const { data, error } = await supabase.rpc('withdraw_consent');
      if (error) throw new Error(error.message);
      setProfile(data as Profile);
    },
    async deleteAccount() {
      if (!supabase) return;
      sink.setIdentity(null);
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(error.message);
      await supabase.auth.signOut();
    },
  }), [status, profile, consented, sink]);

  return (
    <AuthContext.Provider value={value}>
      <EventsContext.Provider value={course.modules.tracking ? sink : defaultSink}>
        <FeedbackSinkContext.Provider value={feedbackSink}>{children}</FeedbackSinkContext.Provider>
      </EventsContext.Provider>
    </AuthContext.Provider>
  );
}

const defaultSink = { record: () => undefined };
