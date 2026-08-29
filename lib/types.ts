// Shared data model for the extraction -> OCR -> mapping -> grading pipeline.
// See project README for the pipeline overview.

// The prefix of the Error thrown by lib/gemini.ts (server-only) when a
// free-tier key's daily request cap is exhausted. Lives here — a plain
// data/constants module — rather than in lib/gemini.ts itself, so client
// components (e.g. app/page.tsx) can recognize this specific, unrecoverable
// failure by its message without importing lib/gemini.ts, which throws at
// module load if GEMINI_API_KEY isn't set (fine on the server, fatal if
// ever bundled into client code).
export const DAILY_QUOTA_ERROR_PREFIX = 'Daily free-tier quota exhausted';

export type PageImage = {
  index: number; // 0-based
  dataUrl: string; // rendered ~1600px wide JPEG data URL
  width: number; // px, matches what OCR received
  height: number;
};

export type Question = {
  id: string; // "q_11a"
  label: string; // "11 (a)" — original numbering, verbatim
  order: number; // printed sequence, 0..n
  text: string;
  marks: number | null;
  groupLabel: string | null; // the parent question's label, if this is a sub-part — e.g. "7" for
  // sub-part "I", so identically-labelled sub-parts of different questions ("I" under both 7 and 8)
  // don't collide. Internal structure only — `label` stays exactly as printed either way.
};

export type OcrLine = {
  id: string; // "p2_l14" — the only handle the LLM gets
  page: number; // 0-based
  text: string;
  box: { x: number; y: number; w: number; h: number }; // % of page, 0..100
};

export type AnswerBlock = {
  questionId: string | null; // null = orphan answer
  lineIds: string[];
  confidence: number; // 0..1
  detectedLabel: string | null; // "Q11(a)" if student wrote one
};

export type Grade = {
  questionId: string;
  awarded: number;
  max: number;
  verdict: 'correct' | 'partial' | 'incorrect' | 'unanswered';
  feedback: string;
  keyPointsMissed: string[];
};

export type GradingSummary = {
  totalAwarded: number;
  totalMax: number;
  percentage: number;
  strengths: string[];
  improvements: string[];
  overallFeedback: string;
};

export type Region = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PipelineResult = {
  questions: Question[];
  answerPages: PageImage[];
  lines: OcrLine[];
  blocks: AnswerBlock[];
  grades: Grade[];
  summary: GradingSummary;
};
