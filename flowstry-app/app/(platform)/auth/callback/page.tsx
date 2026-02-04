"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processAuth = async () => {
      try {
        // Check for error in query params
        const errorParam = searchParams.get("error");
        if (errorParam) {
          setError(getErrorMessage(errorParam));
          setProcessing(false);
          return;
        }

        // Check for success - cookies are already set by the backend
        const authSuccess = searchParams.get("auth");
        if (authSuccess === "success") {
          // Cookies are set, just fetch user info
          await refreshUser();

          // Clean up URL
          window.history.replaceState(null, "", window.location.pathname);

          // Redirect to home
          router.push("/");
          return;
        }

        // If neither error nor success, something went wrong
        setError("Authentication failed: Invalid callback");
        setProcessing(false);
      } catch (err) {
        console.error("Auth callback error:", err);
        setError("Authentication failed. Please try again.");
        setProcessing(false);
      }
    };

    processAuth();
  }, [searchParams, refreshUser, router]);

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case "authorization_code_missing":
        return "Authorization was cancelled or failed.";
      case "google_auth_failed":
        return "Failed to authenticate with Google. Please try again.";
      case "user_creation_failed":
        return "Failed to create your account. Please try again.";
      case "token_generation_failed":
        return "Failed to complete authentication. Please try again.";
      default:
        return "An error occurred during authentication.";
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-zinc-950">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Authentication Failed</h1>
          <p className="text-zinc-400 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 rounded-lg bg-[#36C3AD] hover:bg-[#2eb39e] text-zinc-900 font-semibold transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-zinc-950">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-[#36C3AD]/30 border-t-[#36C3AD] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Completing sign in...</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen w-screen bg-zinc-950">
        <div className="w-8 h-8 border-3 border-[#36C3AD]/30 border-t-[#36C3AD] rounded-full animate-spin" />
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
