'use client';

import { useState } from 'react';
import { ArrowRight, Clock, CloudLightning, Settings, SquareCheck } from 'lucide-react';
import { FileDropCard } from './FileDropCard';

// Four tiny orbiting badges scattered around the avatar circle's edge —
// position is each badge's own center, as % of the circle's box, taken from
// the design file's absolute coordinates (not evenly spaced compass points).
const ORBIT_BADGES = [
  { Icon: SquareCheck, left: '13.3%', top: '37.7%' },
  { Icon: CloudLightning, left: '85.9%', top: '64.8%' },
  { Icon: Clock, left: '64.6%', top: '14.3%' },
  { Icon: Settings, left: '33.5%', top: '85.7%' },
];

export function UploadScreen({
  onStart,
}: {
  onStart: (questionFile: File, answerFile: File) => void;
}) {
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);

  const ready = Boolean(questionFile && answerFile);

  return (
    <div className="flex flex-1 flex-col items-center overflow-auto px-4 py-10 lg:px-8">
      <div className="m-auto w-full max-w-4xl text-center">
        <h1 className="text-[28px] font-bold leading-9 text-ink lg:whitespace-nowrap lg:text-[40px] lg:leading-12">
          Upload{' '}
          <span className="text-ink lg:rounded-lg lg:bg-[rgba(255,147,80,0.15)] lg:px-2 lg:py-1 lg:text-accent-dark lg:underline lg:decoration-2 lg:underline-offset-4">
            Question Paper &amp; Answer Sheets
          </span>
        </h1>
        <p className="mt-4 hidden text-xl text-ink lg:block">Upload both files to get started</p>

        {/* The avatar's glow is two soft, mostly-transparent orange discs
            (10% and 26% opacity in the source), not a solid orange fill —
            layered under a plain white disc that the photo sits on. */}
        <div className="relative mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-full bg-[rgba(255,86,35,0.10)] lg:mt-8 lg:h-40 lg:w-40">
          <div className="absolute inset-1 rounded-full bg-[rgba(255,86,35,0.26)] lg:inset-2" />
          <div className="absolute inset-3 rounded-full bg-white lg:inset-4" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/teacher-illustration.png"
            alt=""
            className="relative h-21 w-21 rounded-full object-cover lg:h-30 lg:w-30"
          />
          {/* The 4 badges orbit as one rigid group — the whole cluster spins
              continuously, rather than each icon rotating in place. */}
          <div className="absolute inset-0 animate-orbit-spin">
            {ORBIT_BADGES.map(({ Icon, left, top }, i) => (
              <span
                key={i}
                className="absolute flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-linear-to-br from-[#fb975d] to-[#fc5e24]"
                style={{ left, top }}
              >
                <Icon size={7} className="text-white" strokeWidth={2.5} />
              </span>
            ))}
          </div>
        </div>

        {/* This wrapping panel is itself a translucent white card (50%
            opacity in the source) sitting on the page gradient — a second,
            softer layer behind the two individually-opaque file-drop cards. */}
        <div className="mt-10 rounded-3xl bg-white/50 p-3">
          <div className="flex flex-col gap-4 sm:flex-row">
            <FileDropCard
              label="Question Paper"
              highlightedWord="Question Paper"
              file={questionFile}
              onChange={setQuestionFile}
            />
            <FileDropCard
              label="Answer Sheet"
              highlightedWord="Answer Sheet"
              file={answerFile}
              onChange={setAnswerFile}
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!ready}
          onClick={() => ready && onStart(questionFile!, answerFile!)}
          className={`mt-8 inline-flex items-center gap-2 rounded-full border-2 border-white bg-[#303030] py-3 pl-6 pr-5 text-sm font-medium text-white shadow-[0_4px_5px_rgba(0,0,0,0.12)] transition-opacity duration-200 ${
            ready ? 'opacity-100 hover:opacity-90' : 'cursor-not-allowed opacity-25'
          }`}
        >
          Start Mapping
          <ArrowRight size={16} />
        </button>
        <p className="mt-3 text-sm text-ink-soft/80">
          Once both files are uploaded, you&apos;ll be able to map answers with questions
        </p>
      </div>
    </div>
  );
}
