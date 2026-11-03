import { parseArgs } from './lib/args';
import { buildContent } from './lib/build';
import { markdownTable, printTable } from './lib/issues';

const args = parseArgs(process.argv.slice(2));
const { bundle, issues } = buildContent(args);
const e = issues.errors.length;
const w = issues.warnings.length;
if (args.github) {
  const weeks = bundle?.levels.flatMap((l) => l.weeks.map((wk) => `| ${l.id} | ${wk.week} | ${wk.title} | ${wk.vocab.length} | ${wk.grammar.length} | ${wk.dialogues.length} | ${wk.quiz.length} |`)) ?? [];
  console.log(`## ${e === 0 ? '✅ Content valid' : '❌ Content has errors'} — ${e} error(s), ${w} warning(s)\n`);
  if (weeks.length) console.log(`| level | week | title | vocab | grammar | dialogues | quiz |\n|---|---|---|---|---|---|---|\n${weeks.join('\n')}\n`);
  if (issues.list.length) console.log(markdownTable(issues.list));
} else {
  printTable(issues.list);
  console.log(`\n${e === 0 ? '✓' : '✗'} validate: ${e} error(s), ${w} warning(s)`);
}
process.exit(e === 0 ? 0 : 1);
