'use client';

import { useMemo, useState } from 'react';
import type { AnswerBlock, Grade, OcrLine, PageImage, Question } from '@/lib/types';
import { QuestionCard } from './QuestionCard';
import { AnswerSheetViewer } from './AnswerSheetViewer';

type Tab = 'questions' | 'answers';

export function ResultsScreen({
  questions,
  answerPages,
  lines,
  blocks,
  grades,
}: {
  questions: Question[];
  answerPages: PageImage[];
  lines: OcrLine[];
  blocks: AnswerBlock[];
  grades: Grade[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(questions[0]?.id ?? null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(questions[0] ? [questions[0].id] : []),
  );
  const [expandAll, setExpandAll] = useState(false);
  const [tab, setTab] = useState<Tab>('questions');

  const gradeByQuestion = useMemo(() => new Map(grades.map((g) => [g.questionId, g])), [grades]);
  const answeredQuestionIds = useMemo(
    () => new Set(blocks.filter((b) => b.questionId).map((b) => b.questionId as string)),
    [blocks],
  );
  const orphanBlocks = useMemo(() => blocks.filter((b) => b.questionId === null), [blocks]);

  function selectQuestion(id: string) {
    setSelectedId(id);
    setExpandedIds((prev) => new Set(prev).add(id));
    setTab('answers');
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const questionsPane = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        <h2 className="text-sm font-semibold text-ink">Extracted Questions (from question paper)</h2>
        <button
          onClick={() => setExpandAll((v) => !v)}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
        >
          {expandAll ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-auto px-4 pb-6 lg:px-6">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i + 1}
            question={q}
            grade={gradeByQuestion.get(q.id)}
            hasAnswer={answeredQuestionIds.has(q.id)}
            selected={selectedId === q.id}
            expanded={expandAll || expandedIds.has(q.id)}
            onSelect={() => selectQuestion(q.id)}
            onToggleExpand={() => toggleExpand(q.id)}
          />
        ))}

        {orphanBlocks.length > 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-4">
            <p className="text-sm font-semibold text-ink">Unmatched answers</p>
            <p className="mt-1 text-xs text-ink-soft">
              These lines on the answer sheet didn&apos;t match any question — rough work or stray
              notes.
            </p>
            <button
              onClick={() => {
                setSelectedId(null);
                setTab('answers');
              }}
              className="mt-2 rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink hover:bg-border/60"
            >
              View on answer sheet
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const answersPane = (
    <AnswerSheetViewer
      pages={answerPages}
      lines={lines}
      blocks={blocks}
      questions={questions}
      selectedQuestionId={selectedId}
    />
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* mobile tabs */}
      <div className="mx-4 mt-4 flex gap-1 rounded-full bg-card p-1 lg:hidden">
        <button
          onClick={() => setTab('questions')}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
            tab === 'questions' ? 'bg-ink text-white' : 'text-ink-soft'
          }`}
        >
          Questions
        </button>
        <button
          onClick={() => setTab('answers')}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
            tab === 'answers' ? 'bg-ink text-white' : 'text-ink-soft'
          }`}
        >
          Answer Sheet
        </button>
      </div>

      <div className="mt-4 flex flex-1 overflow-hidden lg:mx-8 lg:mb-6 lg:gap-4 lg:rounded-2xl">
        <div className={`min-w-0 flex-1 lg:block lg:max-w-md ${tab === 'questions' ? 'block' : 'hidden'}`}>
          {questionsPane}
        </div>
        <div
          className={`min-w-0 flex-1 rounded-2xl border border-border bg-card lg:block ${
            tab === 'answers' ? 'block' : 'hidden'
          }`}
        >
          {answersPane}
        </div>
      </div>
    </div>
  );
}
