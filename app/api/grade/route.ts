import { NextRequest, NextResponse } from 'next/server';
import { dataUrlToPart, generateJson, type GeminiPart } from '@/lib/gemini';
import {
  GRADING_INSTRUCTION,
  GRADING_SCHEMA,
  SUMMARY_INSTRUCTION,
  SUMMARY_SCHEMA,
} from '@/lib/prompts';
import { computeRegions } from '@/lib/regions';
import { cropRegion } from '@/lib/crop';
import { serverLog, timed } from '@/lib/log';
import type { AnswerBlock, Grade, GradingSummary, OcrLine, PageImage, Question } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  questions: Question[];
  blocks: AnswerBlock[];
  lines: OcrLine[];
  pageImages: PageImage[];
};

// Output-token budget (maxOutputTokens=8192) is the only real ceiling here —
// each graded question's JSON is small, so a much larger batch than 4 still
// fits comfortably, and every batch saved is a call not spent against a
// free-tier key's small *daily* request cap.
const BATCH_SIZE = 15;
const VISUAL_HINTS = /diagram|draw|label|graph|sketch|equation|reaction|structure|chart|plot/i;

export async function POST(req: NextRequest) {
  try {
    const { questions, blocks, lines, pageImages } = (await req.json()) as Body;
    serverLog(`/api/grade: ${questions.length} question(s), ${pageImages.length} page image(s)`);

    const lineById = new Map(lines.map((l) => [l.id, l]));
    const blockByQuestion = new Map(blocks.filter((b) => b.questionId).map((b) => [b.questionId!, b]));
    const pageByIndex = new Map(pageImages.map((p) => [p.index, p]));

    const items = await Promise.all(
      questions.map(async (q) => {
        const block = blockByQuestion.get(q.id);
        const answerText = block
          ? block.lineIds
              .map((id) => lineById.get(id)?.text)
              .filter(Boolean)
              .join('\n')
          : '';

        let image: GeminiPart | null = null;
        if (block && VISUAL_HINTS.test(q.text)) {
          const regions = computeRegions(block.lineIds, lineById);
          const first = regions[0];
          const page = first ? pageByIndex.get(first.page) : undefined;
          if (first && page) {
            try {
              const dataUrl = await cropRegion(first, page);
              image = dataUrlToPart(dataUrl);
            } catch (err) {
              console.error('crop failed, falling back to text', err);
            }
          }
        }

        return { question: q, answerText, image };
      }),
    );

    serverLog(`/api/grade: ${items.filter((i) => i.image).length} question(s) will use an image crop`);

    const grades: Grade[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      try {
        const batchGrades = await timed(`gradeBatch(${i}-${i + batch.length - 1})`, () => gradeBatch(batch));
        grades.push(...batchGrades);
      } catch (err) {
        // One batch failing (model glitch, transient error) shouldn't lose every
        // grade already computed for the rest of the paper.
        serverLog(`gradeBatch(${i}-${i + batch.length - 1}) FAILED, marking ungraded`, err instanceof Error ? err.message : err);
        grades.push(...batch.map(({ question }) => ungradedFallback(question)));
      }
    }

    const summary = await timed('buildSummary', () => buildSummary(grades));

    serverLog(`/api/grade: done — ${summary.totalAwarded}/${summary.totalMax} (${summary.percentage}%)`);
    return NextResponse.json({ grades, summary });
  } catch (err) {
    console.error('grade route failed', err);
    const message = err instanceof Error ? err.message : 'Grading failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function gradeBatch(
  batch: { question: Question; answerText: string; image: GeminiPart | null }[],
): Promise<Grade[]> {
  const parts: GeminiPart[] = [];
  const summaryPayload = batch.map(({ question, answerText, image }, i) => ({
    questionId: question.id,
    questionText: question.text,
    maxMarks: question.marks ?? 2,
    studentAnswer: answerText || '(no answer found)',
    hasImage: Boolean(image),
    imageIndex: image ? i : null,
  }));

  parts.push({ text: JSON.stringify({ items: summaryPayload }) });
  for (const { image, question } of batch) {
    if (image) {
      parts.push({ text: `Image crop for question ${question.id}:` });
      parts.push(image);
    }
  }

  const { grades } = await generateJson<{ grades: Grade[] }>({
    systemInstruction: GRADING_INSTRUCTION,
    parts,
    schema: GRADING_SCHEMA,
  });

  const byId = new Map(grades.map((g) => [g.questionId, g]));
  return batch.map(({ question }) => {
    const g = byId.get(question.id);
    const max = question.marks ?? 2;
    if (!g) {
      return {
        questionId: question.id,
        awarded: 0,
        max,
        verdict: 'unanswered',
        feedback: 'No answer found for this question.',
        keyPointsMissed: [],
      };
    }
    return { ...g, max, awarded: Math.max(0, Math.min(g.awarded, max)) };
  });
}

function ungradedFallback(question: Question): Grade {
  return {
    questionId: question.id,
    awarded: 0,
    max: question.marks ?? 2,
    verdict: 'unanswered',
    feedback: 'Grading failed for this question — please retry.',
    keyPointsMissed: [],
  };
}

async function buildSummary(grades: Grade[]): Promise<GradingSummary> {
  const totalAwarded = grades.reduce((sum, g) => sum + g.awarded, 0);
  const totalMax = grades.reduce((sum, g) => sum + g.max, 0);
  const percentage = totalMax > 0 ? Math.round((totalAwarded / totalMax) * 100) : 0;

  try {
    const { strengths, improvements, overallFeedback } = await generateJson<{
      strengths: string[];
      improvements: string[];
      overallFeedback: string;
    }>({
      systemInstruction: SUMMARY_INSTRUCTION,
      parts: [
        {
          text: JSON.stringify({
            totalAwarded,
            totalMax,
            percentage,
            grades: grades.map((g) => ({
              questionId: g.questionId,
              verdict: g.verdict,
              feedback: g.feedback,
              keyPointsMissed: g.keyPointsMissed,
            })),
          }),
        },
      ],
      schema: SUMMARY_SCHEMA,
    });
    return { totalAwarded, totalMax, percentage, strengths, improvements, overallFeedback };
  } catch (err) {
    console.error('summary generation failed, using fallback', err);
    return {
      totalAwarded,
      totalMax,
      percentage,
      strengths: [],
      improvements: [],
      overallFeedback: `Scored ${totalAwarded}/${totalMax} (${percentage}%).`,
    };
  }
}
