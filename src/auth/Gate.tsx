/** Decides what the main area shows when auth is on: sign-in form, consent screen, or the page.
 *  /privacy stays readable while signed out (students should be able to read it before signing in). */
import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { course } from '@/config/course';
import { t } from '@/i18n/t';
import { useAuthState } from './context';
import { SignIn } from './SignIn';
import { Consent } from './Consent';

const DECLINED_KEY = 'recap.consent.declined';

export function Gate({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  const { pathname } = useLocation();
  const [declined, setDeclined] = useState(() => { try { return localStorage.getItem(DECLINED_KEY) === '1'; } catch { return false; } });
  if (!auth.enabled || auth.status === 'unconfigured') return <>{children}</>;
  if (pathname.replace(/\/$/, '').endsWith('/privacy')) return <>{children}</>;
  if (auth.status === 'loading') return <p className="small">{t('auth.loading')}</p>;
  if (auth.status === 'signedOut') return <SignIn />;
  if (!auth.profile) return <p className="small">{t('auth.loading')}</p>;
  const needsConsent = course.auth?.consent_required !== false && !auth.profile.consent_at && !auth.profile.withdrawn_at && !declined;
  if (needsConsent) return <Consent onDecline={() => { try { localStorage.setItem(DECLINED_KEY, '1'); } catch { /* ignore */ } setDeclined(true); }} />;
  return <>{children}</>;
}
