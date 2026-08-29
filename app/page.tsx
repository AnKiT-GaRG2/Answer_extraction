'use client';

import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { UploadScreen } from '@/components/UploadScreen';
import { ExtractingScreen } from '@/components/ExtractingScreen';
import { ResultsScreen } from '@/components/ResultsScreen';
import { extractTextLayer, rasterizeAnswerSheet, rasterizeFile } from '@/lib/pdf';
import { mapWithConcurrency } from '@/lib/concurrency';
import { DAILY_QUOTA_ERROR_PREFIX, type AnswerBlock, type Grade, type GradingSummary, type OcrLine, type PageImage, type Question } from '@/lib/types';

const OCR_CONCURRENCY = 4;
// Batching pages into one Gemini call each (instead of one call per page)
// matters because a free-tier key's binding limit is usually a small
// *daily* request cap, not requests-per-minute.
const OCR_BATCH_SIZE = 4;

type Stage = 'upload' | 'extracting' | 'results' | 'error';

function logStage(label: string, data: unknown) {
  console.groupCollapsed(`%c[VedaAI] ${label}`, 'color: #ff5623; font-weight: bold');
  console.log(data);
  console.groupEnd();
}

export default function Home() {
  const [stage, setStage] = useState<Stage>('upload');
  const [stageLabel, setStageLabel] = useState('This may take a while');
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answerPages, setAnswerPages] = useState<PageImage[]>([]);
  const [lines, setLines] = useState<OcrLine[]>([]);
  const [blocks, setBlocks] = useState<AnswerBlock[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [summary, setSummary] = useState<GradingSummary | null>(null);

  async function runPipeline(questionFile: File, answerFile: File) {
    setStage('extracting');
    setError(null);
    try {
      setStageLabel('Reading the answer sheet…');
      const answerPageResults = await rasterizeAnswerSheet(answerFile);
      const pages = answerPageResults.map((r) => r.page);
      setAnswerPages(pages);
      logStage(
        'Rasterized answer sheet',
        answerPageResults.map((r) => ({
          page: r.page.index,
          width: r.page.width,
          height: r.page.height,
          source: r.textLines ? 'text layer (no OCR needed)' : 'needs OCR',
        })),
      );

      const textLayerLines = answerPageResults.flatMap((r) => r.textLines ?? []);
      const pagesNeedingOcr = answerPageResults.filter((r) => r.textLines === null).map((r) => r.page);
      logStage(
        `Answer sheet: ${textLayerLines.length} line(s) from the text layer, ${pagesNeedingOcr.length}/${pages.length} page(s) need OCR`,
        { textLayerPages: pages.length - pagesNeedingOcr.length, ocrPages: pagesNeedingOcr.length },
      );

      // Question extraction and answer-sheet OCR are independent (only mapping needs
      // both), so run them concurrently instead of back-to-back — they share the same
      // rate-limited Gemini queue, so this doesn't exceed quota, it just avoids leaving
      // that queue idle during one stage while the other has nothing to do.
      let questionsDone = false;
      let ocrProgress = { done: 0, total: pagesNeedingOcr.length };
      const updateCombinedLabel = () => {
        const qPart = questionsDone ? 'questions ✓' : 'questions…';
        const ocrPart =
          pagesNeedingOcr.length > 0 ? `answers ${ocrProgress.done}/${ocrProgress.total}` : 'answers ✓';
        setStageLabel(`Extracting ${qPart} · Reading ${ocrPart}`);
      };
      updateCombinedLabel();

      const [extractedQuestions, ocrLines] = await Promise.all([
        extractQuestions(questionFile).then((qs) => {
          questionsDone = true;
          updateCombinedLabel();
          logStage('Extracted questions', qs);
          return qs;
        }),
        pagesNeedingOcr.length > 0
          ? ocrAllPages(pagesNeedingOcr, (done, total) => {
              ocrProgress = { done, total };
              updateCombinedLabel();
            })
          : Promise.resolve([]),
      ]);
      setQuestions(extractedQuestions);

      const extractedLines = [...textLayerLines, ...ocrLines];
      setLines(extractedLines);
      logStage('All answer lines', extractedLines);

      setStageLabel('Mapping answers to questions…');
      const mappedBlocks = await mapAnswers(extractedQuestions, extractedLines);
      setBlocks(mappedBlocks);
      logStage('Mapped answer blocks', mappedBlocks);

      setStageLabel('Grading…');
      const { grades: newGrades, summary: newSummary } = await gradeAnswers(
        extractedQuestions,
        mappedBlocks,
        extractedLines,
        pages,
      );
      setGrades(newGrades);
      setSummary(newSummary);
      logStage('Grades', newGrades);
      logStage('Summary', newSummary);

      setStage('results');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('error');
    }
  }

  return (
    <AppShell>
      {stage === 'upload' && <UploadScreen onStart={runPipeline} />}
      {stage === 'extracting' && <ExtractingScreen stageLabel={stageLabel} />}
      {stage === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-lg font-semibold text-ink">Something went wrong</p>
          <p className="max-w-md text-sm text-ink-soft">{error}</p>
          <button
            onClick={() => setStage('upload')}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      )}
      {stage === 'results' && summary && (
        <ResultsScreen
          questions={questions}
          answerPages={answerPages}
          lines={lines}
          blocks={blocks}
          grades={grades}
        />
      )}
    </AppShell>
  );
}

