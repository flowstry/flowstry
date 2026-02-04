"use client";

import HomePage from "@/components/workspace/HomePage";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { useAuth } from "@/contexts/AuthContext";
import { FullPageLoader } from "@canvas";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import CanvasPageContent from "./_components/CanvasPageContent";

function RootContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (isAuthenticated) {
    return (
      <WorkspaceShell>
        <HomePage />
      </WorkspaceShell>
    );
  }

  // Show local canvas for unauthenticated users
  return <CanvasPageContent mode="local" />;
}

export default function RootPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <RootContent />
    </Suspense>
  );
}
