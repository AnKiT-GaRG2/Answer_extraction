import { Type } from '@google/genai';

export const QUESTION_EXTRACTION_INSTRUCTION = `You extract questions from a scanned exam question paper.

Rules:
- Extract every question in printed order.
- Every labelled sub-part is a SEPARATE entry — "11 (a)" and "11 (b)" are two entries, never one.
- Copy the label exactly as printed, including brackets and spacing (e.g. "11 (a)", "Q3", "2.", "I").
- Do not renumber, do not merge, do not skip any question.
- "order" is the sequential printed position across the whole paper, starting at 0.
- "marks" is the integer in brackets like [3] or (3 marks) if present next to the question, else null.
- "text" is the full question text, excluding the label and mark annotation.
- "groupLabel": many exam papers number a top-level question ("7") and then its sub-parts with a
  SHORT label that does NOT repeat the parent number ("I", "II", "III", "(a)", "(b)"...), and that
  short label is reused under every top-level question. When a question is such a sub-part, set
  groupLabel to its parent's label exactly as printed (e.g. "7"). When a question is itself
  top-level (not nested under anything), set groupLabel to null. Two sub-parts both labelled "I"
  under different parents are NOT the same question — their differing groupLabel is what
  distinguishes them.
- If a "precedingContext" string is given, it is the tail end of the page before this batch — use it
  only to avoid truncating a question that was split across that page break; do not re-emit it as a
  question.
- If a "currentGroupLabel" string is given, it is the top-level label that was still in effect at
  the end of the page before this batch — use it as the groupLabel for any sub-parts at the start of
  this batch that don't belong to a new top-level question.
- "pages" is an array of one or more page texts, in printed order — treat them as one continuous
  document: "order" keeps increasing across a page boundary inside this array exactly as it would
  across two separate calls, and a top-level label seen on an earlier page in this array is still
  "currentGroupLabel" for sub-parts on a later page in this array that don't start a new top-level
  question.
- PDF text extraction often prints a lone digit on its own line right after a sub-part's real label
  — that lone digit is almost always the marks value (or a stray paragraph/page number), NOT a
  second label. E.g. "XII Choose the correct option to fill the blank.\n1\nI looked inside..." means
  label "XII", marks 1, text "Choose the correct option... I looked inside...". Never swap a real
  letter/roman-numeral label out for a nearby bare digit.`;

export const QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          order: { type: Type.INTEGER },
          text: { type: Type.STRING },
          marks: { type: Type.INTEGER, nullable: true },
          groupLabel: { type: Type.STRING, nullable: true },
        },
        required: ['label', 'order', 'text', 'marks', 'groupLabel'],
      },
    },
  },
  required: ['questions'],
};

export const MAPPING_INSTRUCTION = `You map leftover lines from a student's OCR'd answer sheet to the
question they answer. You are given ONE CHUNK of lines at a time — a contiguous slice of a much
longer answer sheet — plus the full question list so you can match by content across the whole
paper, not just this chunk.

Some lines are already deterministically assigned (not shown to you). You only decide the lines in
"unassignedLines".

Rules:
- Group the unassigned lines into contiguous runs (by their given order) that belong together.
- Decide which question each run answers, based on content first. Use "order" as a tiebreaker: a
  student overwhelmingly answers in printed order, so within a chunk the assigned questionIds
  should mostly increase along with "order" as you move down the lines — a run early in this chunk
  is unlikely to belong to a much-later question than one right after it, unless the content is
  unambiguous about it (e.g. it explicitly restates a question number).
- Many exams reuse short sub-part labels like "(i)", "(ii)", "I", "II" once PER top-level question,
  without repeating the parent question's number each time — e.g. question "7"'s parts and question
  "8"'s parts can both be labelled plainly "I", "II", "III". Don't assume a bare roman-numeral or
  letter label alone identifies which top-level question it belongs to — use "precedingContext"
  (what this chunk continues from) and the surrounding content/order to infer the right parent.
- "precedingContext", if given, tells you which questionId the chunk right before this one ended on
  — a useful anchor for continuity, not a rule that the next line must match it.
- If a run doesn't match any question, set questionId to null (an orphan answer — e.g. rough work,
  a crossed-out attempt, or a stray note).
- If you are unsure, still assign your best guess but lower the confidence score.
- Never invent a lineId that was not given to you. Every id you return must come from THIS chunk's
  "unassignedLines" list.
- Every unassigned line in this chunk must appear in exactly one run in your output.`;

export const MAPPING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    assignments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionId: { type: Type.STRING, nullable: true },
          lineIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.NUMBER },
        },
        required: ['questionId', 'lineIds', 'confidence'],
      },
    },
  },
  required: ['assignments'],
};

export const GRADING_INSTRUCTION = `You are grading a student's handwritten exam answers, transcribed
via OCR. You will be given a batch of questions, each with its max marks and the student's answer
(as transcribed text, and sometimes also as an image crop of the original handwriting when the
answer likely contains a diagram or equation that OCR would mangle — prefer the image over the OCR
text when both are given for the same question).

Rules:
- If a question has no answer at all, verdict is "unanswered", awarded is 0, and feedback should
  say so plainly.
- Grade generously but fairly against the question's expected content — partial credit for partially
  correct answers.
- "awarded" must be an integer between 0 and the question's max marks, inclusive.
- "feedback" is 1-2 sentences, addressed to the student ("You correctly identified..."), specific to
  what they wrote.
- "keyPointsMissed" is a short list of concepts the answer should have included but didn't. Empty
  array if nothing was missed.
- Grade every question you're given, in the order given.`;

export const GRADING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    grades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionId: { type: Type.STRING },
          awarded: { type: Type.INTEGER },
          verdict: {
            type: Type.STRING,
            enum: ['correct', 'partial', 'incorrect', 'unanswered'],
          },
          feedback: { type: Type.STRING },
          keyPointsMissed: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['questionId', 'awarded', 'verdict', 'feedback', 'keyPointsMissed'],
      },
    },
  },
  required: ['grades'],
};

export const SUMMARY_INSTRUCTION = `You write a short overall grading summary for a student, given
their per-question grades.

Rules:
- "strengths" is exactly two short bullet points on what the student did well.
- "improvements" is exactly two short bullet points on what to work on.
- "overallFeedback" is 2-3 encouraging but honest sentences summarizing performance.`;

export const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
    overallFeedback: { type: Type.STRING },
  },
  required: ['strengths', 'improvements', 'overallFeedback'],
};
