"use client";

import WorkspaceInnerPage from "@/components/workspace/WorkspacePage";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import WorkspacesIndexPage from "@/components/workspace/WorkspacesIndexPage";
import { useAuth } from "@/contexts/AuthContext";
import { FullPageLoader } from "@canvas";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import CanvasPageContent from "../_components/CanvasPageContent";

function WorkspacesIndexView() {
  return (
    <WorkspaceShell>
      <WorkspacesIndexPage />
    </WorkspaceShell>
  );
}

function WorkspaceInnerView() {
  return (
    <WorkspaceShell>
      <WorkspaceInnerPage />
    </WorkspaceShell>
  );
}

function CanvasView() {
  return <CanvasPageContent mode="cloud" />;
}

export default function WorkspacePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <Suspense fallback={<FullPageLoader />}>
      <WorkspacePageRoute
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
      />
    </Suspense>
  );
}

function WorkspacePageRoute({
  isAuthenticated,
  isLoading,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
}) {
  const searchParams = useSearchParams();
  if (isLoading || !isAuthenticated) {
    return <FullPageLoader />;
  }

  const diagramId = searchParams.get("diagramId");
  const workspaceId = searchParams.get("workspaceId");

  if (diagramId) {
    return <CanvasView />;
  }

  if (workspaceId) {
    return <WorkspaceInnerView />;
  }

  return <WorkspacesIndexView />;
}
