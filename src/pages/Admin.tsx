/** /admin (role = admin only, RLS-gated reads). Participants · Weeks · Feedback · Access · Export.
 *  Everything here is a plain Supabase query under the admin policies — no server, no service role. */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { course, levels } from '@/config/course';
import { t } from '@/i18n/t';
import { useAuthState } from '@/auth/context';
import { supabase } from '@/lib/supabase';
import s from './Admin.module.css';

interface Row {
  user_id: string; email: string; display_name: string | null; role: string; code: string | null; consent_at: string | null; withdrawn_at: string | null;
  levels: string[] | null; invite_code: string | null; created_at: string; last_seen_at: string | null;
  active_minutes: number; events_n: number; last_active: string | null;
  weeks: Record<string, { tabs: string[] | null; minutes: number; plays: number; quiz: { score: number; total: number } | null }>;
}
interface FeedbackRow { id: string; code: string | null; kind: string; message: string; page: string | null; created_at: string }
interface CodeRow { code: string; levels: string[] | null; max_uses: number; uses: number; expires_at: string | null; note: string | null; created_at: string }
type Tab = 'participants' | 'weeks' | 'feedback' | 'access' | 'export';

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '–');
const csv = (rows: (string | number | null | undefined)[][]) => rows.map((r) => r.map((v) => { const x = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; }).join(',')).join('\n');
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function randomCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) => Array.from({ length: n }, () => A[Math.floor(Math.random() * A.length)]).join('');
  return `${pick(4)}-${pick(4)}`;
}

