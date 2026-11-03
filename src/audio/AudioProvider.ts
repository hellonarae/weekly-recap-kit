/** One spoken item. `speaker` picks a voice; `lang` is the BCP-47 fallback for the device voice. */
export interface SpeechRequest {
  text: string;
  speaker?: string;
  lang: string;
  speed: number;
  /** Optional scope for file lookup, e.g. "A1/week-04" or "A1/vocab". */
  scope?: string;
}

export interface AudioProvider {
  readonly name: 'file' | 'browser';
  /** Can this provider play this request without falling back? */
  canPlay(req: SpeechRequest): boolean;
  /** Resolves when playback ends (or is stopped). */
  play(req: SpeechRequest): Promise<void>;
  stop(): void;
}
