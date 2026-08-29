'use client';

import { ChevronsRight, Clipboard, FileText, PieChart } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', iconSrc: '/home-icon.png' },
  { label: 'My Classroom', iconSrc: '/classroom-icon.png' },
  { label: 'Assignments', icon: FileText },
  { label: 'Exams', icon: Clipboard, active: true },
  { label: 'My Library', icon: PieChart },
];

export function NavContent({
  collapsed = false,
  onExpand,
}: {
  collapsed?: boolean;
  onExpand?: () => void;
}) {
  return (
    <>
      <button
        title="AI Teacher's Toolkit"
        className={`group flex items-center justify-center gap-2 rounded-full bg-[#2b2b2b] text-base font-medium text-white shadow-[0_0_28px_rgba(255,121,80,0.35)] transition-[filter,box-shadow] duration-600 ease-out hover:shadow-[0_0_36px_rgba(255,121,80,0.5)] hover:brightness-[1.8] ${
          collapsed ? 'h-11 w-11 p-0' : 'px-8 py-2.5'
        }`}
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
          className="h-4.5 w-4.75 shrink-0 transition-transform duration-600 ease-out group-hover:rotate-90"
        />
        {!collapsed && "AI Teacher's Toolkit"}
      </button>

      <nav className="mt-8 flex flex-1 flex-col gap-2">
        {NAV_ITEMS.map(({ label, icon: Icon, iconSrc, active }) => (
          <a
            key={label}
            href="#"
            title={label}
            className={`flex items-center gap-2 rounded-lg text-base transition-colors duration-200 ease-out ${
              collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
            } ${
              active ? 'bg-[#f0f0f0] font-medium text-ink' : 'font-normal text-ink-soft/80 hover:bg-[#f6f6f6] hover:text-ink'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {iconSrc ? (
              <img src={iconSrc} alt="" className="h-5 w-5 shrink-0 object-contain" />
            ) : (
              Icon && <Icon size={20} className="shrink-0" />
            )}
            {!collapsed && label}
          </a>
        ))}
      </nav>

      <div
        title="Delhi Public School — Bokaro Steel City"
        className={`mt-4 flex items-center rounded-2xl bg-[#f0f0f0] transition-colors duration-200 ease-out hover:bg-[#eaeaea] ${
          collapsed ? 'justify-center p-2' : 'gap-4 p-3'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dps-crest.png" alt="" className={`shrink-0 object-contain ${collapsed ? 'h-9 w-9' : 'h-15 w-15'}`} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-ink">Delhi Public School</p>
            <p className="truncate text-sm text-ink-soft">Bokaro Steel City</p>
          </div>
        )}
      </div>

      {collapsed && (
        <button
          aria-label="Expand sidebar"
          onClick={onExpand}
          className="mt-4 flex h-5 items-center justify-center text-ink-soft hover:text-ink"
        >
          <ChevronsRight size={20} />
        </button>
      )}
    </>
  );
}
