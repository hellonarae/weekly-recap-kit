// Shared shapes for src/generated/content.json.
// Produced by scripts/build-content.ts, consumed by the app. Nothing course-specific here.

export type Script = 'hangul' | 'latin' | 'hanzi' | 'kana' | 'cyrillic';

export interface ThemeConfig {
  primary: string;
  accent: string;
  /** Optional explicit overrides for any derived token, e.g. { ink: "#231A33" } */
  tokens?: Record<string, string>;
}

export interface LevelConfig {
  id: string;
  label: string;
  vocab?: string;
  typing_quizzes: boolean;
}

export interface SpeakerConfig {
  gender: 'f' | 'm';
  voice?: string;
  fallback: string; // BCP-47 language tag for browser TTS
  /** ElevenLabs voice_settings.speed (0.7–1.2) */
  speed?: number;
  stability?: number;
  /** Volume multiplier applied at build time with ffmpeg (1.2 = +20 %). */
  gain?: number;
}

export interface CourseConfig {
  app: {
    name: string;
    short_name: string;
    ui_language: string;
    target_language: string;
    script: Script;
    theme: ThemeConfig;
    footer_note?: string;
    contact_email?: string;
  };
  levels: LevelConfig[];
  speakers: Record<string, SpeakerConfig>;
  audio: {
    provider: 'elevenlabs' | 'browser';
    model: string;
    speed_options: number[];
    /** Unspoken context sentence passed to the TTS before lone words (ElevenLabs previous_text). */
    lead_in?: string;
    attribution: boolean;
    examples: boolean;
    vocab: boolean;
  };
  vocab: {
    card_image: 'front' | 'back' | 'off';
    anki_export: 'apkg' | 'tsv' | 'off';
  };
  modules: {
    auth: 'none' | 'supabase';
    tracking: boolean;
    admin: boolean;
    rewards: boolean;
    avatar: boolean;
  };
  auth?: {
    allowed_domains: string[];
    consent_required: boolean;
    code_prefix: string;
  };
  publish: {
    target: 'vercel' | 'pages';
    noindex: boolean;
  };
}

export type VocabKind = 'word' | 'phrase' | 'expression';

export interface VocabEntry {
  /** Number in the teacher's list; unique within a unit. 0 for week extras. */
  n: number;
  /** Target-language text. */
  tl: string;
  /** English gloss. */
  en: string;
  cat?: string;
  kind: VocabKind;
  note?: string;
  /** false = skip TTS (symbols etc.) */
  audio: boolean;
  /** What the voice should say when it differs from the display text (e.g. a reading). */
  say?: string;
  /** "flag:gb" | "icon:apple" | "photo" | "file:apple.jpg" — see FORMAT.md §1 */
  img?: string;
  /** Unit id this entry came from; absent for week extras. */
  unit?: string;
}

export interface Unit {
  id: string;
  label: string;
  entries: VocabEntry[];
  /** Weeks (ids) that reference this unit; filled by the builder. */
  weeks: string[];
}

export interface GrammarExample {
  tl: string;
  en: string;
  /** Spoken override from a trailing `{say: …}` (pronunciation the TTS gets wrong). */
  say?: string;
  /** Per-line TTS speed from a trailing `{speed: 0.8}`. */
  speed?: number;
}

export interface GrammarPoint {
  id: string;
  pattern: string;
  label: string;
  /** Markdown body (paragraphs only). */
  body: string;
  examples: GrammarExample[];
  tips: string[];
}

export type DialogueItem =
  | { kind: 'line'; speaker: string; tl: string; en: string; say?: string; speed?: number }
  | { kind: 'direction'; text: string };

export interface Dialogue {
  id: string;
  title?: string;
  items: DialogueItem[];
}

export type QuizItem =
  | { id: string; type: 'mcq'; prompt: string; options: string[]; answer: number; explain?: string }
  | { id: string; type: 'blank'; sentence: string; options: string[]; answer: number; explain?: string }
  | { id: string; type: 'order'; prompt: string; chunks: string[]; answer: string; accept: string[]; explain?: string }
  | { id: string; type: 'type'; prompt: string; answer: string; accept: string[]; chunks?: string[]; explain?: string }
  | { id: string; type: 'match'; pairs: [string, string][]; explain?: string }
  | { id: string; type: 'tf'; statement: string; answer: boolean; explain: string };

export type QuizType = QuizItem['type'];
export type AutoQuizType = 'flashcards' | 'match_vocab' | 'dialogue_order' | 'listen_choose';

export interface Week {
  /** `${level}-w${week}` e.g. "A1-w04" */
  id: string;
  level: string;
  week: number;
  title: string;
  units: string[];
  status: 'draft' | 'published';
  estimated_minutes?: number;
  vocab: VocabEntry[];
  grammar: GrammarPoint[];
  dialogues: Dialogue[];
  quiz: QuizItem[];
  auto: AutoQuizType[];
  shuffle_quiz: boolean;
  /** Relative folder, e.g. "levels/A1/weeks/week-04" — for audio index lookup. */
  dir: string;
}

export interface Level {
  id: string;
  label: string;
  typing_quizzes: boolean;
  units: Unit[];
  weeks: Week[];
}

export interface ContentBundle {
  builtAt: string;
  course: CourseConfig;
  levels: Level[];
}

export type IssueLevel = 'error' | 'warning';
export interface Issue {
  file: string;
  line?: number;
  level: IssueLevel;
  message: string;
}
