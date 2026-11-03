import fs from 'node:fs';
import { parseDocument, type Document, isNode, isPair, LineCounter } from 'yaml';
import type { ZodError, ZodTypeAny, z } from 'zod';
import type { Issues } from './issues';

export interface LoadedYaml<T> {
  data: T | null;
  doc: Document | null;
  /** 1-based line of a path like ["units", 0, "entries", 3, "tl"]; undefined when unknown */
  lineOf: (path: (string | number)[]) => number | undefined;
}

/** Parse + validate a YAML file against a zod schema, reporting every problem with a line number. */
export function loadYaml<S extends ZodTypeAny>(file: string, rel: string, schema: S, issues: Issues): LoadedYaml<z.infer<S>> {
  const none: LoadedYaml<z.infer<S>> = { data: null, doc: null, lineOf: () => undefined };
  if (!fs.existsSync(file)) {
    issues.error(rel, 'file not found');
    return none;
  }
  const src = fs.readFileSync(file, 'utf8');
  const lc = new LineCounter();
  const doc = parseDocument(src, { lineCounter: lc, keepSourceTokens: true });
  if (doc.errors.length) {
    for (const e of doc.errors) issues.error(rel, `YAML: ${e.message.split('\n')[0]}`, e.linePos?.[0]?.line);
    return none;
  }
  const lineOf = (path: (string | number)[]): number | undefined => {
    // Walk down manually so we can fall back to the nearest known ancestor.
    let node: unknown = doc.contents;
    let best: number | undefined;
    const posOf = (n: unknown): number | undefined =>
      isNode(n) && n.range ? lc.linePos(n.range[0]).line : undefined;
    best = posOf(node);
    for (const key of path) {
      if (!isNode(node) || !('items' in node)) break;
      const items = (node as { items: unknown[] }).items;
      let next: unknown;
      if (typeof key === 'number') next = items[key];
      else next = items.find((p) => isPair(p) && isNode(p.key) && String((p.key as { value: unknown }).value) === key);
      if (next === undefined) break;
      const value = isPair(next) ? next.value : next;
      best = posOf(value) ?? best;
      node = value;
    }
    return best;
  };
  const parsed = schema.safeParse(doc.toJS());
  if (!parsed.success) {
    for (const e of (parsed.error as ZodError).errors) {
      const p = e.path.map((k) => (typeof k === 'number' ? `[${k}]` : k)).join('.').replace(/\.\[/g, '[');
      issues.error(rel, `${p || '(root)'}: ${e.message}`, lineOf(e.path));
    }
    return { data: null, doc, lineOf };
  }
  return { data: parsed.data, doc, lineOf };
}
