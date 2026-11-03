// Helps the teacher pick voices: lists the account's voices, or the public library for a language.
//   npm run voices              # my voices (premade + added)
//   npm run voices -- --library # public library voices for course.yml → app.target_language
//   npm run voices -- --add <name-from-library>   # add that library voice to My Voices (prints its id)
import { parseArgs } from './lib/args';
import { loadDotEnv } from './lib/env';
import { ElevenLabs } from './lib/elevenlabs';
import { loadCourse } from './lib/config';
import { Issues } from './lib/issues';

const args = parseArgs(process.argv.slice(2));
loadDotEnv(args.root);
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('ELEVENLABS_API_KEY missing (put it in .env)'); process.exit(1); }
const course = loadCourse(args.coursePath, args.root, new Issues());
const lang = course?.app.target_language ?? 'en';
const api = new ElevenLabs(key);

(async () => {
  const addIdx = process.argv.indexOf('--add');
  if (addIdx > 0) {
    const want = process.argv.slice(addIdx + 1).join(' ').toLowerCase();
    const vs = await api.sharedVoices(lang, 100);
    const v = vs.find((x) => x.name.toLowerCase().startsWith(want));
    if (!v || !v.public_owner_id) { console.error(`no library voice starting with "${want}"`); process.exit(1); }
    const id = await api.addSharedVoice(v.public_owner_id, v.voice_id, v.name.split(' - ')[0]!);
    console.log(`added "${v.name}" → voice id ${id}`);
    return;
  }
  if (process.argv.includes('--library')) {
    const vs = await api.sharedVoices(lang);
    console.log(`Public library voices for "${lang}" (add one to My Voices in the ElevenLabs app before using its id):\n`);
    for (const v of vs) console.log(`${v.voice_id}  ${v.name.padEnd(22)} ${(v.gender ?? '').padEnd(8)} ${(v.accent ?? '').padEnd(12)} ${v.use_case ?? ''}\n    preview: ${v.preview_url ?? '-'}`);
    return;
  }
  const vs = await api.voices();
  console.log(`My voices (${vs.length}). Any of these can speak ${lang} with ${course?.audio.model ?? 'eleven_flash_v2_5'}:\n`);
  for (const v of vs) console.log(`${v.voice_id}  ${v.name.padEnd(22)} ${(v.labels?.gender ?? '').padEnd(8)} ${(v.labels?.accent ?? '').padEnd(12)} ${v.category ?? ''}${v.labels?.language ? ' · ' + v.labels.language : ''}\n    preview: ${v.preview_url ?? '-'}`);
})().catch((e) => { console.error((e as Error).message); process.exit(1); });
