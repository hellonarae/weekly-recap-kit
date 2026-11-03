# Licences of third-party material

Everything shipped to students is under a permissive or open licence. Add a row whenever a new font, icon set, image source or library is introduced.

| Material | Licence | Where used | Source |
|---|---|---|---|
| Pretendard Variable | SIL OFL 1.1 | UI + Hangul/Latin text (`pretendard` npm) | https://github.com/orioncactus/pretendard |
| Noto Sans SC / JP | SIL OFL 1.1 | optional, only when `app.script` is `hanzi` / `kana` (Google Fonts) | https://fonts.google.com/noto |
| lucide-react | ISC | UI icons; `img: icon:<name>` vocabulary pictures | https://lucide.dev |
| flag-icons (planned, Phase D) | MIT | `img: flag:<cc>` vocabulary pictures | https://github.com/lipis/flag-icons |
| Openverse API (planned, Phase D) | per image (CC0 / CC BY …) — attribution recorded in `levels/<L>/images/index.json` | `img: photo` vocabulary pictures | https://openverse.org |
| React, React Router, Vite, TypeScript, zod, yaml, tsx | MIT / Apache-2.0 | app + scripts | npm |
| @dnd-kit/core (planned, Phase C) | MIT | word-order quiz drag-and-drop | https://dndkit.com |
| sql.js (planned, Phase C) | MIT | Anki .apkg export in the browser | https://sql.js.org |
| fflate (planned, Phase C) | MIT | zip for .apkg export | https://github.com/101arrowz/fflate |
| ElevenLabs TTS output | ElevenLabs terms (teacher's own plan); attribution line shown when `audio.attribution: true` | generated mp3 under `levels/**/audio/` | https://elevenlabs.io |

Teaching material (slides, vocabulary lists, textbook) is **not** third-party material of this project: slides are read by scripts and never published; only grammar labels, the teacher's own sentences and word lists reach the site.

## Sample teaching material (kit only, optional download)
- **Introductory Spanish I** PowerPoint decks — Lumen Learning, **CC BY 4.0**. https://courses.lumenlearning.com/wm-spanish1-2/?p=2236 — Credit required wherever the content is shown: "Sample slides: Lumen Learning, Introductory Spanish I (CC BY)". Not part of this repo; distributed as a zip with the workshop materials.
