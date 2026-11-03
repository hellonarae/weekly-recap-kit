import { z } from 'zod';
import path from 'node:path';
import type { CourseConfig } from '../../src/content/types';
import { loadYaml } from './yaml';
import { Issues } from './issues';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a 6-digit hex colour like #660099');

export const CourseSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    short_name: z.string().min(1).default('Recap'),
    ui_language: z.string().default('en'),
    target_language: z.string().min(2),
    script: z.enum(['hangul', 'latin', 'hanzi', 'kana', 'cyrillic']).default('latin'),
    theme: z.object({ primary: hex, accent: hex, tokens: z.record(hex).optional() }),
    footer_note: z.string().optional(),
    contact_email: z.string().optional(),
  }),
  levels: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]+$/, 'level id: letters, digits, - or _ only'),
        label: z.string().min(1),
        vocab: z.string().optional(),
        typing_quizzes: z.boolean().default(true),
      }),
    )
    .min(1),
  speakers: z
    .record(
      z.object({
        gender: z.enum(['f', 'm']),
        voice: z.string().optional(),
        fallback: z.string().min(2),
        speed: z.number().min(0.7).max(1.2).optional(),      // ElevenLabs voice_settings.speed
        stability: z.number().min(0).max(1).optional(),
        gain: z.number().min(0.5).max(2).optional(),          // volume multiplier applied with ffmpeg after TTS (1.2 = +20 %)
      }),
    )
    .default({}),
  audio: z
    .object({
      provider: z.enum(['elevenlabs', 'browser']).default('browser'),
      model: z.string().default('eleven_flash_v2_5'),
      speed_options: z.array(z.number().positive()).default([0.75, 1.0]),
      attribution: z.boolean().default(true),
      examples: z.boolean().default(false),
      vocab: z.boolean().default(false),
      lead_in: z.string().optional(),                          // sentence the voice 'hears' before each lone word (ElevenLabs previous_text); steadies the accent
    })
    .default({}),
  vocab: z
    .object({
      card_image: z.enum(['front', 'back', 'off']).default('back'),
      anki_export: z.enum(['apkg', 'tsv', 'off']).default('apkg'),
    })
    .default({}),
  modules: z
    .object({
      auth: z.enum(['none', 'supabase']).default('none'),
      tracking: z.boolean().default(false),
      admin: z.boolean().default(false),
      rewards: z.boolean().default(false),
      avatar: z.boolean().default(false),
    })
    .default({}),
  auth: z
    .object({
      allowed_domains: z.array(z.string()).default([]),
      consent_required: z.boolean().default(true),
      code_prefix: z.string().default('P'),
    })
    .optional(),
  publish: z
    .object({
      target: z.enum(['vercel', 'pages']).default('pages'),
      noindex: z.boolean().default(true),
    })
    .default({}),
});

export function loadCourse(coursePath: string, root: string, issues: Issues): CourseConfig | null {
  const rel = path.relative(root, coursePath);
  const { data } = loadYaml(coursePath, rel, CourseSchema, issues);
  if (!data) return null;
  if (data.modules.tracking && data.modules.auth === 'none') {
    issues.error(rel, 'modules.tracking needs modules.auth: supabase');
  }
  if (data.modules.admin && data.modules.auth === 'none') {
    issues.error(rel, 'modules.admin needs modules.auth: supabase');
  }
  return data as CourseConfig;
}
