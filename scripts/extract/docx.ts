import { readOfficeXml, runs, blocks } from './zipxml';

export interface DocxBlock { kind: 'p' | 'row'; style?: string; text: string; cells?: string[] }

/** Paragraphs and table rows in document order. Headings keep their style name (Heading1…). */
export function extractDocx(file: string): DocxBlock[] {
  const xml = readOfficeXml(file, (n) => n === 'word/document.xml').get('word/document.xml') ?? '';
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? '';
  const out: DocxBlock[] = [];
  // Walk top-level: tables and paragraphs interleave; a regex over both keeps order.
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;
  for (const m of body.matchAll(re)) {
    const chunk = m[0];
    if (chunk.startsWith('<w:tbl>')) {
      for (const tr of blocks(chunk, 'w:tr')) {
        const cells = blocks(tr, 'w:tc').map((tc) => blocks(tc, 'w:p').map((p) => runs(p, 'w:t')).join(' / ').replace(/\s+/g, ' ').trim());
        if (cells.some(Boolean)) out.push({ kind: 'row', text: cells.join(' | '), cells });
      }
    } else {
      const style = /<w:pStyle w:val="([^"]+)"/.exec(chunk)?.[1];
      const text = runs(chunk, 'w:t').replace(/\s+/g, ' ').trim();
      if (text) out.push({ kind: 'p', style, text });
    }
  }
  return out;
}
