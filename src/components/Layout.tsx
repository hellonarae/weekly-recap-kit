import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog';
import { useFeedbackSink } from '@/components/feedback/feedbackSink';
import { course } from '@/config/course';
import { useAuthState } from '@/auth/context';
import { Gate } from '@/auth/Gate';
import { t } from '@/i18n/t';
import s from './Layout.module.css';

/** Wordmark from app.name: the middle word(s) get the primary colour (e.g. Weekly *Spanish* Recap). */
function Wordmark() {
  const words = course.app.name.split(' ');
  if (words.length < 3) return <>{course.app.name}</>;
  return (
    <>
      {words[0]} <em>{words.slice(1, -1).join(' ')}</em> {words[words.length - 1]}
    </>
  );
}

export function Layout() {
  const m = course.modules;
  const auth = useAuthState();
  const signedIn = auth.status === 'signedIn';
  // Feedback goes to mail until Supabase is configured, then to the feedback table (signed-in users only).
  // No sink (auth off and no app.contact_email, as in the kit) → no button at all, rather than a dead dialog.
  const sink = useFeedbackSink();
  const [feedback, setFeedback] = useState(false);
  return (
    <div className={s.shell}>
      <a className="visually-hidden" href="#main">{t('a11y.skip')}</a>
      <header className={s.header}>
        <NavLink to="/" className={s.wordmark}><Wordmark /></NavLink>
        <nav className={s.nav} aria-label="Main">
          <NavLink to="/my">{t('nav.my')}</NavLink>
          {m.admin && auth.isAdmin && <NavLink to="/admin">{t('nav.admin')}</NavLink>}
        </nav>
      </header>
      <main id="main" className={s.main}><Gate><Outlet /></Gate></main>
      <footer className={s.footer}>
        {course.app.footer_note && <span>{course.app.footer_note}</span>}
        {course.audio.provider === 'elevenlabs' && course.audio.attribution && <span>{t('footer.audio')}</span>}
        <span><NavLink to="/privacy">{t('nav.privacy')}</NavLink></span>
        {sink.available && (m.auth === 'none' || auth.status === 'unconfigured' || signedIn) && <span><button type="button" className={s.linkBtn} onClick={() => setFeedback(true)}><MessageSquare size={13} aria-hidden="true" />{t('feedback.button')}</button></span>}
      </footer>
      {feedback && <FeedbackDialog onClose={() => setFeedback(false)} />}
    </div>
  );
}
