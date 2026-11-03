import { icons } from '@/generated/icons';
import type { VocabEntry } from '@/content/types';
import s from './VocabImage.module.css';

const BASE = import.meta.env.BASE_URL;

/** Resolves img: flag:<cc> | icon:<name> | file:<name> | color:#rrggbb to a URL, a lucide component or a colour. `photo` is resolved at build time (Phase D) into file:. */
export function imageSource(entry: VocabEntry, level: string): { kind: 'url'; url: string } | { kind: 'icon'; name: string } | { kind: 'color'; hex: string } | null {
  if (!entry.img) return null;
  if (entry.img.startsWith('flag:')) return { kind: 'url', url: `${BASE}_img/flags/${entry.img.slice(5)}.svg` };
  if (entry.img.startsWith('file:')) return { kind: 'url', url: `${BASE}_img/${level}/${entry.img.slice(5)}` };
  if (entry.img.startsWith('icon:')) return { kind: 'icon', name: entry.img.slice(5) };
  if (entry.img.startsWith('color:')) return { kind: 'color', hex: entry.img.slice(6) };
  return null;
}

export function VocabImage({ entry, level, size = 56 }: { entry: VocabEntry; level: string; size?: number }) {
  const src = imageSource(entry, level);
  if (!src) return null;
  if (src.kind === 'url') return <img className={s.img} src={src.url} alt="" width={size} height={size * 0.75} loading="lazy" />;
  if (src.kind === 'color') return <span className={s.swatch} aria-hidden="true" style={{ width: size, height: size * 0.75, background: src.hex }} />;
  const Icon = icons[src.name]; // only icons the content uses are bundled (src/generated/icons.ts)
  if (!Icon) return null;
  return <span className={s.icon} aria-hidden="true"><Icon size={size * 0.7} strokeWidth={1.5} /></span>;
}
