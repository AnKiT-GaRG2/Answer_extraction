import { NextRequest, NextResponse } from 'next/server';
import { dataUrlToPart, generateJson, isQuotaExhaustedError } from '@/lib/gemini';
import { QUESTION_EXTRACTION_INSTRUCTION, QUESTION_SCHEMA } from '@/lib/prompts';
import { serverLog, timed } from '@/lib/log';
import type { Question } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body =
  | { mode: 'text'; pages: string[] }
  | { mode: 'image'; pages: { dataUrl: string }[] };

type RawQuestion = Omit<Question, 'id'>;

const MIN_CHARS_PER_PAGE = 50;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    let questions: Question[];
    if (body.mode === 'text' && hasMeaningfulText(body.pages)) {
      serverLog(`/api/questions: text mode, ${body.pages.length} page(s)`);
      questions = await timed('extractFromText', () => extractFromText(body.pages));
    } else if (body.mode === 'image') {
      serverLog(`/api/questions: image mode, ${body.pages.length} page(s)`);
      questions = await timed('extractFromImages', () => extractFromImages(body.pages.map((p) => p.dataUrl)));
    } else {
      serverLog('/api/questions: rejected — no usable content', body);
      return NextResponse.json({ error: 'No usable question paper content' }, { status: 422 });
    }

    serverLog(`/api/questions: extracted ${questions.length} question(s)`, questions.map((q) => q.label));
    return NextResponse.json({ questions });
  } catch (err) {
    console.error('questions route failed', err);
    const message = err instanceof Error ? err.message : 'Question extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function hasMeaningfulText(pages: string[]): boolean {
  return pages.length > 0 && pages.every((p) => p.trim().length > MIN_CHARS_PER_PAGE / pages.length);
}

// Free-tier Gemini keys can cap total *daily* requests as low as 20 for a
// model, not just requests-per-minute — every call here counts against that
// budget. Batching several pages into one call (instead of one call per
// page) is what actually keeps a multi-page paper affordable and fast; a
// paper with more pages than this still gets one call per batch, not one
// per page.
const PAGE_BATCH_SIZE = 5;

async function extractFromText(pages: string[]): Promise<Question[]> {
  let precedingContext = '';
  let currentGroupLabel: string | null = null;
  const allQuestions: RawQuestion[] = [];
  let orderOffset = 0;

  const BATCH_ATTEMPTS = 3;

  for (let i = 0; i < pages.length; i += PAGE_BATCH_SIZE) {
    const batch = pages.slice(i, i + PAGE_BATCH_SIZE);
    const batchLabel = `pages ${i + 1}-${i + batch.length}/${pages.length}`;
    let questions: RawQuestion[] | null = null;

    for (let attempt = 1; attempt <= BATCH_ATTEMPTS && questions === null; attempt++) {
      try {
        const result = await timed(`extractFromText: ${batchLabel} (attempt ${attempt}/${BATCH_ATTEMPTS})`, () =>
          generateJson<{ questions: RawQuestion[] }>({
            systemInstruction: QUESTION_EXTRACTION_INSTRUCTION,
            parts: [{ text: JSON.stringify({ precedingContext, currentGroupLabel, pages: batch }) }],
            schema: QUESTION_SCHEMA,
          }),
        );
        questions = result.questions;
      } catch (err) {
        // A daily-quota exhaustion isn't a one-off glitch — every remaining
        // attempt and batch is guaranteed to hit the same wall, so surface it
        // immediately instead of quietly grinding through retries and
        // batches only to return an empty (and misleadingly "successful")
        // question list.
        if (isQuotaExhaustedError(err)) throw err;
        // A model repetition glitch on this batch is usually not
        // reproducible — a few independent attempts (each with its own
        // temperature-driven variation) is enough to get a clean parse most
        // of the time, without losing every question in the batch.
        serverLog(
          `extractFromText: ${batchLabel} attempt ${attempt}/${BATCH_ATTEMPTS} FAILED`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (questions) {
      for (const q of questions) {
        allQuestions.push({ ...q, order: orderOffset + q.order });
        if (q.groupLabel === null) currentGroupLabel = q.label;
      }
      orderOffset = allQuestions.length;
    } else {
      serverLog(`extractFromText: ${batchLabel} FAILED after ${BATCH_ATTEMPTS} attempts, skipping it`);
    }
    precedingContext = batch[batch.length - 1].slice(-400);
  }

  // A real question paper always has at least one question — coming back
  // empty means every batch failed, not that the paper was blank. Treating
  // that as success left the whole pipeline silently grading "0 questions"
  // instead of telling the user extraction failed.
  if (allQuestions.length === 0 && pages.length > 0) {
    throw new Error('No questions could be extracted from the question paper — every page failed to process.');
  }

  return assignIds(allQuestions);
}

async function extractFromImages(dataUrls: string[]): Promise<Question[]> {
  const parts = dataUrls.map(dataUrlToPart);
  const { questions } = await generateJson<{ questions: RawQuestion[] }>({
    systemInstruction: QUESTION_EXTRACTION_INSTRUCTION,
    parts: [{ text: 'Here is the full question paper, one image per page, in order.' }, ...parts],
    schema: QUESTION_SCHEMA,
  });

  return assignIds(questions);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20);
}

/** Builds a unique id per question, scoped by groupLabel so e.g. two sub-parts both printed "I" under different parents don't collide. */
function assignIds(questions: RawQuestion[]): Question[] {
  const withIds = questions.map((q) => {
    const base = q.groupLabel ? `${slug(q.groupLabel)}_${slug(q.label)}` : slug(q.label);
    return { ...q, id: `q_${base || 'x'}` };
  });

  const seen = new Map<string, number>();
  return withIds.map((q) => {
    const count = seen.get(q.id) ?? 0;
    seen.set(q.id, count + 1);
    return count === 0 ? q : { ...q, id: `${q.id}_${count}` };
  });
}
