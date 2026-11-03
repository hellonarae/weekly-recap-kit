import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/args';
import { buildContent } from './lib/build';
import { printTable } from './lib/issues';
import { writeTokens } from './lib/tokens';
import { copyAssets, writeIconsModule, writePwaFiles } from './lib/assets';

const args = parseArgs(process.argv.slice(2));
const { bundle, issues } = buildContent(args);
printTable(issues.list);
const e = issues.errors.length;
const w = issues.warnings.length;
if (!bundle || e > 0) {
  console.error(`\n✗ content: ${e} error(s), ${w} warning(s). Nothing written.`);
  process.exit(1);
}
fs.mkdirSync(args.outDir, { recursive: true });
// Static assets the app serves: flags for img: flag:<cc>, teacher files for img: file:<name>,
// and any build-time audio (levels/**/audio). Everything lands under public/_img and public/_audio.
const assetIssues = [...copyAssets(bundle, args), ...writeIconsModule(bundle, args, args.outDir)];
writePwaFiles(bundle, args);
printTable(assetIssues);
if (assetIssues.some((i) => i.level === 'error')) process.exit(1);
fs.writeFileSync(path.join(args.outDir, 'content.json'), JSON.stringify(bundle));
fs.writeFileSync(path.join(args.outDir, 'tokens.css'), writeTokens(bundle.course.app.theme, bundle.course.app.script));
const weeks = bundle.levels.reduce((n, l) => n + l.weeks.length, 0);
console.log(`✓ content: ${bundle.levels.length} level(s), ${weeks} week(s), ${w} warning(s) → ${path.relative(args.root, args.outDir)}/`);
