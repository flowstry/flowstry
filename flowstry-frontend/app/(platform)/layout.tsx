'use client';

import { AuthProvider } from '@/contexts/AuthContext';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="h-screen w-screen overflow-hidden bg-zinc-950 text-white">
        {children}
      </div>
    </AuthProvider>
  );
}
