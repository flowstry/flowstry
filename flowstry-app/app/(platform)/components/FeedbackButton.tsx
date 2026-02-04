"use client";

import { AlertCircle, Check, Loader2, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type FormStatus = "idle" | "loading" | "success" | "error";
type FeedbackType = "feedback" | "issue" | "bugreport" | "feature_request";

const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: "feedback", label: "General Feedback" },
  { value: "issue", label: "Report Issue" },
  { value: "bugreport", label: "Bug Report" },
  { value: "feature_request", label: "Feature Request" },
];

type UITheme = "light" | "dark";

interface FeedbackButtonProps {
  apiUrl?: string;
  theme?: UITheme;
}

export default function FeedbackButton({
  apiUrl = process.env.NEXT_PUBLIC_FEEDBACK_API_URL || "http://localhost:8080",
  theme = "light",
}: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [type, setType] = useState<FeedbackType>("feedback");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  const MAX_BODY_LENGTH = 5000;

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Reset form on close
  useEffect(() => {
    if (!isOpen && status !== "success") {
      // Keep success state visible briefly before reset
      setStatus("idle");
      setErrorMessage("");
    }
  }, [isOpen, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          type,
          body: body.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        // Reset form after success
        setTimeout(() => {
          setIsOpen(false);
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

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 shadow-sm border hover:shadow-md hover:scale-105 ${theme === "dark"
          ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300"
          : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-600"
          }`}
        title="Send Feedback"
        aria-label="Open feedback form"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          className="absolute top-0 right-12 w-80 z-50 animate-in fade-in slide-in-from-right-2 duration-200"
        >
          <div className={`backdrop-blur-xl rounded-2xl border shadow-2xl overflow-hidden ${theme === "dark"
              ? "bg-zinc-900/95 border-zinc-700/50 shadow-black/30"
              : "bg-white/95 border-zinc-200 shadow-black/10"
            }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-[#36C3AD]/10 to-transparent ${theme === "dark" ? "border-zinc-700/50" : "border-zinc-200"
              }`}>
              <h3 className={`text-sm font-semibold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-zinc-900"
                }`}>
                <MessageCircle className="w-4 h-4 text-[#36C3AD]" />
                Send Feedback
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${theme === "dark"
                    ? "text-zinc-400 hover:text-white hover:bg-zinc-700/50"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                aria-label="Close"
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
                  <p className="text-[#36C3AD] font-medium text-center">
                    Thanks for your feedback!
                  </p>
                  <p className={`text-sm text-center ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>
                    We appreciate you helping us improve.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="feedback-email"
                        className={`text-xs font-medium ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      Email
                    </label>
                    <input
                      id="feedback-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (status === "error") {
                          setStatus("idle");
                          setErrorMessage("");
                        }
                      }}
                      placeholder="your@email.com"
                      disabled={status === "loading"}
                        className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#36C3AD]/50 transition-all disabled:opacity-50 ${theme === "dark"
                            ? "bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-500 focus:bg-zinc-800"
                            : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:bg-white"
                          }`}
                    />
                  </div>

                  {/* Type */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="feedback-type"
                        className={`text-xs font-medium ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      Type
                    </label>
                    <select
                      id="feedback-type"
                      value={type}
                      onChange={(e) => setType(e.target.value as FeedbackType)}
                      disabled={status === "loading"}
                        className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#36C3AD]/50 transition-all disabled:opacity-50 cursor-pointer appearance-none ${theme === "dark"
                            ? "bg-zinc-800/50 border-zinc-700/50 text-white focus:bg-zinc-800"
                            : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:bg-white"
                          }`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: "right 0.5rem center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "1.5em 1.5em",
                      }}
                    >
                      {FEEDBACK_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>
                          {ft.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Body */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="feedback-body"
                          className={`text-xs font-medium ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}
                      >
                        Message
                      </label>
                      <span
                        className={`text-xs ${
                          body.length > MAX_BODY_LENGTH
                            ? "text-red-400"
                            : theme === "dark" ? "text-zinc-500" : "text-zinc-400"
                        }`}
                      >
                        {body.length}/{MAX_BODY_LENGTH}
                      </span>
                    </div>
                    <textarea
                      id="feedback-body"
                      value={body}
                      onChange={(e) => {
                        setBody(e.target.value);
                        if (status === "error") {
                          setStatus("idle");
                          setErrorMessage("");
                        }
                      }}
                      placeholder="Tell us what's on your mind..."
                      disabled={status === "loading"}
                      rows={4}
                        className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#36C3AD]/50 transition-all disabled:opacity-50 resize-none ${theme === "dark"
                            ? "bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-500 focus:bg-zinc-800"
                            : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:bg-white"
                          }`}
                    />
                  </div>

                  {/* Error Message */}
                  {status === "error" && errorMessage && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={status === "loading" || body.length > MAX_BODY_LENGTH}
                    className="w-full py-2.5 rounded-lg bg-[#36C3AD] text-zinc-900 text-sm font-semibold hover:bg-[#5DD3C3] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#36C3AD]/20"
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
        </div>
      )}
    </div>
  );
}
