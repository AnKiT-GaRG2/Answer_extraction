'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { formatBytes, getPageCount } from '@/lib/fileMeta';

const ACCEPTED = '.pdf,application/pdf,image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;

export function FileDropCard({
  label,
  highlightedWord,
  file,
  onChange,
}: {
  label: string;
  highlightedWord: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [pagesFile, setPagesFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reset the stale page count during render when the file identity changes,
  // rather than in an effect — avoids an extra cascading render
  if (file !== pagesFile) {
    setPagesFile(file);
    if (!file) setPages(null);
  }

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    getPageCount(file).then((n) => {
      if (!cancelled) setPages(n);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const acceptFile = useCallback(
    (candidate: File | undefined | null) => {
      if (!candidate) return;
      if (candidate.size > MAX_BYTES) {
        setError('File is larger than 10MB');
        return;
      }
      setError(null);
      onChange(candidate);
    },
    [onChange],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        acceptFile(e.dataTransfer.files?.[0]);
      }}
      className={`flex min-h-44 flex-1 flex-col items-center justify-center rounded-[20px] border-[1.5px] border-dashed bg-card p-6 text-center transition-colors duration-200 ${
        dragOver ? 'border-accent bg-accent-soft/30' : 'border-border'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-4"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f3f3f3]">
            <Upload size={20} className="text-ink" />
          </span>
          <span className="text-xl font-semibold tracking-[-0.06em] text-ink">
            Upload <span className="text-accent underline decoration-2 underline-offset-2">{highlightedWord}</span>
          </span>
          <span className="text-sm tracking-[-0.06em] text-ink-soft/55">Max 10MB</span>
        </button>
      ) : (
        <div className="flex w-full items-center gap-3 rounded-xl bg-[#f6f6f6] p-3 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pdf-icon.png" alt="" className="h-10 w-9 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-ink">{file.name}</p>
            <p className="text-sm text-ink-soft/80">
              {formatBytes(file.size)} · {pages ?? '…'} {pages === 1 ? 'Page' : 'Pages'}
            </p>
          </div>
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={() => onChange(null)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2b2b2b]/80 text-[#efe4dc] shadow-[0_4px_11px_rgba(0,0,0,0.25)] transition-opacity duration-200 hover:opacity-80"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </div>
  );
}
