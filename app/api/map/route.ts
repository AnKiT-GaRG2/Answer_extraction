import { NextRequest, NextResponse } from 'next/server';
import { generateJson } from '@/lib/gemini';
import { MAPPING_INSTRUCTION, MAPPING_SCHEMA } from '@/lib/prompts';
import { buildAnchorBlocks, sanitizeMapping, type LlmAssignment } from '@/lib/mapping';
import { serverLog, timed } from '@/lib/log';
import type { AnswerBlock, OcrLine, Question } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = { questions: Question[]; lines: OcrLine[] };

export async function POST(req: NextRequest) {
  try {
    const { questions, lines } = (await req.json()) as Body;
    serverLog(`/api/map: ${questions.length} question(s), ${lines.length} line(s)`);
    const allLineIds = new Set(lines.map((l) => l.id));
    const lineById = new Map(lines.map((l) => [l.id, l]));

    const anchors = buildAnchorBlocks(lines, questions);
    serverLog(
      `/api/map: anchors matched ${anchors.blocks.size}/${questions.length} question(s), ${anchors.unassignedLineIds.length} line(s) left for the LLM`,
    );

    let llmAssignments: LlmAssignment[] = [];
    if (anchors.unassignedLineIds.length > 0) {
      try {
        llmAssignments = await timed('resolveLeftovers', () =>
          resolveLeftovers(questions, anchors.unassignedLineIds, lineById),
        );
      } catch (err) {
        console.error('mapping LLM step failed, falling back to anchors only', err);
        llmAssignments = [];
      }
    }

    const blocks: AnswerBlock[] = sanitizeMapping({
      questions,
      allLineIds,
      anchors,
      llmAssignments,
    });

    serverLog(
      `/api/map: final blocks — ${blocks.filter((b) => b.questionId).length} answered, ${
        blocks.find((b) => b.questionId === null)?.lineIds.length ?? 0
      } orphan line(s)`,
    );
    return NextResponse.json({ blocks });
  } catch (err) {
    console.error('map route failed', err);
    return NextResponse.json({ error: 'Answer mapping failed' }, { status: 500 });
  }
}

// A single call trying to place hundreds of lines against dozens of candidate
// questions at once reasons poorly (verified empirically — it collapsed onto
// a handful of giant, wrong blocks on a 25-page real answer sheet). Chunking
// keeps each call's decision space small enough to actually get right.
const CHUNK_SIZE = 50;

async function resolveLeftovers(
  questions: Question[],
  unassignedLineIds: string[],
  lineById: Map<string, OcrLine>,
): Promise<LlmAssignment[]> {
  const unassignedLines = unassignedLineIds
    .map((id) => lineById.get(id))
    .filter((l): l is OcrLine => Boolean(l));

  const questionPayload = questions.map((q) => ({
    id: q.id,
    order: q.order,
    label: q.label,
    groupLabel: q.groupLabel,
    text: q.text,
  }));

  const allAssignments: LlmAssignment[] = [];
  let precedingContext: string | null = null;

  for (let i = 0; i < unassignedLines.length; i += CHUNK_SIZE) {
    const chunk = unassignedLines.slice(i, i + CHUNK_SIZE);
    const chunkLines: { id: string; page: number; text: string }[] = chunk.map((l) => ({
      id: l.id,
      page: l.page,
      text: l.text,
    }));
    const payload: {
      questions: typeof questionPayload;
      precedingContext: string | null;
      unassignedLines: typeof chunkLines;
    } = {
      questions: questionPayload,
      precedingContext,
      unassignedLines: chunkLines,
    };

    serverLog(`resolveLeftovers: chunk ${i}-${i + chunk.length - 1} of ${unassignedLines.length}`);
    try {
      const result: { assignments: LlmAssignment[] } = await timed(
        `resolveLeftovers chunk ${i}-${i + chunk.length - 1}`,
        () =>
          generateJson<{ assignments: LlmAssignment[] }>({
            systemInstruction: MAPPING_INSTRUCTION,
            parts: [{ text: JSON.stringify(payload) }],
            schema: MAPPING_SCHEMA,
          }),
      );
      const assignments = result.assignments;
      allAssignments.push(...assignments);
      const last = assignments.at(-1);
      if (last?.questionId) precedingContext = last.questionId;
    } catch (err) {
      // One bad chunk shouldn't lose every other chunk's mapping — its lines
      // just fall through to "orphan" via sanitizeMapping instead.
      serverLog(`resolveLeftovers: chunk ${i}-${i + chunk.length - 1} FAILED, leaving unassigned`, err instanceof Error ? err.message : err);
    }
  }

  return allAssignments;
}
