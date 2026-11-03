import { useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '@/i18n/t';
import { useAuthState } from '@/auth/context';
import s from '@/auth/auth.module.css';

/** Account section at the bottom of My page (teacher's choice: no separate Profile page): email, study code, consent status;
 *  join / withdraw / delete; sign out. Renders nothing while auth is off or unconfigured. */
export function AccountSection() {
  const auth = useAuthState();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'withdraw' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [pw, setPw] = useState('');
  const [pwState, setPwState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const p = auth.profile;
  if (!auth.enabled || auth.status !== 'signedIn' || !p) return null;

  const run = (fn: () => Promise<void>) => { setBusy(true); setError(''); fn().catch((e: Error) => setError(e.message)).finally(() => { setBusy(false); setConfirm(null); }); };
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '');

  return (
    <section className={s.card} style={{ margin: '32px 0 0', maxWidth: 'none' }}>
      <h2>{t('profile.title')}</h2>
      <div className={s.row}><span>{t('profile.email')}</span><strong>{p.email}</strong></div>
      {p.display_name && <div className={s.row}><span>{t('profile.name')}</span><strong>{p.display_name}</strong></div>}
      <div className={s.row}><span>{t('profile.code')}</span>{p.code && auth.consented ? <span className={s.code}>{p.code}</span> : <span className="small">{t('profile.noCode')}</span>}</div>
      <div className={s.row}>
        <span>{t('profile.study')}</span>
        <span>{auth.consented ? t('profile.consented', { date: date(p.consent_at) }) : p.withdrawn_at ? t('profile.withdrawn', { date: date(p.withdrawn_at) }) : t('profile.notJoined')}</span>
      </div>
      <p className="small">{auth.consented ? t('profile.recordingOn') : t('profile.recordingOff')} <Link to="/privacy">{t('consent.privacyLink')}</Link></p>

      <form className={s.section} onSubmit={(e) => { e.preventDefault(); setPwState('saving'); auth.setPassword(pw).then(() => { setPwState('saved'); setPw(''); }).catch((err: Error) => { setError(err.message); setPwState('idle'); }); }}>
        <label className={s.label} htmlFor="newpw">{t('profile.passwordLabel')}</label>
        <div className={s.actions} style={{ justifyContent: 'flex-start' }}>
          <input id="newpw" className={s.input} style={{ maxWidth: 280 }} type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => { setPw(e.target.value); setPwState('idle'); }} placeholder={t('profile.passwordPlaceholder')} />
          <button type="submit" className={s.secondary} disabled={pw.length < 8 || pwState === 'saving'}>{pwState === 'saved' ? t('profile.passwordSaved') : t('profile.passwordSave')}</button>
        </div>
        <p className="small">{t('profile.passwordHint')}</p>
      </form>

      {confirm ? (
        <div className={s.section}>
          <p>{t(confirm === 'withdraw' ? 'profile.withdrawConfirm' : 'profile.deleteConfirm')}</p>
          <div className={s.actions}>
            <button type="button" className={s.secondary} disabled={busy} onClick={() => setConfirm(null)}>{t('feedback.cancel')}</button>
            <button type="button" className={s.danger} disabled={busy} onClick={() => run(confirm === 'withdraw' ? auth.withdraw : auth.deleteAccount)}>{t(confirm === 'withdraw' ? 'profile.withdraw' : 'profile.delete')}</button>
          </div>
        </div>
      ) : (
        <div className={s.actions}>
          {auth.consented
            ? <button type="button" className={s.secondary} disabled={busy} onClick={() => setConfirm('withdraw')}>{t('profile.withdraw')}</button>
            : <button type="button" className={s.primary} disabled={busy} onClick={() => run(auth.giveConsent)}>{t('profile.join')}</button>}
          <button type="button" className={s.secondary} disabled={busy} onClick={() => setConfirm('delete')}>{t('profile.delete')}</button>
          <button type="button" className={s.secondary} disabled={busy} onClick={() => run(auth.signOut)}>{t('profile.signOut')}</button>
        </div>
      )}
      {error && <p role="alert" className={s.error}>{error}</p>}
    </section>
  );
}
