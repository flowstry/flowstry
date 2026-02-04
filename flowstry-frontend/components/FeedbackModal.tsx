"use client";

import { AlertCircle, Check, Loader2, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type FormStatus = "idle" | "loading" | "success" | "error";
type FeedbackType = "feedback" | "issue" | "bugreport" | "feature_request";

const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: "feedback", label: "General Feedback" },
  { value: "issue", label: "Report Issue" },
  { value: "bugreport", label: "Bug Report" },
  { value: "feature_request", label: "Feature Request" },
];

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: "light" | "dark";
  apiUrl?: string;
}

export default function FeedbackModal({
  isOpen,
  onClose,
  theme = "dark",
  apiUrl = process.env.NEXT_PUBLIC_FEEDBACK_API_URL || "http://localhost:8080",
}: FeedbackModalProps) {
  const [email, setEmail] = useState("");
  const [type, setType] = useState<FeedbackType>("feedback");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const MAX_BODY_LENGTH = 5000;

  // Track if component is mounted (for portal)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus("idle");
      setErrorMessage("");
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setStatus("error");
      setErrorMessage("Email is required");
      return;
    }

    if (!body.trim()) {
      setStatus("error");
      setErrorMessage("Please enter your feedback");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch(`${apiUrl}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), type, body: body.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setTimeout(() => {
          onClose();
          setEmail("");
          setType("feedback");
          setBody("");
          setStatus("idle");
        }, 2000);
      } else {
        setStatus("error");
        setErrorMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage("Unable to connect. Please try again later.");
      console.error("Feedback submission error:", error);
    }
  };

  if (!isOpen || !mounted) return null;

  // Use portal to render at document body level
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative w-96 max-w-[90vw] backdrop-blur-xl rounded-2xl border shadow-2xl overflow-hidden ${
          theme === "dark"
            ? "bg-zinc-900/95 border-zinc-700/50"
            : "bg-white/95 border-zinc-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-[#36C3AD]/10 to-transparent ${
          theme === "dark" ? "border-zinc-700/50" : "border-zinc-200"
        }`}>
          <h3 className={`text-sm font-semibold flex items-center gap-2 ${
            theme === "dark" ? "text-white" : "text-zinc-900"
          }`}>
            <MessageCircle className="w-4 h-4 text-[#36C3AD]" />
            Report & Feedback
          </h3>
          <button
            onClick={onClose}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
              theme === "dark"
                ? "text-zinc-400 hover:text-white hover:bg-zinc-700/50"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {status === "success" ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="w-12 h-12 rounded-full bg-[#36C3AD]/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-[#36C3AD]" />
              </div>
              <p className="text-[#36C3AD] font-medium text-center">Thanks for your feedback!</p>
              <p className={`text-sm text-center ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>
                We appreciate you helping us improve.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className={`text-xs font-medium ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                  placeholder="your@email.com"
                  disabled={status === "loading"}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#36C3AD]/50 transition-all disabled:opacity-50 ${
                    theme === "dark"
                      ? "bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-500"
                      : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400"
                  }`}
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className={`text-xs font-medium ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as FeedbackType)}
                  disabled={status === "loading"}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#36C3AD]/50 transition-all disabled:opacity-50 cursor-pointer ${
                    theme === "dark"
                      ? "bg-zinc-800/50 border-zinc-700/50 text-white"
                      : "bg-zinc-50 border-zinc-200 text-zinc-900"
                  }`}
                >
                  {FEEDBACK_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-medium ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>
                    Message
                  </label>
                  <span className={`text-xs ${body.length > MAX_BODY_LENGTH ? "text-red-400" : theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>
                    {body.length}/{MAX_BODY_LENGTH}
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => { setBody(e.target.value); if (status === "error") setStatus("idle"); }}
                  placeholder="Tell us what's on your mind..."
                  disabled={status === "loading"}
                  rows={4}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#36C3AD]/50 transition-all disabled:opacity-50 resize-none ${
                    theme === "dark"
                      ? "bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-500"
                      : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400"
                  }`}
                />
              </div>

              {/* Error */}
              {status === "error" && errorMessage && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={status === "loading" || body.length > MAX_BODY_LENGTH}
                className="w-full py-2.5 rounded-lg bg-[#36C3AD] text-zinc-900 text-sm font-semibold hover:bg-[#5DD3C3] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Feedback"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
