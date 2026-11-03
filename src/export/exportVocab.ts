import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { icons } from '@/generated/icons';
import { course } from '@/config/course';
import type { VocabEntry } from '@/content/types';
import type { VocabSource } from '@/components/vocab/VocabTab';
import { imageSource } from '@/components/vocab/VocabImage';
import { buildApkg, buildTsv, download, type AnkiCardInput, type AnkiSentenceInput } from './anki';

async function fetchBytes(url: string): Promise<Uint8Array | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return new Uint8Array(await res.arrayBuffer());
  } catch { return undefined; }
}

function safeName(s: string): string {
  return s.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60);
}

/** Resolves each entry's image (flag svg, lucide icon svg, teacher file) and audio (if built) to bytes. */
async function toCards(entries: VocabEntry[], level: string, audioUrl: (e: VocabEntry) => string | undefined): Promise<AnkiCardInput[]> {
  const out: AnkiCardInput[] = [];
  for (const entry of entries) {
    const card: AnkiCardInput = { entry };
    const src = imageSource(entry, level);
    if (src?.kind === 'url') {
      const data = await fetchBytes(src.url);
      if (data) card.image = { name: `recap_${safeName(entry.img ?? '')}${src.url.slice(src.url.lastIndexOf('.'))}`, data };
    } else if (src?.kind === 'color') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72"><rect width="96" height="72" rx="8" fill="${src.hex}" stroke="rgba(0,0,0,0.15)"/></svg>`;
      card.image = { name: `recap_color_${src.hex.slice(1)}.svg`, data: new TextEncoder().encode(svg) };
    } else if (src?.kind === 'icon') {
      const Icon = icons[src.name];
      if (Icon) {
        const svg = renderToStaticMarkup(createElement(Icon, { size: 96, strokeWidth: 1.5, color: course.app.theme.primary, xmlns: 'http://www.w3.org/2000/svg' }));
        card.image = { name: `recap_icon_${src.name}.svg`, data: new TextEncoder().encode(svg) };
      }
    }
    const a = audioUrl(entry);
    if (a) {
      const data = await fetchBytes(a);
      if (data) card.audio = { name: `recap_${level}_${safeName(entry.tl)}.mp3`, data };
    }
    out.push(card);
  }
  return out;
}

export interface SentenceSource { tl: string; en: string; note?: string; audioUrl?: string }

export async function exportVocab(src: VocabSource, audioUrl: (e: VocabEntry) => string | undefined, sentences: SentenceSource[] = []): Promise<void> {
  const base = `${course.app.name}::${src.levelLabel}::${src.title}`;
  const file = `${safeName(course.app.short_name)}_${src.level}_${src.fileStem}`;
  if (course.vocab.anki_export === 'tsv') {
    download(`${file}.txt`, buildTsv(src.entries), 'text/tab-separated-values');
    return;
  }
  const cards = await toCards(src.entries, src.level, audioUrl);
  const sents: AnkiSentenceInput[] = [];
  for (const sn of sentences) {
    const item: AnkiSentenceInput = { tl: sn.tl, en: sn.en, note: sn.note };
    if (sn.audioUrl) { const data = await fetchBytes(sn.audioUrl); if (data) item.audio = { name: `recap_${src.level}_${safeName(sn.tl)}.mp3`, data }; }
    sents.push(item);
  }
  const apkg = await buildApkg({ deckName: base, cards, sentences: sents, cardImage: course.vocab.card_image, targetFont: 'Pretendard Variable' });
  download(`${file}.apkg`, apkg, 'application/octet-stream');
}
