/** Thin ElevenLabs REST client (build time only). */
const BASE = 'https://api.elevenlabs.io/v1';

export interface Voice { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string; description?: string }

export class ElevenLabs {
  constructor(private readonly key: string) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { 'xi-api-key': this.key, ...extra };
  }

  async voices(): Promise<Voice[]> {
    const res = await fetch(`${BASE}/voices`, { headers: this.headers() });
    if (!res.ok) throw new Error(`voices: ${res.status} ${await res.text()}`);
    return ((await res.json()) as { voices: Voice[] }).voices;
  }

  /** Public voice library, filtered by language (e.g. "ko"). */
  async sharedVoices(language: string, pageSize = 40): Promise<(Voice & { public_owner_id?: string; gender?: string; accent?: string; use_case?: string; language?: string })[]> {
    const res = await fetch(`${BASE}/shared-voices?language=${encodeURIComponent(language)}&page_size=${pageSize}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`shared-voices: ${res.status} ${await res.text()}`);
    return ((await res.json()) as { voices: (Voice & { public_owner_id?: string; gender?: string; accent?: string; use_case?: string; language?: string })[] }).voices;
  }

  /** Adds a public-library voice to My Voices so the API can use it. */
  async addSharedVoice(publicOwnerId: string, voiceId: string, newName: string): Promise<string> {
    const res = await fetch(`${BASE}/voices/add/${publicOwnerId}/${voiceId}`, {
      method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ new_name: newName }),
    });
    if (!res.ok) throw new Error(`add voice: ${res.status} ${await res.text()}`);
    return ((await res.json()) as { voice_id: string }).voice_id;
  }

  /** Returns mp3 bytes. Retries on 429/5xx with backoff. */
  async tts(voiceId: string, text: string, modelId: string, languageCode?: string, settings?: { speed?: number; stability?: number }, previousText?: string): Promise<Uint8Array> {
    const body: Record<string, unknown> = { text, model_id: modelId };
    // previous_text is context the model 'hears' but does not speak: it fixes the language and steadies the
    // prosody of a lone word, which otherwise often comes out with a rising, foreign-sounding intonation.
    if (previousText) body.previous_text = previousText;
    if (settings && (settings.speed !== undefined || settings.stability !== undefined)) {
      body.voice_settings = { stability: settings.stability ?? 0.5, similarity_boost: 0.75, ...(settings.speed !== undefined ? { speed: settings.speed } : {}) };
    }
    if (languageCode && /flash_v2_5|turbo_v2_5/.test(modelId)) body.language_code = languageCode;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`${BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
        method: 'POST', headers: this.headers({ 'Content-Type': 'application/json', Accept: 'audio/mpeg' }), body: JSON.stringify(body),
      });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      const msg = await res.text();
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
      throw new Error(`${res.status} ${msg.slice(0, 200)}`);
    }
    throw new Error('rate limited after 4 attempts');
  }
}

export function isPlaceholderVoice(v: string | undefined): boolean {
  return !v || /^EL_VOICE_ID/.test(v) || v.trim() === '';
}
