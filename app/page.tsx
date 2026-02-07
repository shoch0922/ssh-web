'use client';

import { useState, useCallback } from 'react';
import SshTabManager from '@/components/SshTabManager';
import TmuxSessionSelector from '@/components/TmuxSessionSelector';

export default function Home() {
  const [showTerminal, setShowTerminal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const handleSelectSession = useCallback((tmuxSessionId: string) => {
    setSelectedSessionId(tmuxSessionId);
    setShowTerminal(true);
  }, []);

  const handleCreateNew = useCallback(() => {
    setSelectedSessionId(null);
    setShowTerminal(true);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Simple title bar */}
      <header className="glass sticky top-0 z-50 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold">SSH Web Terminal</h1>
        </div>
      </header>

      {/* Main terminal area */}
      <main className="flex-1 overflow-hidden max-w-[1600px] mx-auto w-full pt-[60px]">
        {showTerminal ? (
          <SshTabManager initialTmuxSessionId={selectedSessionId} />
        ) : (
          <TmuxSessionSelector
            onSelectSession={handleSelectSession}
            onCreateNew={handleCreateNew}
          />
        )}
      </main>
    </div>
  );
}
