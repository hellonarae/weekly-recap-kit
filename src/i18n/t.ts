import en from './en.json';

type Dict = Record<string, string>;
const dict: Dict = en;

/** UI strings only. Content (vocab, grammar…) comes from content.json, never from here. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dict[key];
  if (s === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
