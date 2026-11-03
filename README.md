# Weekly Recap Kit

Turn each week's lecture slides into a review site for your students: vocabulary cards, grammar notes, the dialogue with audio and shadowing, and a quiz. An AI agent (GitHub Copilot) drafts everything and you approve it in one click.

- Works for any language you teach.
- **One account: GitHub.** Nothing to install, no coding, and no API keys for the kit itself. (Natural voices are an optional extra that needs a free ElevenLabs key.)
- Students need only the link. No sign-up, no tracking.
- **Stuck at any point? Ask Copilot first** (see *Stuck? Ask Copilot* below). It can read your repository and explain errors.

**Before you start**
- A GitHub account with **Copilot Pro**. It is free for verified teachers through GitHub Education (https://education.github.com/teachers). Approval can take a few days, and a Copilot Pro trial works in the meantime. Copilot *Free* does not include the agent that drafts the weeks.
- Slides as **PowerPoint (.pptx)** with real text (not pictures of text). The kit reads .pptx files, so convert other formats first: Google Slides *File → Download → Microsoft PowerPoint*, Keynote *File → Export To → PowerPoint*. PDF is not read yet. No slides to hand? Use the sample slides (see *Sample material* below).

---

## 1. Copy the kit
On this page click **Use this template → Create a new repository**. Name it, e.g. `spanish-recap`.
- **Private** (recommended). Your uploaded slides stay visible to you only. A private repository needs GitHub Pro to publish the site, and GitHub Education gives you Pro.
- **Public** works on any account, but **anyone can see the slides you upload**. Use it only with the sample slides or with material you are allowed to share.

Click **Create repository**.

## 2. Switch on the site
In your new repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Then open the **Actions** tab in the menu at the top of the repository (next to *Pull requests*, not *Settings → Actions*) → click **pages** in the left list → **Run workflow → Run workflow**.
After about two minutes you get a green tick, and your site (with one example week) is live at `https://<your-username>.github.io/<repository-name>/`. The address is also shown on Settings → Pages.

## 3. Describe your course in `course.yml`
*Practising with the Spanish sample slides? Skip this step. The kit is already set up for them.*
`course.yml` is a short text file with your course's settings. Click it in the file list, then the **pencil icon**. It opens in GitHub's editor in your browser, so there's nothing to install. Change the values after the colons, keep the spaces at the start of each line, then click **Commit changes…** → **Commit changes**. Every line has a comment saying what it does. The main ones are `app.name`, `app.target_language`, `app.script`, the two theme colours, your `levels` (the level `id` is the folder name your weeks will go in, e.g. `FR1` → `levels/FR1/`) and the `speakers` in your dialogues.
- **Or let Copilot do it:** Issues → New issue → describe your course in plain words (name, language, class, speakers, colours) → assign **Copilot** → merge its pull request.
- With your own level, the Spanish example (`levels/ES`) disappears from the site but stays in the repository as a model for Copilot.

## 4. Upload a week's slides
On your computer, make a folder `week-02` with a folder `source` inside, and put that week's .pptx files in `source`. (The sample zip already has its folders laid out this way.)
In your repository, open `levels` → `ES` → `weeks` → **Add file → Upload files**. Drag the whole **`week-02` folder** onto the page, choose **Commit directly to the main branch**, and click **Commit changes**.
- **Several weeks at once:** put several week folders side by side (`week-02`, `week-03`, …) and drag them all together. Each becomes its own issue in step 5.
- In `levels/ES`, `week-01` is the built-in example, so start at `week-02`. With your own level (step 3) every week number is free: lay it out as `<LEVEL>/weeks/week-01/source/…` on your computer, open `levels` and drag the `<LEVEL>` folder.

## 5. Hand the week to Copilot
Within a minute an issue appears under **Issues**: *Draft levels/ES/weeks/week-02*. Open it → **Assignees** (right-hand side) → **Copilot**.
That one click starts the draft. GitHub doesn't let the automation assign Copilot itself. Copilot replies on the issue and opens a pull request. Drafting takes about 10–20 minutes.
Uploaded several weeks? There is one issue per week: assign Copilot on each, and the drafts run side by side. Tip: draft and merge one week first, because Copilot uses your earlier weeks as examples. Each draft uses part of your monthly Copilot allowance (Copilot settings → Usage).

## 6. Review and publish
Open **Pull requests** → Copilot's pull request.
- If you see **Approve and run workflows**, click it. The content check then posts ✅ or ❌ as a comment.
- **Files changed**: read `grammar.md`, `dialogue.md`, `quiz.yml` and `week.yml`. To change something, click **⋯ → Edit file** (the edit saves into the same pull request), or write a comment starting with `@copilot` saying what to change.
- When you're happy: **Ready for review** (if the pull request is still a draft) → **Merge pull request → Confirm merge**.

A few minutes later the week is on your site. Share the link with your students once.

**Every week after that: steps 4–6.** Upload slides → assign Copilot → read, tweak, merge.

---

## What students get
A phone-friendly site, week by week, with five tabs: **Vocabulary** (flip cards, list, Anki export), **Grammar** (your notes and examples), **Dialogue** (Listen line by line, **Repeat** with self-recording, **Shadow**, **Role-play** a character), **Quiz** (multiple choice, fill-in, word order, typing, matching, true/false, plus auto-generated card and dialogue games) and **Review** (wrong answers, starred words). Stars and bookmarks are collected on **My page**. Everything a student does stays in their own browser, and recordings never leave their device.

## Sample material (if you have no slides to hand)
The workshop page has a zip of open slide decks from **Lumen Learning, Introductory Spanish I (CC BY)**: one folder per week (`week-02` … `week-05`), 4–5 PowerPoint files each. Upload one folder as in step 4.

CC BY means the source must be credited wherever its content appears. The kit already does this. `course.yml → app.footer_note` is set to `Sample slides: Lumen Learning, Introductory Spanish I (CC BY)` and `LICENSES.md` carries the same line. Keep both while your site uses these slides. Source: https://courses.lumenlearning.com/wm-spanish1-2/?p=2236

## Privacy and copyright
- `source/` folders are read by the drafting agent and **never published on the site**, and a build check enforces this. They are visible to anyone who can see the *repository*, which is why private is recommended (step 1).
- The site itself is public to anyone with the link, even from a private repository. It carries `noindex`, so search engines don't list it.
- Publish only your own notes, example sentences and dialogues. For publisher or third-party material, check that you have permission to use and publish it.
- No accounts and no student data: the kit has sign-in and tracking switched off (`modules` in `course.yml`).

## Stuck? Ask Copilot
Copilot can read your repository, so it can usually tell you what went wrong faster than anyone else.
- **A red ✗ in the Actions tab:** open the failed run and click **Explain error** (Copilot icon) next to the log.
- **Anything else:** click the **Copilot icon** at the top of any GitHub page, make sure your repository is attached, and ask in plain words, for example: *"I'm following the README of this repository. I uploaded slides to levels/ES/weeks/week-02/source but no issue appeared. What went wrong?"*
- **About a draft:** comment on the pull request starting with `@copilot` and say what to change.

## Troubleshooting
- **No issue after step 4.** Actions tab → **draft-week**: a red ✗ shows the reason. Check that the slides sit in `levels/<LEVEL>/weeks/week-NN/source/` and that the folder has no `week.yml` yet. Then **Run workflow** there.
- **Copilot isn't in the Assignees list.** Your account needs Copilot Pro, and the agent must be allowed for this repository: Settings → Copilot → Cloud agent.
- **❌ from the content check.** The comment lists file and line. Typical causes: a speaker missing from `course.yml`, a dialogue line without its `>` translation, a quiz answer that doesn't match its chunks. Comment `@copilot please fix the content check` and it will.
- **The site didn't change after merging.** Actions tab → **pages**: wait for the green tick (2–3 minutes). A red ✗ in the "Pages" step means step 2's *Source: GitHub Actions* is not set.
- **Tired of "Approve and run workflows"?** Settings → Copilot → Cloud agent → turn off *Require approval for workflow runs*. GitHub warns that unreviewed agent code then runs with this repository's permissions.

## Optional extras
- **Your own vocabulary list by unit** (Word/Excel): upload it to `levels/<LEVEL>/source/`, then **Issues → New issue → Convert vocabulary list** → assign **Copilot**. Weeks then use your units instead of the words the agent picks from the slides.
- **Copilot assigned automatically** (skips step 5): create a fine-grained personal access token for this repository (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained) with read/write on Contents, Issues, Pull requests and Actions. Save it as the repository secret `COPILOT_ASSIGN_TOKEN` (Settings → Secrets and variables → Actions → New repository secret).
- **Natural voices** (needs a second account, ElevenLabs; the free plan is enough for a few dialogues a month): put an ElevenLabs API key in the repository secret `ELEVENLABS_API_KEY`, set `audio.provider: elevenlabs` and a voice ID per speaker in `course.yml`. Audio is made once per new line when you merge and stored in the repository. Without it, students hear their device's voice.

## Costs
GitHub Pro and Copilot Pro through GitHub Education: £0 · GitHub Pages hosting: £0 · Student use: £0, always.

## Licence
Code: **PolyForm Noncommercial 1.0.0** (see `LICENSE`). Free to use, copy and adapt for teaching and any other noncommercial purpose. Selling it or using it in a commercial product is not allowed. Keep the `LICENSE` file, with its `Required Notice` line, in your copy. Your content stays yours. Fonts and icons are open-licensed (see `LICENSES.md`).
