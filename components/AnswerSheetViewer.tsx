'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { computeRegions } from '@/lib/regions';
import type { AnswerBlock, OcrLine, PageImage, Question } from '@/lib/types';

export function AnswerSheetViewer({
  pages,
  lines,
  blocks,
  questions,
  selectedQuestionId,
  onJumpToPage,
}: {
  pages: PageImage[];
  lines: OcrLine[];
  blocks: AnswerBlock[];
  questions: Question[];
  selectedQuestionId: string | null;
  onJumpToPage?: (page: number) => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [lastAutoJumpFor, setLastAutoJumpFor] = useState<string | null>('__unset__');

  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);
  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.questionId === selectedQuestionId) ?? null,
    [blocks, selectedQuestionId],
  );

  const regions = useMemo(
    () => (selectedBlock ? computeRegions(selectedBlock.lineIds, lineById) : []),
    [selectedBlock, lineById],
  );

  const pagesWithRegion = useMemo(() => Array.from(new Set(regions.map((r) => r.page))).sort((a, b) => a - b), [regions]);

  // jump to the first page containing the selected answer whenever selection changes —
  // adjusted during render (React's recommended pattern) rather than in an effect
  if (selectedQuestionId !== lastAutoJumpFor) {
    setLastAutoJumpFor(selectedQuestionId);
    if (regions.length > 0) setPageIndex(regions[0].page);
  }

  const page = pages[pageIndex];
  const regionsOnPage = regions.filter((r) => r.page === pageIndex);
  const selectedQuestion = selectedQuestionId ? questionById.get(selectedQuestionId) : null;

  if (!page) {
    return <div className="flex flex-1 items-center justify-center text-sm text-ink-soft">No pages to show</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Answer Sheet</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-border bg-paper px-2 py-1">
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft hover:text-ink"
            >
              <Minus size={14} />
            </button>
            <span className="w-10 text-center text-xs font-medium text-ink">{zoom}%</span>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft hover:text-ink"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-paper px-1 py-1">
            <button
              aria-label="Previous page"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft hover:text-ink disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-1 text-xs font-medium text-ink">
              Page {pageIndex + 1} of {pages.length}
            </span>
            <button
              aria-label="Next page"
              disabled={pageIndex === pages.length - 1}
              onClick={() => setPageIndex((p) => Math.min(pages.length - 1, p + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft hover:text-ink disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {pagesWithRegion.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-paper/60 px-4 py-2 text-xs text-ink-soft">
          Spans multiple pages:
          {pagesWithRegion.map((p) => (
            <button
              key={p}
              onClick={() => {
                setPageIndex(p);
                onJumpToPage?.(p);
              }}
              className={`rounded-full px-2 py-0.5 font-medium ${
                p === pageIndex ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-accent-soft'
              }`}
            >
              Page {p + 1}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto bg-paper/40 p-4">
        <div
          className="relative mx-auto origin-top bg-white shadow-sm"
          style={{ width: `${zoom}%`, maxWidth: 900 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={page.dataUrl} alt={`Answer sheet page ${pageIndex + 1}`} className="block w-full" />

          {regionsOnPage.map((region, i) => (
            <div
              key={i}
              className="animate-region-pulse absolute rounded-md border-2 border-highlight bg-highlight-soft"
              style={{
                left: `${region.x}%`,
                top: `${region.y}%`,
                width: `${region.w}%`,
                height: `${region.h}%`,
              }}
            >
              {i === 0 && selectedQuestion && (
                <span className="absolute -top-6 left-0 rounded-md bg-highlight px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {selectedQuestion.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
