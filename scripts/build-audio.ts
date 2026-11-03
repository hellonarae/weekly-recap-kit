// Build-time TTS (SPEC §8). For every dialogue line (+ grammar examples if audio.examples, + vocabulary if
// audio.vocab) make an mp3 with ElevenLabs unless the cache already has it. Idempotent: the second run makes
// zero API calls. Fails soft: lines without a voice or with an API error are reported and left to the device voice.
//   npm run audio            # generate missing
//   npm run audio -- --dry   # report what would be generated, no API calls
//   npm run audio -- --prune # also delete mp3s no longer referenced
// Spoken text: `{say: …}` on a line/example or `say:` on a vocab entry wins, then the language adapter in scripts/lib/speech/.
// Per-speaker `gain` (course.yml) is applied with ffmpeg; `audio.lead_in` is unspoken context for lone words.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from './lib/args';
import { buildContent } from './lib/build';
import { loadDotEnv } from './lib/env';
import { ElevenLabs, isPlaceholderVoice } from './lib/elevenlabs';
import type { CourseConfig } from '../src/content/types';
import { toSpeech } from './lib/speech';

interface Item { speaker?: string; text: string; voice: string | undefined; /** override for what is spoken */ say?: string; /** lone word: gets audio.lead_in as unspoken context */ lone?: boolean; /** per-line speed override */ speed?: number }
interface IndexItem { key: string; speaker?: string; text: string; file: string }

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const dry = argv.includes('--dry');
const prune = argv.includes('--prune');
loadDotEnv(args.root);

const { bundle, issues } = buildContent(args);
if (!bundle || issues.errors.length) { console.error('content has errors; run npm run validate'); process.exit(1); }
const course: CourseConfig = bundle.course;
const key = process.env.ELEVENLABS_API_KEY;
const api = key && course.audio.provider === 'elevenlabs' ? new ElevenLabs(key) : null;
const lang = course.app.target_language;
const model = course.audio.model;
const leadIn = course.audio.lead_in?.trim() || undefined;
const hasFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

/** Volume change after TTS (ElevenLabs has no gain setting): re-encode through ffmpeg's volume filter. */
function applyGain(mp3: Uint8Array, gain: number): Uint8Array {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recap-audio-'));
  const src = path.join(tmp, 'in.mp3'), dst = path.join(tmp, 'out.mp3');
  try {
    fs.writeFileSync(src, mp3);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-af', `volume=${gain}`, '-c:a', 'libmp3lame', '-b:a', '64k', dst], { stdio: 'inherit' });
    return new Uint8Array(fs.readFileSync(dst));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

const voiceOf = (speaker?: string): string | undefined => {
  const v = speaker ? course.speakers[speaker]?.voice : undefined;
  if (!isPlaceholderVoice(v)) return v;
  const first = Object.values(course.speakers).find((s) => !isPlaceholderVoice(s.voice));
  return speaker ? undefined : first?.voice; // named speaker without a voice → fallback; narrator → first configured voice
};
const settingsOf = (speaker?: string, speed?: number) => {
  const sp = speaker ? course.speakers[speaker] : undefined;
  return { speed: speed ?? sp?.speed, stability: sp?.stability, gain: sp?.gain };
};
/** Key covers everything that changes the sound: model, voice, settings, context and the spoken text.
 *  gain and lead-in are appended only when set, so items without them keep their existing keys (no regeneration). */
const hash = (voice: string, spoken: string, speaker?: string, context?: string, speed?: number) => {
  const st = settingsOf(speaker, speed);
  const extra = (st.gain ? `|gain=${st.gain}` : '') + (context ? `|lead=${context}` : '');
  return crypto.createHash('sha1').update(`${course.audio.provider}|${model}|${voice}|${st.speed ?? ''}|${st.stability ?? ''}|${spoken}${extra}`).digest('hex');
};

const summary = { generated: 0, cached: 0, noVoice: [] as string[], failed: [] as string[], chars: 0 };

async function processScope(dir: string, label: string, items: Item[]): Promise<void> {
  const indexFile = path.join(dir, 'index.json');
  const existing: IndexItem[] = fs.existsSync(indexFile) ? (JSON.parse(fs.readFileSync(indexFile, 'utf8')) as { items: IndexItem[] }).items : [];
  const byKey = new Map(existing.map((i) => [i.key, i]));
  const out: IndexItem[] = [];
  for (const it of items) {
    if (!it.voice) { summary.noVoice.push(`${label}: ${it.speaker ? it.speaker + ': ' : ''}${it.text}`); continue; }
    const spoken = toSpeech(it.say ?? it.text, lang);
    const context = it.lone ? leadIn : undefined;
    const st = settingsOf(it.speaker, it.speed);
    const k = hash(it.voice, spoken, it.speaker, context, it.speed);
    const file = `${k}.mp3`;
    if (byKey.has(k) && fs.existsSync(path.join(dir, file))) { summary.cached++; out.push({ key: k, speaker: it.speaker, text: it.text, file }); continue; }
    if (!api) { summary.noVoice.push(`${label}: (no API key) ${it.text}`); continue; }
    if (dry) { summary.generated++; summary.chars += it.text.length; out.push({ key: k, speaker: it.speaker, text: it.text, file }); continue; }
    if (st.gain && !hasFfmpeg) { summary.failed.push(`${label}: ${it.text} — speaker gain needs ffmpeg (brew install ffmpeg)`); continue; }
    try {
      let mp3 = await api.tts(it.voice, spoken, model, lang, { speed: st.speed, stability: st.stability }, context);
      if (st.gain && st.gain !== 1) mp3 = applyGain(mp3, st.gain);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, file), mp3);
      out.push({ key: k, speaker: it.speaker, text: it.text, file });
      summary.generated++; summary.chars += it.text.length;
      process.stdout.write(`  + ${label}: ${it.speaker ? it.speaker + ': ' : ''}${it.text}\n`);
      await new Promise((r) => setTimeout(r, 150));
    } catch (e) {
      summary.failed.push(`${label}: ${it.text} — ${(e as Error).message}`);
    }
  }
  if (out.length || fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    if (!dry) fs.writeFileSync(indexFile, JSON.stringify({ items: out }, null, 1));
    if (prune && !dry) {
      const keep = new Set(out.map((i) => i.file));
      for (const f of fs.readdirSync(dir)) if (f.endsWith('.mp3') && !keep.has(f)) fs.unlinkSync(path.join(dir, f));
    }
  }
}

