import fs from 'node:fs';
import path from 'node:path';
import type { ContentBundle, Level, Week } from '../../src/content/types';
import { Issues } from './issues';
import { loadCourse } from './config';
import { loadVocab } from './vocab';
import { loadWeekMeta } from './week';
import { loadGrammar } from './grammar';
import { loadDialogues } from './dialogue';
import { loadQuiz } from './quiz';
import type { BuildArgs } from './args';

export interface BuildResult {
  bundle: ContentBundle | null;
  issues: Issues;
}

/** Reads course.yml + levels/** and returns the content bundle plus every validation issue. */
export function buildContent(args: BuildArgs): BuildResult {
  const issues = new Issues();
  const course = loadCourse(args.coursePath, args.root, issues);
  if (!course) return { bundle: null, issues };
  const lang = course.app.target_language;
  const speakers = Object.keys(course.speakers);
  const levels: Level[] = [];

  for (const lc of course.levels) {
    // vocab path is relative to the repo root in course.yml; when --levels points elsewhere
    // (kit / fixtures) we map "levels/<X>" onto that directory.
    const levelDirName = lc.vocab ? lc.vocab.split('/')[1] ?? lc.id : lc.id;
    const levelDir = path.join(args.levelsDir, levelDirName);
    const relLevel = path.relative(args.root, levelDir);
    const units = lc.vocab ? loadVocab(path.join(levelDir, 'vocab.yml'), `${relLevel}/vocab.yml`, lang, lc.id, issues) : [];
    const photos = loadPhotoIndex(path.join(levelDir, 'images', 'index.json'));
    const resolvePhoto = (e: { tl: string; img?: string }, rel: string) => {
      if (e.img !== 'photo') return;
      const c = photos.get(e.tl);
      if (c && fs.existsSync(path.join(levelDir, 'images', c))) e.img = `file:${c}`;
      else { issues.warn(rel, `"${e.tl}": img: photo not fetched yet (run npm run images); shown without a picture`); delete e.img; }
    };
    for (const u of units) for (const e of u.entries) resolvePhoto(e, `${relLevel}/vocab.yml`);
    const weeks: Week[] = [];
    const seenIds = new Set<string>();

    const weeksDir = path.join(levelDir, 'weeks');
    const weekFolders = fs.existsSync(weeksDir)
      ? fs.readdirSync(weeksDir).filter((d) => /^week-\d+$/.test(d) && fs.statSync(path.join(weeksDir, d)).isDirectory()).sort()
      : [];
    for (const folder of weekFolders) {
      const dir = path.join(weeksDir, folder);
      const relDir = `${relLevel}/weeks/${folder}`;
      if (!fs.existsSync(path.join(dir, 'week.yml'))) continue; // source-only folder: not drafted yet
      const meta = loadWeekMeta(dir, relDir, lang, lc.id, units, issues);
      if (!meta) continue;
      const w = meta.week;
      for (const e of w.vocab) if (!e.unit) resolvePhoto(e, `${relDir}/week.yml`);
      const folderNum = Number(folder.slice(5));
      if (folderNum !== w.week) issues.error(`${relDir}/week.yml`, `week: ${w.week} but the folder is ${folder}`);
      const grammar = loadGrammar(path.join(dir, 'grammar.md'), `${relDir}/grammar.md`, w.id, issues);
      const dialogues = loadDialogues(path.join(dir, 'dialogue.md'), `${relDir}/dialogue.md`, w.id, speakers, issues);
      const quizFile = path.join(dir, 'quiz.yml');
      const quiz = fs.existsSync(quizFile)
        ? loadQuiz(quizFile, `${relDir}/quiz.yml`, { typingQuizzes: lc.typing_quizzes, seenIds, isRecap: w.units.length === 0 }, issues)
        : [];
      if (!fs.existsSync(quizFile)) issues.warn(relDir, 'no quiz.yml');
      const auto = w.auto.filter((a) => {
        if ((a === 'flashcards' || a === 'match_vocab') && w.vocab.length === 0) return false;
        if ((a === 'dialogue_order' || a === 'listen_choose') && dialogues.length === 0) return false;
        return true;
      });
      weeks.push({ ...w, auto, grammar, dialogues, quiz });
      for (const u of w.units) units.find((x) => x.id === u)?.weeks.push(w.id);
    }
    weeks.sort((a, b) => a.week - b.week);
    levels.push({ id: lc.id, label: lc.label, typing_quizzes: lc.typing_quizzes, units, weeks });
  }

  const bundle: ContentBundle = { builtAt: new Date().toISOString(), course, levels };
  // Guard: nothing from a source/ folder may reach the output.
  const json = JSON.stringify(bundle);
  if (/[\\/]source[\\/]/.test(json)) issues.error('content.json', 'output references a source/ path; source files must never be published');
  return { bundle, issues };
}

/** levels/<L>/images/index.json written by build-images.ts: tl → file */
function loadPhotoIndex(file: string): Map<string, string> {
  if (!fs.existsSync(file)) return new Map();
  try {
    const idx = JSON.parse(fs.readFileSync(file, 'utf8')) as { credits: { tl: string; file: string }[] };
    return new Map(idx.credits.map((c) => [c.tl, c.file]));
  } catch { return new Map(); }
}
