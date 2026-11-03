/** Auth state shared with the whole app. This file imports nothing from Supabase, so Layout, Home and the
 *  pages can read it in every build; the real provider (AuthRoot) is loaded only when modules.auth is on. */
import { createContext, useContext } from 'react';
import { course, levels } from '@/config/course';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unconfigured';

export interface Profile {
  user_id: string;
  email: string;
  /** name as on the class list, given on the consent screen */
  display_name: string | null;
  role: 'student' | 'admin';
  code: string | null;
  consent_at: string | null;
  withdrawn_at: string | null;
  levels: string[] | null;
  invite_code: string | null;
  progress: Record<string, unknown>;
  created_at: string;
}

export interface AuthState {
  /** modules.auth !== 'none' */
  enabled: boolean;
  status: AuthStatus;
  profile: Profile | null;
  isAdmin: boolean;
  /** consent given and not withdrawn → events are recorded */
  consented: boolean;
  /** level ids this user may open (profile.levels, else all) */
  visibleLevels: string[];
  /** Sends the email with the one-time code (+ link). Throws 'needCode' | 'notAllowed' | message. */
  signIn(email: string, inviteCode?: string): Promise<void>;
  /** Signs in with the code from the email (immune to link-scanning mail servers). */
  verifyCode(email: string, token: string): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<void>;
  /** Sets or changes the password of the signed-in account (password sign-in is optional). */
  setPassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  giveConsent(name?: string): Promise<void>;
  withdraw(): Promise<void>;
  deleteAccount(): Promise<void>;
}

const noop = async () => undefined;
export const defaultAuth: AuthState = {
  enabled: course.modules.auth !== 'none',
  status: 'unconfigured',
  profile: null,
  isAdmin: false,
  consented: false,
  visibleLevels: levels.map((l) => l.id),
  signIn: noop, verifyCode: noop, signInWithPassword: noop, setPassword: noop, signOut: noop, giveConsent: noop, withdraw: noop, deleteAccount: noop,
};

export const AuthContext = createContext<AuthState>(defaultAuth);
export const useAuthState = (): AuthState => useContext(AuthContext);