export function Admin() {
  const auth = useAuthState();
  const [tab, setTab] = useState<Tab>('participants');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[] | null>(null);
  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [domains, setDomains] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [o, f, c, d] = await Promise.all([
      supabase.rpc('admin_overview'),
      supabase.from('feedback').select('*').order('created_at', { ascending: false }),
      supabase.from('invite_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('allowed_domains').select('domain').order('domain'),
    ]);
    const err = o.error ?? f.error ?? c.error ?? d.error;
    if (err) { setError(err.message); return; }
    setRows(o.data as Row[]); setFeedback(f.data as FeedbackRow[]); setCodes(c.data as CodeRow[]); setDomains((d.data as { domain: string }[]).map((x) => x.domain));
  }, []);
  useEffect(() => { if (auth.isAdmin) void load(); }, [auth.isAdmin, load]);

  if (auth.status === 'loading' || (auth.status === 'signedIn' && !auth.profile)) return <p className="small">{t('auth.loading')}</p>;
  if (!auth.isAdmin) return <Navigate to="/" replace />;

  // Admin accounts stay in the table (marked) so the teacher can see their own test data; counts and exports skip them.
  const participants = rows ?? [];
  const students = participants.filter((r) => r.role !== 'admin');
  const weekIds = levels.flatMap((l) => l.weeks.map((w) => ({ id: w.id, label: `${l.id} W${w.week}`, title: w.title })));

  async function setLevels(r: Row, next: string[] | null) {
    if (!supabase) return;
    const { error: e } = await supabase.from('profiles').update({ levels: next }).eq('user_id', r.user_id);
    if (e) setError(e.message); else void load();
  }
  async function addDomain(d: string) { if (!supabase || !d) return; const { error: e } = await supabase.from('allowed_domains').insert({ domain: d.toLowerCase() }); if (e) setError(e.message); else void load(); }
  async function removeDomain(d: string) { if (!supabase) return; const { error: e } = await supabase.from('allowed_domains').delete().eq('domain', d); if (e) setError(e.message); else void load(); }
  async function updateCode(code: string, patch: { max_uses?: number; expires_at?: string | null; note?: string }) {
    if (!supabase) return;
    const { error: e } = await supabase.from('invite_codes').update(patch).eq('code', code);
    if (e) setError(e.message); else void load();
  }
  async function deleteCode(code: string) {
    if (!supabase) return;
    const { error: e } = await supabase.from('invite_codes').delete().eq('code', code);
    if (e) setError(e.message); else void load();
  }
  async function createCode(input: { code: string; levels: string[] | null; max_uses: number; expires_at: string | null; note: string }) {
    if (!supabase) return;
    const { error: e } = await supabase.from('invite_codes').insert({ ...input, created_by: auth.profile?.user_id });
    if (e) setError(e.message); else void load();
  }
  async function exportEvents(withEmail: boolean) {
    if (!supabase) return;
    const emailOf = new Map(students.map((r) => [r.user_id, `${r.display_name ?? ''} <${r.email}>`]));
    const viaOf = new Map(students.map((r) => [r.user_id, r.invite_code ?? 'domain']));
    const all: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error: e } = await supabase.from('events').select('user_id,code,type,week_id,payload,created_at').order('created_at').range(from, from + 999);
      if (e) { setError(e.message); return; }
      all.push(...(data as Record<string, unknown>[]));
      if (!data || data.length < 1000) break;
    }
    const head = [withEmail ? 'email' : null, 'code', 'via', 'type', 'week', 'payload', 'at'].filter((h): h is string => h !== null);
    const body = all.map((e) => [withEmail ? emailOf.get(String(e.user_id)) ?? '' : null, e.code as string, viaOf.get(String(e.user_id)) ?? '', e.type as string, e.week_id as string, JSON.stringify(e.payload), e.created_at as string].filter((_, i) => withEmail || i !== 0));
    download(`events-${withEmail ? 'with-email-' : ''}${new Date().toISOString().slice(0, 10)}.csv`, csv([head, ...body]));
  }
  function exportParticipants(withEmail: boolean) {
    const head = [withEmail ? 'name' : null, withEmail ? 'email' : null, 'code', 'via', 'consent_at', 'withdrawn_at', 'levels', 'active_minutes', 'events', 'last_active'].filter((h): h is string => h !== null);
    const body = students.map((r) => [withEmail ? r.display_name : null, withEmail ? r.email : null, r.code, r.invite_code ?? 'domain', r.consent_at, r.withdrawn_at, (r.levels ?? []).join(' '), r.active_minutes, r.events_n, r.last_active].filter((_, i) => withEmail || i > 1));
    download(`participants-${withEmail ? 'with-email-' : ''}${new Date().toISOString().slice(0, 10)}.csv`, csv([head, ...body]));
  }

  return (
    <div className={s.page}>
      <h1>{t('admin.title')}</h1>
      <div className={s.tabs} role="tablist">
        {(['participants', 'weeks', 'feedback', 'access', 'export'] as Tab[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={s.tab} onClick={() => setTab(k)}>{t(`admin.tab.${k}`)}</button>
        ))}
      </div>
      {error && <p role="alert" className={s.error}>{error}</p>}
      {!rows ? <p className="small">{t('auth.loading')}</p> : (
        <>
          {tab === 'participants' && (
            <section className={s.section}>
              <div className={s.toolbar}>
                <span className="small">{t('admin.count', { n: students.length, consented: students.filter((r) => r.consent_at && !r.withdrawn_at).length })}</span>
                <label className={s.check}><input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} /> {t('admin.showEmail')}</label>
              </div>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th>{t('admin.col.code')}</th>{showEmail && <><th>{t('admin.col.name')}</th><th>{t('admin.col.email')}</th></>}<th>{t('admin.col.consent')}</th><th>{t('admin.col.via')}</th><th>{t('admin.col.levels')}</th><th>{t('admin.col.minutes')}</th><th>{t('admin.col.lastActive')}</th><th /></tr></thead>
                  <tbody>
                    {participants.map((r) => (
                      <Fragment key={r.user_id}>
                        <tr>
                          <td className={s.code}>{r.code ?? '–'}{r.role === 'admin' && <span className={s.badge}>{t('admin.adminBadge')}</span>}</td>
                          {showEmail && <><td>{r.display_name ?? '–'}</td><td>{r.email}</td></>}
                          <td>{r.withdrawn_at ? t('admin.withdrawn') : r.consent_at ? fmt(r.consent_at) : t('admin.noConsent')}</td>
                          <td className={s.code}>{r.invite_code ?? t('admin.viaDomain')}</td>
                          <td>
                            {levels.map((l) => {
                              const on = !r.levels || r.levels.includes(l.id);
                              return <label key={l.id} className={s.check}><input type="checkbox" checked={on} onChange={(e) => {
                                const cur = r.levels ?? levels.map((x) => x.id);
                                const next = e.target.checked ? [...new Set([...cur, l.id])] : cur.filter((x) => x !== l.id);
                                void setLevels(r, next.length === levels.length ? null : next);
                              }} /> {l.id}</label>;
                            })}
                          </td>
                          <td>{r.active_minutes}</td>
                          <td>{fmt(r.last_active)}</td>
                          <td><button type="button" className={s.linkBtn} onClick={() => setOpen(open === r.user_id ? null : r.user_id)}>{open === r.user_id ? t('admin.hide') : t('admin.weeksDetail')}</button></td>
                        </tr>
                        {open === r.user_id && (
                          <tr><td colSpan={showEmail ? 9 : 7}>
                            <ul className={s.weekList}>
                              {weekIds.filter((w) => r.weeks[w.id]).map((w) => { const d = r.weeks[w.id]!; return (
                                <li key={w.id}><strong>{w.label}</strong> · {(d.tabs ?? []).filter(Boolean).join(', ') || '–'} · {d.minutes} min · {d.plays} {t('admin.plays')}{d.quiz ? ` · ${t('admin.quiz')} ${d.quiz.score}/${d.quiz.total}` : ''}</li>
                              ); })}
                              {Object.keys(r.weeks).length === 0 && <li className="small">{t('admin.noActivity')}</li>}
                            </ul>
                          </td></tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'weeks' && (
            <section className={s.section}>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th>{t('admin.col.week')}</th><th>{t('admin.col.opened')}</th><th>{t('admin.col.avgMinutes')}</th><th>{t('admin.col.avgQuiz')}</th></tr></thead>
                  <tbody>
                    {weekIds.map((w) => {
                      const ds = students.map((r) => r.weeks[w.id]).filter((d): d is NonNullable<typeof d> => Boolean(d));
                      const quiz = ds.map((d) => d.quiz).filter((q): q is { score: number; total: number } => Boolean(q && q.total));
                      const avgMin = ds.length ? (ds.reduce((a, d) => a + d.minutes, 0) / ds.length).toFixed(1) : '–';
                      const avgQuiz = quiz.length ? `${Math.round((quiz.reduce((a, q) => a + q.score / q.total, 0) / quiz.length) * 100)}%` : '–';
                      return <tr key={w.id}><td><strong>{w.label}</strong> <span className="small">{w.title}</span></td><td>{ds.length}</td><td>{avgMin}</td><td>{avgQuiz}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'feedback' && (
            <section className={s.section}>
              {(feedback ?? []).length === 0 ? <p className="small">{t('admin.noFeedback')}</p> : (feedback ?? []).map((f) => (
                <article key={f.id} className={s.card}>
                  <div className={s.meta}><span className={s.code}>{f.code ?? '–'}</span> · {t(`feedback.kind.${f.kind}`)} · {fmt(f.created_at)}{f.page && <> · <a href={f.page}>{f.page.replace(/^https?:\/\/[^/]+/, '')}</a></>}</div>
                  <p className={s.message}>{f.message}</p>
                </article>
              ))}
            </section>
          )}

          {tab === 'access' && <Access domains={domains ?? []} codes={codes ?? []} onAddDomain={addDomain} onRemoveDomain={removeDomain} onCreateCode={createCode} onUpdateCode={updateCode} onDeleteCode={deleteCode} />}

          {tab === 'export' && (
            <section className={s.section}>
              <p className="small">{t('admin.exportHint')}</p>
              <ExportRow label={t('admin.exportParticipants')} onExport={exportParticipants} />
              <ExportRow label={t('admin.exportEvents')} onExport={(withEmail) => void exportEvents(withEmail)} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ExportRow({ label, onExport }: { label: string; onExport(withEmail: boolean): void }) {
  const [withEmail, setWithEmail] = useState(false);
  return (
    <div className={s.toolbar}>
      <button type="button" className={s.button} onClick={() => onExport(withEmail)}>{label}</button>
      <label className={s.check}><input type="checkbox" checked={withEmail} onChange={(e) => setWithEmail(e.target.checked)} /> {t('admin.includeEmail')}</label>
    </div>
  );
}

function Access({ domains, codes, onAddDomain, onRemoveDomain, onCreateCode, onUpdateCode, onDeleteCode }: {
  domains: string[]; codes: CodeRow[];
  onAddDomain(d: string): Promise<void>; onRemoveDomain(d: string): Promise<void>;
  onUpdateCode(code: string, patch: { max_uses?: number; expires_at?: string | null; note?: string }): Promise<void>;
  onDeleteCode(code: string): Promise<void>;
  onCreateCode(i: { code: string; levels: string[] | null; max_uses: number; expires_at: string | null; note: string }): Promise<void>;
}) {
  const [domain, setDomain] = useState('');
  const [code, setCode] = useState(randomCode);
  const [codeLevels, setCodeLevels] = useState<string[]>(levels.map((l) => l.id));
  const [maxUses, setMaxUses] = useState('5');
  const [expires, setExpires] = useState('');
  const [note, setNote] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const hint = useMemo(() => (course.auth?.allowed_domains ?? []).filter((d) => !domains.includes(d.toLowerCase())), [domains]);
  return (
    <section className={s.section}>
      <h2>{t('admin.domains')}</h2>
      <p className="small">{t('admin.domainsHint')}</p>
      <ul className={s.chips}>{domains.map((d) => <li key={d} className={s.chip}>{d} <button type="button" className={s.chipX} aria-label={t('admin.remove')} onClick={() => void onRemoveDomain(d)}>×</button></li>)}</ul>
      {hint.length > 0 && <p className={s.warn}>{t('admin.domainsMismatch', { list: hint.join(', ') })}</p>}
      <div className={s.toolbar}>
        <input className={s.input} value={domain} onChange={(e) => setDomain(e.target.value.trim())} placeholder="example.ac.uk" />
        <button type="button" className={s.button} disabled={!domain.includes('.')} onClick={() => { void onAddDomain(domain); setDomain(''); }}>{t('admin.addDomain')}</button>
      </div>

      <h2>{t('admin.codes')}</h2>
      <p className="small">{t('admin.codesHint')}</p>
      <div className={s.form}>
        <label className={s.field}><span>{t('admin.code')}</span><input className={s.input} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></label>
        <div className={s.field}><span>{t('admin.col.levels')}</span><div>{levels.map((l) => <label key={l.id} className={s.check}><input type="checkbox" checked={codeLevels.includes(l.id)} onChange={(e) => setCodeLevels(e.target.checked ? [...codeLevels, l.id] : codeLevels.filter((x) => x !== l.id))} /> {l.id}</label>)}</div></div>
        <label className={s.field}><span>{t('admin.maxUses')}</span><input className={s.input} inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ''))} /></label>
        <label className={s.field}><span>{t('admin.expires')}</span><input className={s.input} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
        <label className={s.field}><span>{t('admin.note')}</span><input className={s.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('admin.notePlaceholder')} /></label>
        <button type="button" className={s.button} disabled={code.length < 4 || !Number(maxUses) || codeLevels.length === 0} onClick={() => {
          void onCreateCode({ code, levels: codeLevels.length === levels.length ? null : codeLevels, max_uses: Number(maxUses), expires_at: expires ? new Date(expires + 'T23:59:59').toISOString() : null, note });
          setCode(randomCode()); setNote('');
        }}>{t('admin.createCode')}</button>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>{t('admin.code')}</th><th>{t('admin.col.levels')}</th><th>{t('admin.uses')}</th><th>{t('admin.expires')}</th><th>{t('admin.note')}</th><th /></tr></thead>
          <tbody>{codes.map((c) => {
            const expired = Boolean(c.expires_at && new Date(c.expires_at) < new Date()) || c.uses >= c.max_uses;
            return (
              <tr key={c.code} className={expired ? s.muted : undefined}>
                <td className={s.code}>{c.code}</td>
                <td>{(c.levels ?? levels.map((l) => l.id)).join(' ')}</td>
                <td>{c.uses} / <input className={s.inputSm} inputMode="numeric" defaultValue={c.max_uses} aria-label={t('admin.maxUses')} onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== c.max_uses) void onUpdateCode(c.code, { max_uses: v }); }} /></td>
                <td><input className={s.inputSm} type="date" defaultValue={c.expires_at ? c.expires_at.slice(0, 10) : ''} aria-label={t('admin.expires')} onChange={(e) => void onUpdateCode(c.code, { expires_at: e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : null })} /></td>
                <td><input className={s.inputSm} defaultValue={c.note ?? ''} aria-label={t('admin.note')} onBlur={(e) => { if (e.target.value !== (c.note ?? '')) void onUpdateCode(c.code, { note: e.target.value }); }} /></td>
                <td className={s.actionsCell}>
                  {expired ? <span className={s.badge}>{t('admin.codeOff')}</span> : <button type="button" className={s.linkBtn} onClick={() => void onUpdateCode(c.code, { expires_at: new Date().toISOString() })}>{t('admin.disable')}</button>}
                  {c.uses === 0 && (confirmDel === c.code
                    ? <><button type="button" className={s.dangerBtn} onClick={() => { setConfirmDel(null); void onDeleteCode(c.code); }}>{t('admin.deleteConfirm')}</button> <button type="button" className={s.linkBtn} onClick={() => setConfirmDel(null)}>{t('feedback.cancel')}</button></>
                    : <button type="button" className={s.linkBtn} onClick={() => setConfirmDel(c.code)}>{t('admin.delete')}</button>)}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </section>
  );
}
