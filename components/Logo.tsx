'use client';

import { useState } from 'react';

/**
 * Renders /public/vedaAI_logo.avif if present, otherwise falls back to a text
 * badge so the app looks right before a real logo file is dropped in.
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);

  const size = compact ? 'h-8 w-8' : 'h-10 w-10';

  return (
    <div className="flex items-center gap-2">
      {!imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/vedaAI_logo.avif"
          alt="VedaAI"
          className={`${size} rounded-lg object-contain`}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className={`flex ${size} items-center justify-center rounded-lg bg-ink text-sm font-bold text-white`}>
          V
        </span>
      )}
      {!compact && <span className="text-[28px] font-bold tracking-[-0.06em] text-ink">VedaAI</span>}
    </div>
  );
}
