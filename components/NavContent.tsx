'use client';

import { Clipboard, FileText, PieChart } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', iconSrc: '/home-icon.png' },
  { label: 'My Classroom', iconSrc: '/classroom-icon.png' },
  { label: 'Assignments', icon: FileText },
  { label: 'Exams', icon: Clipboard, active: true },
  { label: 'My Library', icon: PieChart },
];

export function NavContent() {
  return (
    <>
      <button
        className="group flex items-center justify-center gap-2 rounded-full bg-[#2b2b2b] px-8 py-2.5 text-base font-medium text-white shadow-[0_0_28px_rgba(255,121,80,0.35)] transition-[filter,box-shadow] duration-600 ease-out hover:shadow-[0_0_36px_rgba(255,121,80,0.5)] hover:brightness-[1.8]"
        style={{
          fontFamily: 'var(--font-inter)',
          border: '4px solid transparent',
          backgroundImage:
            'linear-gradient(#2b2b2b, #2b2b2b), linear-gradient(to right, #ff7950, #c0350a)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/toolkit-sparkle-icon.png"
          alt=""
          className="h-4.5 w-4.75 transition-transform duration-600 ease-out group-hover:rotate-90"
        />
        AI Teacher&apos;s Toolkit
      </button>

      <nav className="mt-8 flex flex-1 flex-col gap-2">
        {NAV_ITEMS.map(({ label, icon: Icon, iconSrc, active }) => (
          <a
            key={label}
            href="#"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-base transition-colors duration-200 ease-out ${
              active ? 'bg-[#f0f0f0] font-medium text-ink' : 'font-normal text-ink-soft/80 hover:bg-[#f6f6f6] hover:text-ink'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {iconSrc ? <img src={iconSrc} alt="" className="h-5 w-5 object-contain" /> : Icon && <Icon size={20} />}
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-4 flex items-center gap-4 rounded-2xl bg-[#f0f0f0] p-3 transition-colors duration-200 ease-out hover:bg-[#eaeaea]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dps-crest.png" alt="" className="h-15 w-15 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-ink">Delhi Public School</p>
          <p className="truncate text-sm text-ink-soft">Bokaro Steel City</p>
        </div>
      </div>
    </>
  );
}
