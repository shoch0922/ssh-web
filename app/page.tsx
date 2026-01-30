'use client';

import SshTabManager from '@/components/SshTabManager';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Simple title bar */}
      <header className="glass sticky top-0 z-50 shadow-md">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold">SSH Web Terminal</h1>
        </div>
      </header>

      {/* Main terminal area */}
      <main className="flex-1 overflow-hidden">
        <SshTabManager />
      </main>
    </div>
  );
}
