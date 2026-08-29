'use client';

import { ArrowLeft, Bell, ChevronDown, ClipboardList, HelpCircle, Menu } from 'lucide-react';

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="flex h-14 items-center justify-between rounded-2xl bg-white/75 px-2 backdrop-blur-md lg:px-6">
      <div className="hidden items-center gap-2 lg:flex">
        <button
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors duration-200 ease-out hover:bg-paper"
        >
          <ArrowLeft size={20} />
        </button>
        <ClipboardList size={20} className="text-[#a9a9a9]" />
        <span className="text-base font-semibold text-[#a9a9a9]">Exams</span>
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <button
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors duration-200 ease-out hover:bg-paper"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-lg font-bold text-ink">VedaAI</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#f6f6f6] text-ink transition-colors duration-200 ease-out hover:bg-[#eaeaea] lg:inline-flex"
          aria-label="Help"
        >
          <HelpCircle size={18} />
        </button>
        <button
          className="group relative flex h-9 w-9 items-center justify-center rounded-full bg-[#f6f6f6] text-ink transition-colors duration-200 ease-out hover:bg-[#eaeaea]"
          aria-label="Notifications"
        >
          <Bell size={18} className="transition-transform duration-200 ease-out group-hover:rotate-30" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
        </button>
        <button
          className="group hidden h-9 w-9 items-center justify-center rounded-full bg-white transition-colors duration-600 ease-out hover:bg-[#303030] lg:inline-flex"
          aria-label="AI"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ai-sparkle-icon.png"
            alt=""
            className="h-[18px] w-[19px] transition-[filter,rotate] duration-600 ease-out group-hover:rotate-90 group-hover:brightness-0 group-hover:invert"
          />
        </button>

        <div className="hidden items-center gap-2 rounded-xl px-3 py-1.5 transition-colors duration-200 ease-out hover:bg-white lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/madhur-avatar.png" alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          <span className="text-base font-semibold text-ink">Madhur Rastogi</span>
          <ChevronDown size={16} className="text-ink" />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/madhur-avatar.png" alt="Madhur Rastogi" className="h-8 w-8 shrink-0 rounded-full object-cover lg:hidden" />

        <button
          className="text-ink-soft hover:text-ink lg:hidden"
          aria-label="Open menu"
          onClick={onMenuClick}
        >
          <Menu size={22} />
        </button>
      </div>
    </header>
  );
}
