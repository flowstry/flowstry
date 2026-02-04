"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

const WELCOME_DISMISSED_KEY = "flowstry-welcome-dismissed";

interface WelcomeModalProps {
  onContinueLocally: () => void;
  onSignIn: () => void;
  isAuthenticated?: boolean;
}

export default function WelcomeModal({ onContinueLocally, onSignIn, isAuthenticated }: WelcomeModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Don't show if user is authenticated
    if (isAuthenticated) return;

    // Check if user has dismissed the modal before
    const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY);
    if (!dismissed) {
      setIsOpen(true);
    }
  }, [isAuthenticated]);

  const handleContinueLocally = () => {
    // Always remember this choice
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    setIsOpen(false);
    onContinueLocally();
  };

  const handleSignIn = () => {
    // Always remember this choice
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    setIsOpen(false);
    onSignIn();
  };

  const handleClose = () => {
    // Always remember this choice
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    setIsOpen(false);
    onContinueLocally();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 pt-12 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#36C3AD]/10 border border-[#36C3AD]/25 text-sm text-[#36C3AD] mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">Welcome to Flowstry</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Design systems where{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#36C3AD] to-[#2A9D8F]">
              flow meets structure.
            </span>
          </h1>

          {/* Description */}
          <p className="text-zinc-400 text-lg mb-8 leading-relaxed max-w-md mx-auto">
            Visualize, design, and evolve complex systems with clarity—on an infinite canvas built for modern system thinkers.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleContinueLocally}
              className="px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all duration-200 border border-zinc-700"
            >
              Continue Locally
            </button>
            <button
              onClick={handleSignIn}
              className="px-6 py-3 rounded-xl bg-[#36C3AD] hover:bg-[#2eb39e] text-zinc-900 font-semibold transition-all duration-200 shadow-lg shadow-[#36C3AD]/25"
            >
              Sign In / Sign Up
            </button>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="h-1 bg-gradient-to-r from-transparent via-[#36C3AD]/50 to-transparent" />
      </div>
    </div>
  );
}
