'use client';

import { useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { Logo } from './Logo';
import { NavContent } from './NavContent';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden shrink-0 flex-col overflow-hidden rounded-2xl bg-card py-6 shadow-[0_32px_48px_rgba(0,0,0,0.20),0_16px_48px_rgba(0,0,0,0.12)] transition-[width] duration-300 ease-out lg:flex ${
        collapsed ? 'w-20 px-3' : 'w-76 px-6'
      }`}
    >
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <Logo compact={collapsed} />
        {!collapsed && (
          <button
            aria-label="Collapse sidebar"
            onClick={() => setCollapsed(true)}
            className="flex h-5 w-5 items-center justify-center text-ink-soft hover:text-ink"
          >
            <PanelLeft size={20} />
          </button>
        )}
      </div>
      <div className="mt-8 flex flex-1 flex-col">
        <NavContent collapsed={collapsed} onExpand={() => setCollapsed(false)} />
      </div>
    </aside>
  );
}
