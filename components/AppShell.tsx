'use client';

import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileDrawer } from './MobileDrawer';

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      className="flex h-dvh w-full gap-3 overflow-hidden p-3"
      style={{
        // The design's canvas isn't a flat gradient — two huge, heavily
        // blurred dark ellipses sit low in the frame and wash the bottom
        // edge darker. Reproduced with a radial + vertical gradient rather
        // than actual blurred elements (cheaper, inherently soft-edged);
        // values matched by sampling the real rendered prototype at
        // several points: ~#f3f3f3 at the top fading to ~#cdcbcb at
        // bottom-center, roughly symmetric left-right.
        background:
          'radial-gradient(ellipse 70% 55% at 50% 100%, rgba(40,40,40,0.2), transparent 70%), ' +
          'linear-gradient(180deg, #f5f5f5 0%, #e2dede 100%)',
      }}
    >
      <Sidebar />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