(async () => {
  for (const level of bundle.levels) {
    const lc = course.levels.find((l) => l.id === level.id)!;
    const levelDir = path.join(args.levelsDir, lc.vocab ? lc.vocab.split('/')[1] ?? level.id : level.id);
    for (const w of level.weeks) {
      const items: Item[] = [];
      for (const d of w.dialogues) for (const it of d.items) if (it.kind === 'line') items.push({ speaker: it.speaker, text: it.tl, voice: voiceOf(it.speaker), say: it.say, speed: it.speed });
      // a grammar example with no space and no sentence punctuation is a lone word (십일, 공) → same lead-in as vocabulary
      if (course.audio.examples) for (const g of w.grammar) for (const ex of g.examples) items.push({ text: ex.tl, voice: voiceOf(), say: ex.say, speed: ex.speed, lone: !/[\s.?!]/.test(ex.say ?? ex.tl) });
      await processScope(path.join(args.root, w.dir, 'audio'), `${level.id} W${w.week}`, items);
    }
    if (course.audio.vocab) {
      const seen = new Set<string>();
      const items: Item[] = [];
      for (const e of [...level.units.flatMap((u) => u.entries), ...level.weeks.flatMap((w) => w.vocab)]) {
        if (!e.audio || seen.has(e.tl)) continue;
        seen.add(e.tl);
        items.push({ text: e.tl, voice: voiceOf(), say: e.say, lone: true });
      }
      await processScope(path.join(levelDir, 'audio'), `${level.id} vocab`, items);
    }
  }
  const lines = [
    `audio: ${dry ? 'would generate' : 'generated'} ${summary.generated} (${summary.chars} chars), cached ${summary.cached}, no voice/key ${summary.noVoice.length}, failed ${summary.failed.length}`,
    ...(summary.failed.length ? ['', 'Failed (left to the device voice):', ...summary.failed.map((s) => `  ✗ ${s}`)] : []),
    ...(summary.noVoice.length ? ['', `No voice / no key (device voice at runtime): ${summary.noVoice.length} item(s)`, ...summary.noVoice.slice(0, 8).map((s) => `  · ${s}`), summary.noVoice.length > 8 ? `  … and ${summary.noVoice.length - 8} more` : ''] : []),
  ].filter((l) => l !== undefined);
  console.log('\n' + lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Audio\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
  if (!api && !dry) console.log('\n(no ELEVENLABS_API_KEY → nothing generated; students hear the device voice)');
})();
