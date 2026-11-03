// Resolves vocabulary entries with img: photo via the Openverse API (CC-licensed images, no key needed).
// Downloads the image into levels/<L>/images/ and records attribution in levels/<L>/images/index.json.
// build-content then serves `photo` entries as file:<name>. Idempotent; never runs at runtime.
//   npm run images            # fetch missing
//   npm run images -- --dry   # list what would be fetched
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/args';
import { buildContent } from './lib/build';

interface Credit { tl: string; en: string; file: string; title?: string; creator?: string; license: string; license_url?: string; source_url?: string }
interface OvResult { id: string; title?: string; creator?: string; license: string; license_version?: string; license_url?: string; foreign_landing_url?: string; url: string; thumbnail?: string; width?: number; height?: number }

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const dry = argv.includes('--dry');
const { bundle, issues } = buildContent({ ...args, outDir: path.join(args.root, 'src/generated') });
if (!bundle || issues.errors.length) { console.error('content has errors; run npm run validate'); process.exit(1); }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

async function search(q: string): Promise<OvResult | undefined> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial,modification&mature=false&page_size=8&aspect_ratio=wide,square`;
  const res = await fetch(url, { headers: { 'User-Agent': 'weekly-recap-kit (build script)' } });
  if (!res.ok) throw new Error(`openverse ${res.status}`);
  const data = (await res.json()) as { results: OvResult[] };
  // Prefer CC0 / PDM / CC BY, then anything with a usable file.
  const order = ['cc0', 'pdm', 'by', 'by-sa'];
  return [...data.results].sort((a, b) => (order.indexOf(a.license) + 1 || 9) - (order.indexOf(b.license) + 1 || 9)).find((r) => r.url);
}

(async () => {
  let fetched = 0, skipped = 0, failed = 0;
  for (const level of bundle.levels) {
    const lc = bundle.course.levels.find((l) => l.id === level.id)!;
    const levelDir = path.join(args.levelsDir, lc.vocab ? lc.vocab.split('/')[1] ?? level.id : level.id);
    const imgDir = path.join(levelDir, 'images');
    const indexFile = path.join(imgDir, 'index.json');
    const credits: Credit[] = fs.existsSync(indexFile) ? (JSON.parse(fs.readFileSync(indexFile, 'utf8')) as { credits: Credit[] }).credits : [];
    const have = new Map(credits.map((c) => [c.tl, c]));
    const entries = [...level.units.flatMap((u) => u.entries), ...level.weeks.flatMap((w) => w.vocab)].filter((e) => e.img === 'photo');
    for (const e of entries) {
      if (have.has(e.tl) && fs.existsSync(path.join(imgDir, have.get(e.tl)!.file))) { skipped++; continue; }
      const q = e.en.replace(/\(.*?\)/g, '').split(/[,;]/)[0]!.trim();
      if (dry) { console.log(`  would fetch ${level.id} "${e.tl}" ← "${q}"`); fetched++; continue; }
      try {
        const r = await search(q);
        if (!r) { console.log(`  ✗ ${level.id} "${e.tl}": no result for "${q}"`); failed++; continue; }
        const img = await fetch(r.thumbnail ?? r.url);
        if (!img.ok) throw new Error(`download ${img.status}`);
        const ext = (img.headers.get('content-type') ?? '').includes('png') ? 'png' : 'jpg';
        const file = `${slug(q) || 'photo'}-${r.id.slice(0, 8)}.${ext}`;
        fs.mkdirSync(imgDir, { recursive: true });
        fs.writeFileSync(path.join(imgDir, file), new Uint8Array(await img.arrayBuffer()));
        const credit: Credit = { tl: e.tl, en: e.en, file, title: r.title, creator: r.creator, license: `${r.license}${r.license_version ? ' ' + r.license_version : ''}`, license_url: r.license_url, source_url: r.foreign_landing_url };
        credits.push(credit); have.set(e.tl, credit);
        console.log(`  + ${level.id} "${e.tl}" ← ${file} (${credit.license}${r.creator ? ', ' + r.creator : ''})`);
        fetched++;
        await new Promise((res) => setTimeout(res, 400));
      } catch (err) { console.log(`  ✗ ${level.id} "${e.tl}": ${(err as Error).message}`); failed++; }
    }
    if (credits.length && !dry) { fs.mkdirSync(imgDir, { recursive: true }); fs.writeFileSync(indexFile, JSON.stringify({ credits }, null, 1)); }
  }
  console.log(`\nimages: ${dry ? 'would fetch' : 'fetched'} ${fetched}, already had ${skipped}, failed ${failed}`);
  if (fetched && !dry) console.log('Run npm run content so the new files are served; attribution is in levels/<L>/images/index.json.');
})();
