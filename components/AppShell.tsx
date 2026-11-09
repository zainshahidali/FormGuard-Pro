'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import RunAllModal from '@/components/RunAllModal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [runAllOpen, setRunAllOpen] = useState(false);

  useEffect(() => {
    const handleOpenRunAll = () => setRunAllOpen(true);
    window.addEventListener('formguard:open-run-all', handleOpenRunAll);
    return () => window.removeEventListener('formguard:open-run-all', handleOpenRunAll);
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-ink antialiased">
      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-[248px] flex flex-col min-h-screen">
        <Navbar onOpenMenu={() => setMenuOpen(true)} onRunAll={() => setRunAllOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
      <RunAllModal
        isOpen={runAllOpen}
        onClose={() => setRunAllOpen(false)}
        onComplete={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('formguard:refetch'));
          }
        }}
      />
    </div>
  );
}

