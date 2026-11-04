---
name: Draft a week from slides
about: Hand the slides in levels/<L>/weeks/week-NN/source/ to the drafting agent
title: "Draft levels/{LEVEL}/weeks/week-{N}"
labels: draft
---

Draft the week in `{WEEK_DIR}` from the slides in `{WEEK_DIR}/source/`.

Read, in this order: `FORMAT.md`, `PROMPTS.md` §2 ("Weekly: slides → a complete week draft"), `course.yml`, the level's `levels/{LEVEL}/vocab.yml`, and the existing weeks under `levels/{LEVEL}/weeks/` as examples. Extract the slide text with `npm run extract -- {WEEK_DIR}/source`.

Write these four files in `{WEEK_DIR}`: `week.yml` (with `level: {LEVEL}` and `status: published`: the teacher's review is this pull request, and merging it is the approval, so a `draft` status would hide the week after the merge), `grammar.md`, `dialogue.md`, `quiz.yml`. Never edit `src/`, never copy textbook text — only the teacher's own sentences from the slides.

One exception to "only these files" (it replaces the "stop" rule for new speakers in `PROMPTS.md` §2): this site uses the device voice, so if a dialogue speaker is missing from `course.yml → speakers`, add them there in the same format as the others (`voice: ""`, the same `fallback` language) and list them in the pull request under `TEACHER CHECK: new speakers`.

Run `npm run validate` until it reports 0 errors, then open a pull request titled "Week {N} draft ({LEVEL})" whose description lists the grammar points, dialogue titles and anything you were unsure about (marked `TEACHER CHECK`).
