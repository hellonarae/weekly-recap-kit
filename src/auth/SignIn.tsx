import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { course } from '@/config/course';
import { t } from '@/i18n/t';
import { useAuthState } from './context';
import s from './auth.module.css';

type Mode = 'code' | 'password';
type Phase = 'idle' | 'sending' | 'sent' | 'verifying';

/** Sign-in. Default: email → one-time code typed from the email (the link in the same email also works, but
 *  university mail scanners open links first and burn them — decision 003). Optional: email + password for
 *  accounts that set one on My page. Any non-allowed email needs an invite code (decision 002.4). */
export function SignIn() {
  const auth = useAuthState();
  const [mode, setMode] = useState<Mode>('code');
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState('');
  // With no allowed domains every sign-up needs a class code, so the field is shown from the start.
  const [showInvite, setShowInvite] = useState((course.auth?.allowed_domains ?? []).length === 0);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [pwBusy, setPwBusy] = useState(false);
  const [error, setError] = useState('');
  const domains = course.auth?.allowed_domains ?? [];
  const known: Record<string, string> = { needCode: t('signin.needCode'), notAllowed: t('signin.notAllowed'), badCode: t('signin.badCode'), badPassword: t('signin.badPassword') };
  const fail = (err: unknown) => { const m = err instanceof Error ? err.message : String(err); if (m === 'needCode') setShowInvite(true); setError(known[m] ?? t('signin.error', { message: m })); };

  async function send(e: FormEvent) {
    e.preventDefault(); setError(''); setPhase('sending');
    try { await auth.signIn(email.trim(), showInvite && invite.trim() ? invite.trim() : undefined); setPhase('sent'); }
    catch (err) { fail(err); setPhase('idle'); }
  }
  async function verify(e: FormEvent) {
    e.preventDefault(); setError(''); setPhase('verifying');
    try { await auth.verifyCode(email.trim(), code); } catch (err) { fail(err); setPhase('sent'); }
  }
  async function withPassword(e: FormEvent) {
    e.preventDefault(); setError(''); setPwBusy(true);
    try { await auth.signInWithPassword(email.trim(), password); } catch (err) { fail(err); } finally { setPwBusy(false); }
  }

  const emailField = (
    <>
      <label className={s.label} htmlFor="email">{t('signin.emailLabel')}</label>
      <input id="email" className={s.input} type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder={domains.length ? `you@${domains[0]}` : 'you@example.com'} />
    </>
  );

  return (
    <div className={s.card}>
      {phase === 'sent' || phase === 'verifying' ? (
        <form className={s.form} onSubmit={(e) => void verify(e)}>
          <h1>{t('signin.codeTitle')}</h1>
          <p>{t('signin.codeBody', { email })}</p>
          <label className={s.label} htmlFor="otp">{t('signin.codeFieldLabel')}</label>
          <input id="otp" className={`${s.input} ${s.otp}`} inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="12345678" />
          <button type="submit" className={s.primary} disabled={phase === 'verifying' || code.length < 6}>{phase === 'verifying' ? t('signin.verifying') : t('signin.verify')}</button>
          {error && <p role="alert" className={s.error}>{error}</p>}
          <p className="small">{t('signin.sentHint')} <button type="button" className={s.linkBtn} onClick={() => { setPhase('idle'); setCode(''); setError(''); }}>{t('signin.resend')}</button></p>
        </form>
      ) : mode === 'password' ? (
        <form className={s.form} onSubmit={(e) => void withPassword(e)}>
          <h1>{t('signin.title')}</h1>
          <p>{t('signin.passwordSubtitle')}</p>
          {emailField}
          <label className={s.label} htmlFor="pw">{t('signin.passwordLabel')}</label>
          <input id="pw" className={s.input} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className={s.primary} disabled={pwBusy || !email || !password}>{t('signin.submitPassword')}</button>
          {error && <p role="alert" className={s.error}>{error}</p>}
          <button type="button" className={s.linkBtn} onClick={() => { setMode('code'); setError(''); }}>{t('signin.useCode')}</button>
        </form>
      ) : (
        <form className={s.form} onSubmit={(e) => void send(e)}>
          <h1>{t('signin.title')}</h1>
          <p>{domains.length ? t('signin.subtitleDomains', { domain: domains[0]! }) : t('signin.subtitle')}</p>
          {emailField}
          {showInvite ? (
            <>
              <label className={s.label} htmlFor="invite">{domains.length ? t('signin.inviteLabel') : t('signin.classCodeLabel')}</label>
              <input id="invite" className={s.input} autoComplete="off" autoCapitalize="characters" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="ABCD-1234" />
              <p className="small">{domains.length ? t('signin.inviteHint') : t('signin.classCodeHint')}</p>
            </>
          ) : (
            <button type="button" className={s.linkBtn} onClick={() => setShowInvite(true)}>{t('signin.haveInvite')}</button>
          )}
          <button type="submit" className={s.primary} disabled={phase === 'sending' || !email || (showInvite && invite.trim().length < 4)}>{phase === 'sending' ? t('signin.sending') : t('signin.submit')}</button>
          {error && <p role="alert" className={s.error}>{error}</p>}
          <p className="small"><button type="button" className={s.linkBtn} onClick={() => { setMode('password'); setError(''); }}>{t('signin.usePassword')}</button> · <Link to="/privacy">{t('signin.privacyLink')}</Link></p>
        </form>
      )}
    </div>
  );
}
