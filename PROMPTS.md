# PROMPTS.md — Agent briefs for authoring

These are the exact instructions given to the drafting agent (Copilot coding agent via the issue template, or Claude Code locally). They are written so a teacher can also paste them into any chat AI. Placeholders in `{braces}` are filled by the workflow or the teacher.

Principle: **the agent drafts, the teacher decides.** Drafts must be complete and valid so the teacher's job is reading, not fixing.

---

## 1. One-off: vocabulary list → `levels/{LEVEL}/vocab.yml`

> You are converting a teacher's vocabulary list into `levels/{LEVEL}/vocab.yml`. Read `FORMAT.md §1` first.
>
> Input: `{path to docx/xlsx/pdf}`. It is organised by unit (headings such as "Preparatory Unit 1 (준비 1)" or "Unit 1"), with numbered rows (number · target word · English) and category sub-headings inside units (e.g. "Countries", "Jobs").
>
> Rules:
> 1. Keep the unit order, the numbering and the English glosses **exactly** as in the source. Do not improve translations. Do not add words.
> 2. `id` for each unit: the short Korean label if present (`준비1`, `준비2`, …) else `unit1`, `unit2`. `label`: the full heading.
> 3. Put the sub-heading into `cat` for every entry under it.
> 4. Entries that are whole sentences or fixed expressions (end with `.`/`?` or contain a verb ending) get `kind: phrase`.
> 5. Strip trailing spaces; keep Korean spacing as written.
> 6. `img` (optional picture, see FORMAT.md §1): add `img: flag:<cc>` for every country name; add `img: icon:<name>` only for concrete nouns whose lucide icon is unambiguous (book, umbrella, bus, cat …). Leave abstract words, verbs, phrases and grammar words without `img`. Never force a picture; when in doubt, leave it out.
> 7. Output only the YAML file, then run `npm run validate`. If the source has an ambiguous row (two words in one cell, a missing number), keep it but add `note: "CHECK: …"` so the teacher sees it.
>
> Finish with a 5-line summary: units found, entries per unit, rows flagged CHECK, entries given `img`.

Shortcut when the list is a Word table (No. · word · English, with unit headings and category rows): `npx tsx scripts/vocab-from-docx.ts "<docx>" <LEVEL> ko > levels/<LEVEL>/vocab.yml` does steps 1–5 and 7 deterministically; the agent then adds `img` by hand.

## 2. Weekly: slides → a complete week draft

Used as the body of `.github/ISSUE_TEMPLATE/draft-week.md` (assigned to Copilot) and by Claude Code locally.

> **Task: draft Week {NN} for level {LEVEL}.**
>
> Read, in order: `FORMAT.md`, `course.yml`, `levels/{LEVEL}/vocab.yml`, then the slides in `levels/{LEVEL}/weeks/week-{NN}/source/` (use `scripts/extract` to get slide text in order: `npm run extract -- levels/{LEVEL}/weeks/week-{NN}/source`). Create exactly these files in `levels/{LEVEL}/weeks/week-{NN}/`: `week.yml`, `grammar.md`, `dialogue.md` (omit if the slides contain no dialogue), `quiz.yml`. Do not edit anything under `src/` or any other week. Open a pull request titled `Week {NN} ({LEVEL}) — draft for review`.
>
> ### What to extract from the slides
> - **Learning objectives** slide → `week.yml → title` (short, ≤ 40 chars; keep the unit name if shown, e.g. "준비 1 · Nice to meet you").
> - **Grammar** slides (pattern + explanation + examples) → one `## ` block each in `grammar.md`. Use the teacher's own example sentences from the slides; write the explanation in your own words, 1–3 sentences, English. 2–6 examples per point with English translations (translate yourself if the slide has none).
> - **Dialogue** slides (lines like `수미: …`) → `dialogue.md`, verbatim, one line per utterance, with an English translation under each. Speaker names must match `course.yml → speakers`; if a new name appears, stop and say so in the PR description instead of inventing a voice.
> - **Vocabulary** slides: do **not** transcribe them. Vocabulary comes from `vocab.yml`. Decide `week.yml → units` by matching the slide's unit title / the words shown against the units in `vocab.yml`; if the week clearly covers only part of a unit, add a `vocab.include` range. If the slides are a recap week (no new unit), set `units: []`. Words that appear in the slides but in no unit go to `vocab.extra` (max 10).
> - Ignore: administrative slides, homework instructions, images without text, anything copied from a textbook page (if a slide reads like a textbook exercise, skip it).
>
> ### Quiz design rules (`quiz.yml`)
> Target 10–15 items (6–8 for a recap week). Mix types; every grammar point should get at least two items; include 2–3 vocabulary items from this week's units.
> - **mcq** — 4 options when possible. Distractors must be the *same kind* of thing as the answer (another particle, another ending, another country), plausible to a learner who half-knows the rule. Never a joke option.
> - **blank** — for particle and ending choices (이에요/예요, 은/는, 이/가, 을/를, honorific vs plain). Exactly one `___`. 2–4 options.
> - **order** — build from the teacher's example sentences or dialogue lines. Chunks are whole words (space-delimited). 3–6 chunks. If the sentence has more than one natural order, list the others in `accept`. Give the English in `prompt`.
> - **type** — only if `course.yml` marks the level `typing_quizzes: true`. English prompt → target sentence. Put learner-plausible spellings and particle-dropped versions in `accept`.
> - **match** — 5–6 pairs from this week's vocabulary, one category per item.
> - **tf** — rule statements; the `explain` carries the rule.
> - `explain` ≤ 20 words, English, states the rule or the reason — not "Correct!".
> - Keep every sentence at the learners' level: only grammar and vocabulary taught in this or earlier weeks of this level (check earlier `week.yml` files).
> - Ids: `w{NN}-q01`, `w{NN}-q02`, …
>
> ### Before opening the PR
> Run `npm run validate`. Fix every error. In the PR description give: a 5-line summary (grammar points, dialogue count, units chosen and why, item count by type), the list of validator warnings, and any place where you were unsure — mark these `TEACHER CHECK:`.

## 3. Proposal: week → unit mapping (when the teacher hasn't set it)

> Compare the words on the slides in `levels/{LEVEL}/weeks/week-{NN}/source/` with each unit's entries in `levels/{LEVEL}/vocab.yml`. Report, per unit, how many of its entries appear in the slides. Propose `units:` for `week.yml` (the unit(s) with the strongest overlap; `[]` if under 20 % for every unit), and a `vocab.include` range if the overlap is concentrated in a numbered span. Put the proposal and the counts in the PR description under `TEACHER CHECK: unit mapping`.

## 4. Re-draft request (teacher-triggered)

> Re-draft `{file}` for Week {NN} ({LEVEL}) following `PROMPTS.md §2`, keeping everything else unchanged. Reason from the teacher: "{reason}". Open a PR that changes only that file.

## 5. Teacher's quality checklist (shown in the PR template)

- [ ] Grammar explanations say what I'd say in class, in fewer words.
- [ ] Every example sentence is mine (from my slides) or clearly new; nothing lifted from the textbook.
- [ ] Dialogue lines are verbatim from my slides and the translations are natural.
- [ ] Units are right for this week; vocabulary list looks complete.
- [ ] Quiz: no item uses grammar or words we haven't done yet; distractors are fair; explanations teach.
- [ ] Looks right on a phone (the pull request's preview link if your host makes one, otherwise the site after merging).
