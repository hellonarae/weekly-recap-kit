import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { zipSync, strToU8 } from 'fflate';
import type { VocabEntry } from '@/content/types';

/**
 * Builds an Anki .apkg entirely in the browser: a zip holding collection.anki2 (SQLite, legacy
 * schema v11 — the one every Anki client still imports), a `media` JSON map and the media files
 * numbered 0..n. No server, no API. Shape follows genanki's output.
 */
export interface AnkiCardInput {
  entry: VocabEntry;
  /** Image bytes + file name, already resolved (flag svg, icon svg, photo). */
  image?: { name: string; data: Uint8Array };
  /** Audio bytes + file name when build-time audio exists. */
  audio?: { name: string; data: Uint8Array };
}

export interface AnkiSentenceInput {
  tl: string;
  en: string;
  /** e.g. the grammar pattern the example belongs to */
  note?: string;
  audio?: { name: string; data: Uint8Array };
}

export interface AnkiDeckInput {
  deckName: string; // "<app.name>::<level label>::Week 4"
  cards: AnkiCardInput[];
  /** Optional grammar-example cards (second note type in the same deck). */
  sentences?: AnkiSentenceInput[];
  cardImage: 'front' | 'back' | 'off';
  targetFont: string;
}

const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);`;

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function guid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';
  let out = '';
  const r = crypto.getRandomValues(new Uint8Array(10));
  for (const b of r) out += chars[b % chars.length];
  return out;
}

export async function buildApkg(input: AnkiDeckInput): Promise<Uint8Array> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database();
  db.run(SCHEMA);

  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  // Stable ids per deck name so re-exporting updates the same deck/model instead of duplicating.
  const did = 1700000000000 + (hash32(input.deckName) % 100000000);
  const mid = 1700000000000 + (hash32(`${input.deckName}|model`) % 100000000);
  const smid = 1700000000000 + (hash32(`${input.deckName}|sentences`) % 100000000);

  const imgFront = input.cardImage === 'front' ? '<div class="img">{{Image}}</div>' : '';
  const imgBack = input.cardImage === 'back' ? '<div class="img">{{Image}}</div>' : '';
  const model = {
    id: mid, name: `${input.deckName} (vocab)`, type: 0, mod: nowSec, usn: -1, sortf: 0, did,
    tmpls: [{
      name: 'Word → Meaning', ord: 0,
      qfmt: `<div class="tl">{{Word}}</div>{{Audio}}${imgFront}`,
      afmt: `{{FrontSide}}<hr id=answer><div class="en">{{Meaning}}</div>${imgBack}{{#Note}}<div class="note">{{Note}}</div>{{/Note}}<div class="cat">{{Category}}</div>`,
      bqfmt: '', bafmt: '', did: null,
    }],
    flds: ['Word', 'Meaning', 'Note', 'Category', 'Image', 'Audio'].map((name, ord) => ({ name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] })),
    css: `.card { font-family: ${input.targetFont}, "Pretendard", sans-serif; text-align: center; color: #231A33; background: #FBF9FD; }
.tl { font-size: 40px; margin: 24px 0 12px; } .en { font-size: 24px; margin-top: 12px; } .img img, .img svg { max-width: 160px; max-height: 120px; margin: 12px auto; display: block; }
.note { color: #5A4E6E; font-size: 16px; margin-top: 8px; } .cat { color: #8C819E; font-size: 13px; margin-top: 16px; }`,
    latexPre: '', latexPost: '', req: [[0, 'all', [0]]], tags: [], vers: [],
  };
  const sentenceModel = {
    id: smid, name: `${input.deckName} (sentences)`, type: 0, mod: nowSec, usn: -1, sortf: 0, did,
    tmpls: [{ name: 'Sentence → Meaning', ord: 0, qfmt: '<div class="tl sent">{{Sentence}}</div>{{Audio}}', afmt: '{{FrontSide}}<hr id=answer><div class="en">{{Meaning}}</div>{{#Pattern}}<div class="cat">{{Pattern}}</div>{{/Pattern}}', bqfmt: '', bafmt: '', did: null }],
    flds: ['Sentence', 'Meaning', 'Pattern', 'Audio'].map((name, ord) => ({ name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] })),
    css: model.css + ' .sent { font-size: 28px; line-height: 40px; }', latexPre: '', latexPost: '', req: [[0, 'all', [0]]], tags: [], vers: [],
  };
  const deck = { id: did, name: input.deckName, desc: '', extendRev: 50, usn: 0, collapsed: false, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0], dyn: 0, extendNew: 10, conf: 1, mod: nowSec };
  const defaultDeck = { ...deck, id: 1, name: 'Default' };
  const dconf = { 1: { id: 1, name: 'Default', new: { delays: [1, 10], ints: [1, 4, 7], initialFactor: 2500, separate: true, order: 1, perDay: 20, bury: true }, lapse: { delays: [10], mult: 0, minInt: 1, leechFails: 8, leechAction: 0 }, rev: { perDay: 200, ease4: 1.3, fuzz: 0.05, minSpace: 1, ivlFct: 1, maxIvl: 36500, bury: true }, maxTaken: 60, timer: 0, autoplay: true, replayq: true, mod: 0, usn: 0 } };
  const conf = { nextPos: 1, estTimes: true, activeDecks: [1], sortType: 'noteFld', timeLim: 0, sortBackwards: false, addToCur: true, curDeck: 1, newBury: true, newSpread: 0, dueCounts: true, curModel: mid, collapseTime: 1200 };
  db.run('INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)', [
    nowSec, now, now, JSON.stringify(conf), JSON.stringify(input.sentences?.length ? { [mid]: model, [smid]: sentenceModel } : { [mid]: model }), JSON.stringify({ 1: defaultDeck, [did]: deck }), JSON.stringify(dconf), '{}',
  ]);

  const media: Record<string, string> = {};
  const files: Record<string, Uint8Array> = {};
  let mediaIdx = 0;
  const addMedia = (name: string, data: Uint8Array): string => {
    media[String(mediaIdx)] = name;
    files[String(mediaIdx)] = data;
    mediaIdx++;
    return name;
  };

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let i = 0;
  for (const c of input.cards) {
    const e = c.entry;
    const imageField = c.image ? `<img src="${addMedia(c.image.name, c.image.data)}">` : '';
    const audioField = c.audio ? `[sound:${addMedia(c.audio.name, c.audio.data)}]` : '';
    const flds = [esc(e.tl), esc(e.en), esc(e.note ?? ''), esc(e.cat ?? ''), imageField, audioField];
    const nid = now + i;
    const csum = parseInt((await sha1Hex(flds[0]!)).slice(0, 8), 16);
    db.run('INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, ?)', [nid, guid(), mid, nowSec, ' ', flds.join('\u001f'), flds[0]!, csum, '']);
    db.run('INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, ?)', [nid + 100000, nid, did, nowSec, i + 1, '']);
    i++;
  }

  for (const sent of input.sentences ?? []) {
    const audioField = sent.audio ? `[sound:${addMedia(sent.audio.name, sent.audio.data)}]` : '';
    const flds = [esc(sent.tl), esc(sent.en), esc(sent.note ?? ''), audioField];
    const nid = now + i;
    const csum = parseInt((await sha1Hex(flds[0]!)).slice(0, 8), 16);
    db.run('INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, ?)', [nid, guid(), smid, nowSec, ' ', flds.join('\u001f'), flds[0]!, csum, '']);
    db.run('INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, ?)', [nid + 100000, nid, did, nowSec, i + 1, '']);
    i++;
  }

  const dbBytes = db.export();
  db.close();
  return zipSync({ 'collection.anki2': dbBytes, media: strToU8(JSON.stringify(media)), ...files }, { level: 6 });
}

export function buildTsv(entries: VocabEntry[]): string {
  const clean = (s: string) => s.replace(/[\t\n]/g, ' ');
  return entries.map((e) => [clean(e.tl), clean(e.en), clean(e.cat ?? ''), clean(e.note ?? '')].join('\t')).join('\n') + '\n';
}

export function download(name: string, data: Uint8Array | string, type: string): void {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
