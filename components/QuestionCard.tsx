'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Grade, Question } from '@/lib/types';

const VERDICT_STYLES: Record<Grade['verdict'], { badge: string; text: string }> = {
  correct: { badge: 'bg-good-soft text-good', text: 'text-good' },
  partial: { badge: 'bg-accent-soft text-accent-dark', text: 'text-accent-dark' },
  incorrect: { badge: 'bg-bad-soft text-bad', text: 'text-bad' },
  unanswered: { badge: 'bg-border text-ink-soft', text: 'text-ink-soft' },
};

export function QuestionCard({
  index,
  question,
  grade,
  hasAnswer,
  selected,
  expanded,
  onSelect,
  onToggleExpand,
}: {
  index: number;
  question: Question;
  grade: Grade | undefined;
  hasAnswer: boolean;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}) {
  const verdictStyle = grade ? VERDICT_STYLES[grade.verdict] : VERDICT_STYLES.unanswered;

  return (
    <div
      className={`rounded-2xl border bg-card transition ${
        selected ? 'border-accent shadow-sm ring-1 ring-accent/30' : 'border-border'
      }`}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 p-4 text-left">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
            selected ? 'bg-accent' : 'bg-ink'
          }`}
        >
          {index}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-ink">
          {question.text}
          {!hasAnswer && (
            <span className="ml-2 rounded-full bg-bad-soft px-2 py-0.5 text-[10px] font-semibold text-bad">
              Not answered
            </span>
          )}
        </span>
        {grade && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${verdictStyle.badge}`}>
            {grade.awarded}/{grade.max}
          </span>
        )}
        <span
          role="button"
          aria-label="Toggle feedback"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="mt-0.5 shrink-0 text-ink-soft hover:text-ink"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && grade && (
        <div className="mx-4 mb-4 rounded-xl bg-paper p-3">
          <p className="text-xs font-bold text-ink">AI Feedback</p>
          <p className="mt-1 text-sm text-ink-soft">{grade.feedback}</p>
          {grade.keyPointsMissed.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-ink-soft">
              {grade.keyPointsMissed.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
