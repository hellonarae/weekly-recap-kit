import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { t } from '@/i18n/t';
import { useFeedbackSink, type FeedbackKind } from './feedbackSink';
import s from './FeedbackDialog.module.css';

/** Issue / general feedback. Mirrors Beagle Talk's dialog, minus the screenshot (no server to e-mail it). */
export function FeedbackDialog({ onClose }: { onClose(): void }) {
  const sink = useFeedbackSink();
  const [kind, setKind] = useState<FeedbackKind>('issue');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    if (message.trim().length < 3) return;
    setState('sending');
    await sink.send({ kind, message: message.trim(), page: window.location.href, userAgent: navigator.userAgent });
    setState('sent');
  };

  return (
    <div className={s.backdrop} role="dialog" aria-modal="true" aria-labelledby="fb-title" onClick={onClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <header className={s.head}>
          <h2 id="fb-title">{t('feedback.title')}</h2>
          <button type="button" className={s.close} onClick={onClose} aria-label={t('feedback.cancel')}><X size={20} /></button>
        </header>
        {!sink.available ? (
          <p>{t('feedback.unavailable')}</p>
        ) : state === 'sent' ? (
          <>
            <p>{t('feedback.sent')}</p>
            <div className={s.actions}><button type="button" className={s.primary} onClick={onClose}>OK</button></div>
          </>
        ) : (
          <>
            <div className={s.toggle} role="radiogroup" aria-label={t('feedback.kind')}>
              {(['issue', 'general'] as FeedbackKind[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} className={s.toggleBtn} onClick={() => setKind(k)}>{t(`feedback.kind.${k}`)}</button>
              ))}
            </div>
            <textarea className={s.textarea} value={message} maxLength={5000} autoFocus placeholder={t(`feedback.placeholder.${kind}`)} aria-label={t('feedback.message')} onChange={(e) => setMessage(e.target.value)} />
            {sink.opensMail && <p className="small">{t('feedback.mailHint')}</p>}
            <div className={s.actions}>
              <button type="button" className={s.secondary} onClick={onClose}>{t('feedback.cancel')}</button>
              <button type="button" className={s.primary} disabled={state === 'sending' || message.trim().length < 3} onClick={() => void send()}>{t('feedback.send')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
