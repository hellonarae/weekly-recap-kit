import { createContext, useContext } from 'react';
import { course } from '@/config/course';

export type FeedbackKind = 'issue' | 'general';
export interface FeedbackPayload { kind: FeedbackKind; message: string; page: string; userAgent: string }

/** Where "Send feedback" goes. Phase E adds a Supabase sink (table `feedback`, insert under RLS). */
export interface FeedbackSink {
  available: boolean;
  send(p: FeedbackPayload): Promise<void>;
  /** True when sending hands over to the mail app instead of posting silently. */
  opensMail: boolean;

}

/** Fallback with the auth module off: open the mail app with everything pre-filled. */
export const mailtoSink: FeedbackSink = {
  available: Boolean(course.app.contact_email),
  opensMail: true,
  async send(p) {
    const subject = `[${course.app.short_name}] ${p.kind === 'issue' ? 'Issue' : 'Feedback'}`;
    const body = `${p.message}\n\n—\nPage: ${p.page}\nBrowser: ${p.userAgent}`;
    window.location.href = `mailto:${course.app.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },
};

/** AuthRoot provides the Supabase sink when modules.auth is on; otherwise the mailto fallback. */
export const FeedbackSinkContext = createContext<FeedbackSink>(mailtoSink);
export const useFeedbackSink = (): FeedbackSink => useContext(FeedbackSinkContext);
