# FORMAT.md — Content files (v1)

Everything a week needs lives in `levels/<LEVEL>/weeks/week-NN/` as four small files plus an optional fifth. Agents draft them; teachers edit them in the PR. The validator (`npm run validate`) enforces every rule marked **MUST** and warns on **SHOULD**.

Files are UTF-8. YAML uses 2-space indents. Markdown is CommonMark; no HTML.

---

## 1. `levels/<LEVEL>/vocab.yml` — the level's vocabulary by unit (one file per level)

Produced once from the teacher's vocabulary list (docx/xlsx/pdf) and then maintained by hand.

```yaml
level: A1
units:
  - id: 준비1                      # MUST be unique within the level; used by week.yml
    label: "Preparatory Unit 1 (준비 1)"
    entries:
      - { n: 1,  ko: "미국",   en: "United States", cat: "Countries" }
      - { n: 2,  ko: "한국",   en: "Korea",         cat: "Countries" }
      - { n: 11, ko: "학생",   en: "student",       cat: "Jobs" }
      - { n: 24, ko: "좋아해요.", en: "I like (something).", cat: "Reading and speaking", kind: phrase }
  - id: 준비2
    label: "Preparatory Unit 2 (준비 2)"
    entries: [ … ]
```

- `n` **MUST** be unique within a unit (it's the number in the teacher's list; keeps `range` references stable).
- Target-language key: the canonical name is `tl`, and the parser also accepts the course's language code from `course.yml → app.target_language` as an alias — so in this repo `ko:` works, and a Spanish kit teacher writes `es:` (or `tl:`). `en` is the gloss. Mixing `ko` and `tl` in one file is a validator error.
- `cat` (category) is optional and **SHOULD** be copied from the source list's sub-headings.
- `kind`: `word` (default) | `phrase` | `expression`. Phrases are excluded from `match_vocab` auto quizzes.
- Optional per entry: `note` (short usage hint, English), `audio: false` (skip TTS, e.g. for symbols), `say` (what the voice should say when it differs from the display text, e.g. `say: "이뤌"` for 1월 so the liaison is heard; numbers and readings like "1월 (일월)" are converted automatically for Korean, see `scripts/lib/speech/ko.ts`).
- Optional `img` — a picture for the flip card (back side by default) and the Anki export. Only for entries where a picture is unambiguous; never force one. Forms:
  - `flag:gb` — country flag (ISO 3166 code; `gb-eng`, `gb-sct` for the home nations).
  - `icon:apple` — a line icon by name from the lucide set (concrete nouns: book, bus, chair…).
  - `photo` — a CC-licensed photo fetched at build time from Openverse by the English gloss (`npm run images`); the file and its attribution are committed under `levels/<L>/images/`.
  - `file:apple.jpg` — a file the teacher put in `levels/<L>/images/`.
  - `color:#E53935` — a plain colour swatch (for colour words).
  See `docs/decisions/001-anki-apkg-media.md`.

## 2. `week.yml` — metadata

```yaml
level: A1
week: 4
title: "준비 1 · Nice to meet you"        # shown on the ticket; keep under 40 chars
units: [준비1]                              # [] for recap weeks
status: published                            # draft | published  (draft builds but is hidden)
estimated_minutes: 20
vocab:                                       # optional
  include:
    - { unit: 준비2, range: "1-17" }         # narrow a unit to a numbered range
  extra:
    - { ko: "폴란드", en: "Poland", cat: "Countries" }
auto: [flashcards, match_vocab, dialogue_order, listen_choose]   # default; set [] to disable
shuffle_quiz: false
```

