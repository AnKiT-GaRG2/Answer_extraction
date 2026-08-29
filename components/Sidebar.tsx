'use client';

import { PanelLeft } from 'lucide-react';
import { Logo } from './Logo';
import { NavContent } from './NavContent';

export function Sidebar() {
  return (
    <aside className="hidden w-76 shrink-0 flex-col rounded-2xl bg-card px-6 py-6 shadow-[0_32px_48px_rgba(0,0,0,0.20),0_16px_48px_rgba(0,0,0,0.12)] lg:flex">
      <div className="flex items-center justify-between">
        <Logo />
        <button aria-label="Collapse sidebar" className="flex h-5 w-5 items-center justify-center text-ink-soft hover:text-ink">
          <PanelLeft size={20} />
        </button>
      </div>
      <div className="mt-8 flex flex-1 flex-col">
        <NavContent />
      </div>
    </aside>
  );
}
