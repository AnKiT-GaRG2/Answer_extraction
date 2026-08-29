'use client';

import { X } from 'lucide-react';
import { Logo } from './Logo';
import { NavContent } from './NavContent';

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-card px-5 py-6 shadow-xl">
        <div className="flex items-center justify-between">
          <Logo />
          <button onClick={onClose} aria-label="Close menu" className="text-ink-soft hover:text-ink">
            <X size={22} />
          </button>
        </div>
        <div className="mt-8 flex flex-1 flex-col">
          <NavContent />
        </div>
      </aside>
    </div>
  );
}