- `units` **MUST** reference ids that exist in the level's `vocab.yml`.
- A week with `units: []` and no `vocab.extra` has no Vocabulary tab (that's fine).
- `range` is inclusive, comma lists allowed: `"1-10, 18-21"`.

## 3. `grammar.md` — grammar notes

```markdown
## N이에요/예요 — "to be" (am / are / is)

Attach directly to a noun, no space. **이에요** after a consonant, **예요** after a vowel.

### Examples
- 수잔이에요. — I'm Susan.
- 앤디예요. — I'm Andy.
- 저는 학생이에요. — I'm a student.

> Tip: the question form is the same shape with rising intonation — 학생이에요?

## 어느 나라 사람이에요? — "Where are you from?"

Literally *which country person are you*. Answer with **[country] 사람이에요**.

### Examples
- 어느 나라 사람이에요? — Where are you from?
- 저는 영국 사람이에요. — I'm British.
```

- Each grammar point **MUST** start with `## ` followed by the pattern and, after ` — `, a short English label.
- Each point **MUST** have an `### Examples` list with 2–6 items in the form `- <target sentence> — <English>`. These get ▶ audio when `audio.examples: true`.
- An example **MAY** end with `{say: …}` — what the voice says instead of the display text, when the TTS gets the pronunciation wrong (e.g. `- ㄱ (기역)이에요. — It's giyeok. {say: 기여기에요.}`) — and/or `{speed: 0.8}` (0.7–1.2) to slow this one line. Not shown on screen.
- Body text **SHOULD** be 1–3 sentences; longer explanations belong in class, not here.
- Blockquotes render as tips. No headings deeper than `###`.
- Only the teacher's own sentences. Never copy textbook explanations.

## 4. `dialogue.md` — dialogues

```markdown
# Dialogue 1 — Introducing yourself

수미: 안녕하세요? 저는 미나예요. 이름이 뭐예요?
> Hello! I'm Mina. What's your name?
지누: 지누예요.
> I'm Jinu.
수미: 지누 씨, 어느 나라 사람이에요?
> Jinu, where are you from?
지누: 저는 영국 사람이에요.
> I'm British.
수미: 그래요? 만나서 반갑습니다.
> Really? Nice to meet you.

# Dialogue 2 — What do you do?
…
```

- `# ` starts a dialogue (title after ` — ` optional). One to three dialogues per week.
- A line is `Speaker: text`. `Speaker` **MUST** exist in `course.yml → speakers`. Text is one utterance (one audio file); split long turns into two lines with the same speaker.
- The `> translation` line directly under each line is **MUST** (shown with the translation toggle; used by `listen_choose`).
- Optional stage direction in parentheses on its own line `(on the phone)` — not spoken, not translated.
- A line **MAY** end with `{say: …}` and/or `{speed: 0.8}` (see §3); the display and the translation stay as written.
- A week with no `dialogue.md` has no Dialogue tab and no dialogue auto quizzes.

## 5. `quiz.yml` — authored quiz items

```yaml
items:
  - id: w4-q01
    type: mcq
    prompt: "Choose the correct form: 앤디___"
    options: ["이에요", "예요", "이에요?", "입니다"]
    answer: 1                      # index into options (0-based)
    explain: "앤디 ends in a vowel, so 예요."

  - id: w4-q02
    type: blank
    sentence: "저는 영국 ___이에요."
    options: ["사람", "나라", "이름"]
    answer: 0
    explain: "[country] 사람 = a person from [country]."

  - id: w4-q03
    type: order
    prompt: "I'm British."
    chunks: ["저는", "영국", "사람이에요"]
    answer: "저는 영국 사람이에요"
    accept: ["영국 사람이에요"]     # other valid full answers (chunks may be left out only if listed here)
    explain: "Topic first, then nationality + 사람이에요."

  - id: w4-q04
    type: type                     # rendered only if the level has typing_quizzes: true
    prompt: "What's your name?"
    answer: "이름이 뭐예요?"
    accept: ["이름이 뭐예요", "이름이 뭐에요?"]   # include common learner spellings you accept
    explain: "이름 + 이 (subject) + 뭐예요."

  - id: w4-q05
    type: match
    pairs:
      - ["학생", "student"]
      - ["선생님", "teacher"]
      - ["회사원", "office worker"]
      - ["의사", "doctor"]
      - ["가수", "singer"]

  - id: w4-q06
    type: tf
    statement: "You use 예요 after a noun ending in a consonant."
    answer: false
    explain: "Consonant → 이에요; vowel → 예요."
```

Rules:
- `id` **MUST** be unique across the level (`w<week>-q<nn>` convention).
- `mcq`: 3–4 options; exactly one `answer`. **SHOULD** keep options the same part of speech / category so distractors are plausible.
- `blank`: exactly one `___` in `sentence`; 2–4 options.
- `order`: 3–7 chunks; `answer` **MUST** equal the chunks joined by single spaces in some order; every `accept` entry **MUST** be buildable from a subset or permutation of the chunks. Chunks are eojeol (space-delimited words) — never split inside a word.
- `type`: `answer` + optional `accept`; matching normalises whitespace, punctuation `.?!`, full-width/half-width, and trailing `요.`/`요?`. Levels with `typing_quizzes: false` convert the item to `order` when `chunks` are provided, otherwise skip it (validator **warning**).
- `match`: 4–8 pairs; left = target language, right = English.
- `tf`: `answer: true|false` + `explain` (**MUST**, because the lesson is in the explanation).
- `explain` **SHOULD** be ≤ 20 words. English.
- 10–15 items per week is the target; a recap week may have 6–8.

## 6. `vocab.yml` (optional, per week) — same shape as `week.yml → vocab`; kept separate if long.

## 7. Validation summary

Errors (fail the PR): unknown unit id · unknown speaker · dialogue line without translation · duplicate item id · `order`/`accept` not buildable from chunks · `mcq`/`blank` answer index out of range · `blank` without exactly one `___` · file from `source/` referenced or copied into output · YAML/Markdown parse errors.

Warnings (shown, don't fail): a `type` item on a non-typing level without `chunks` · fewer than 6 or more than 20 items · a grammar point with < 2 examples · a dialogue longer than 12 lines · estimated_minutes missing.

The validator prints a table (file · line · level · message) and, in CI, posts it as a PR comment.
