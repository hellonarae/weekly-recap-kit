import { readOfficeXml, runs, blocks } from './zipxml';

export interface Page { page: number; text: string }

/** Slide text in slide order; one line per paragraph, tables flattened as "cell | cell". Notes are skipped. */
export function extractPptx(file: string): Page[] {
  const slides = readOfficeXml(file, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const order = [...slides.keys()].sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]));
  return order.map((name, i) => {
    const xml = slides.get(name)!;
    const lines: string[] = [];
    // Tables: keep row structure so vocab-like slides stay readable.
    const tables = blocks(xml, 'a:tbl');
    for (const t of tables) for (const tr of blocks(t, 'a:tr')) {
      const cells = blocks(tr, 'a:tc').map((tc) => blocks(tc, 'a:p').map((p) => runs(p, 'a:t')).join(' ').trim());
      if (cells.some(Boolean)) lines.push(cells.join(' | '));
    }
    const noTables = xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g, '');
    for (const p of blocks(noTables, 'a:p')) {
      const t = runs(p, 'a:t').replace(/\s+/g, ' ').trim();
      if (t) lines.push(t);
    }
    return { page: i + 1, text: lines.join('\n') };
  });
}
