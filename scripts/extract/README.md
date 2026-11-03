Source adapters (Phase B): `pptx.ts`, `docx.ts`, `html.ts`, `pdf.ts`.
Each exports `extract(file): Promise<{ page: number; text: string }[]>` — text per slide/page, in order.
Used by the drafting prompts only; the app never depends on a source format.
