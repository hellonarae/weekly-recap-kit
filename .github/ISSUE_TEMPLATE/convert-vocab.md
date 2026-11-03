---
name: Convert vocabulary list
about: Turn the list you uploaded to levels/<LEVEL>/source/ into levels/<LEVEL>/vocab.yml
title: "Convert vocabulary list for level <LEVEL>"
labels: draft
---

Convert the vocabulary list in `levels/<LEVEL>/source/` into `levels/<LEVEL>/vocab.yml`.

Read `FORMAT.md` §1 and `PROMPTS.md` §1 first. Keep the teacher's unit order and numbering, one entry per word with the English gloss exactly as in the list, and the category sub-headings as `cat`. Use the language code from `course.yml → app.target_language` as the key (e.g. `es:`). Do not invent words. Run `npm run validate` until it reports 0 errors, then open a pull request titled "Vocabulary list (<LEVEL>)".
