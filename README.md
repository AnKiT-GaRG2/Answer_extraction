# VedaAI — AI Teacher's Toolkit

Upload a question paper and a student's handwritten answer sheet; the app extracts every
question, reads the student's answers, maps each answer to its question, grades it, and lets a
teacher click any question to see the exact region highlighted on the answer sheet.

## Pipeline

```
[browser] rasterize both files (pdf.js)
    ├─→ POST /api/questions   → questions, in printed order
    └─→ POST /api/ocr         → line-level text + bounding boxes (Gemini vision)
              ↓
        POST /api/map         → each answer mapped to a question (regex anchors + Gemini for the rest)
              ↓
        POST /api/grade       → per-question marks/feedback + an overall summary
```

See `lib/types.ts` for the shared data model and `lib/mapping.ts` / `lib/regions.ts` for the
anchor-detection and highlight-region logic.

## Setup

```bash
npm install
npm run dev
```

Requires a `GEMINI_API_KEY` in `.env.local` (already set up — get your own free-tier key at
https://aistudio.google.com/apikey if you need to rotate it). No other services or database are
needed; everything runs in-memory in the browser tab.

## Adding your logo

Drop your logo file at **`public/vedaAI_logo.avif`** — the sidebar and mobile header already
reference it and will pick it up automatically on the next reload. Until it's there, both fall back
to a plain "V" badge so the app still looks right.

## Notes

- OCR uses Gemini's vision input (not Google Cloud Vision) — it works with just the one API key
  and no billing account, at the cost of slightly less pixel-precise highlight boxes than a
  dedicated OCR service would give.
- Question extraction prefers the question paper's PDF text layer when there is one, and only
  falls back to sending page images to Gemini when the paper has no usable text layer (e.g. a
  scanned image PDF).
- The `/api/grade` route sends full page images for questions whose text hints at a diagram or
  equation; on Vercel's default body-size limits this is fine for a handful of pages, but a very
  long answer sheet may need that route split up before deploying.
