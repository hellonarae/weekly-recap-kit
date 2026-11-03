import { useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '@/i18n/t';
import { useAuthState } from './context';
import s from './auth.module.css';

/** Research consent, shown once after the first sign-in. Yes → participant code; "Not now" → the site works,
 *  nothing is recorded, and the question can be revisited from the Profile page. */
export function Consent({ onDecline }: { onDecline(): void }) {
  const auth = useAuthState();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  return (
    <div className={s.card}>
      <h1>{t('consent.title')}</h1>
      {(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const).map((k) => <p key={k}>{t(`consent.${k}`)}</p>)}
      <p className="small"><Link to="/privacy">{t('consent.privacyLink')}</Link></p>
      <label className={s.label} htmlFor="name">{t('consent.nameLabel')}</label>
      <input id="name" className={s.input} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('consent.namePlaceholder')} />
      <div className={s.actions}>
        <button type="button" className={s.secondary} disabled={busy} onClick={onDecline}>{t('consent.decline')}</button>
        <button type="button" className={s.primary} disabled={busy || name.trim().length < 2} onClick={() => { setBusy(true); auth.giveConsent(name).catch((e: Error) => { setError(e.message); setBusy(false); }); }}>{t('consent.accept')}</button>
      </div>
      {error && <p role="alert" className={s.error}>{error}</p>}
    </div>
  );
}
