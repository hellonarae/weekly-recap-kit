import fs from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

/** Office files (.docx/.pptx) are zips of XML. Returns the XML text of every entry matching `pick`. */
export function readOfficeXml(file: string, pick: (name: string) => boolean): Map<string, string> {
  const zip = unzipSync(new Uint8Array(fs.readFileSync(file)));
  const out = new Map<string, string>();
  for (const [name, bytes] of Object.entries(zip)) if (pick(name)) out.set(name, strFromU8(bytes));
  return out;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
export function decode(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m] ?? m).replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

/** Text of all `<tag>` runs inside `xml`, joined with nothing (runs) — caller splits by paragraph first. */
export function runs(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>|<${tag}(?:\\s[^>]*)?/>`, 'g');
  let out = '';
  for (const m of xml.matchAll(re)) out += decode(m[1] ?? '');
  return out;
}

export function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  return [...xml.matchAll(re)].map((m) => m[1] ?? '');
}