async function extractQuestions(questionFile: File): Promise<Question[]> {
  const textPages = await extractTextLayer(questionFile);
  const meaningfulText =
    textPages && textPages.length > 0 && textPages.every((t) => t.trim().length > 50 / textPages.length);

  if (meaningfulText && textPages) {
    const res = await postJson('/api/questions', { mode: 'text', pages: textPages });
    return res.questions;
  }

  const pages = await rasterizeFile(questionFile);
  const res = await postJson('/api/questions', {
    mode: 'image',
    pages: pages.map((p) => ({ dataUrl: p.dataUrl })),
  });
  return res.questions;
}

const OCR_PAGE_ATTEMPTS = 2;

async function ocrAllPages(
  pages: PageImage[],
  onProgress?: (done: number, total: number) => void,
): Promise<OcrLine[]> {
  let done = 0;
  const batches: PageImage[][] = [];
  for (let i = 0; i < pages.length; i += OCR_BATCH_SIZE) {
    batches.push(pages.slice(i, i + OCR_BATCH_SIZE));
  }
  console.log(
    `%c[VedaAI] OCR: starting ${pages.length} page(s) in ${batches.length} batch(es) of up to ${OCR_BATCH_SIZE}, up to ${OCR_CONCURRENCY} batch(es) at once`,
    'color: #ff5623; font-weight: bold',
  );

  const results = await mapWithConcurrency(batches, OCR_CONCURRENCY, async (batch) => {
    const start = performance.now();
    const label = batch.map((p) => p.index).join(',');
    for (let attempt = 1; attempt <= OCR_PAGE_ATTEMPTS; attempt++) {
      try {
        const res = await postJson('/api/ocr', {
          pages: batch.map((p) => ({ pageIndex: p.index, dataUrl: p.dataUrl })),
        });
        const lines = res.lines as OcrLine[];
        console.log(
          `%c[VedaAI] OCR pages ${label}: ${lines.length} line(s) in ${((performance.now() - start) / 1000).toFixed(1)}s`,
          'color: #2f9e44',
        );
        done += batch.length;
        onProgress?.(done, pages.length);
        return lines;
      } catch (err) {
        // A daily-quota exhaustion isn't a one-off glitch on this batch —
        // every remaining batch is guaranteed to hit the same wall, so
        // surface it immediately instead of quietly returning "no answers
        // found" for the whole answer sheet.
        if (err instanceof Error && err.message.startsWith(DAILY_QUOTA_ERROR_PREFIX)) throw err;
        console.error(`[VedaAI] OCR pages ${label} failed (attempt ${attempt}/${OCR_PAGE_ATTEMPTS})`, err);
      }
    }
    // A batch that never OCRs cleanly (e.g. a persistent timeout) shouldn't
    // take down the whole pipeline — its answers just won't be found, same
    // as if the student left those pages blank.
    done += batch.length;
    onProgress?.(done, pages.length);
    return [] as OcrLine[];
  });
  return results.flat();
}

async function mapAnswers(questions: Question[], lines: OcrLine[]): Promise<AnswerBlock[]> {
  const res = await postJson('/api/map', { questions, lines });
  return res.blocks;
}

async function gradeAnswers(
  questions: Question[],
  blocks: AnswerBlock[],
  lines: OcrLine[],
  pageImages: PageImage[],
): Promise<{ grades: Grade[]; summary: GradingSummary }> {
  const res = await postJson('/api/grade', { questions, blocks, lines, pageImages });
  return { grades: res.grades, summary: res.summary };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `${url} failed (${res.status})`);
  }
  return res.json();
}
