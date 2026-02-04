"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "/";
const signInUrl = `${appBaseUrl}?auth_action=signin`;

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type User = {
  name?: string;
  email?: string;
  avatar_url?: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

const getInitials = (name?: string, email?: string) => {
  const source = name || email || "";
  const parts = source.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "F";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export default function AuthActionButton({ className }: { className?: string }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchUser = async () => {
      try {
        if (!apiBaseUrl) {
          if (isMounted) {
            setStatus("unauthenticated");
          }
          return;
        }

        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!response.ok) {
          if (isMounted) {
            setStatus("unauthenticated");
          }
          return;
        }

        const payload = await response.json();
        const data = payload?.data ?? payload;

        if (isMounted) {
          setUser(data);
          setStatus("authenticated");
        }
      } catch {
        if (isMounted) {
          setStatus("unauthenticated");
        }
      }
    };

    fetchUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const initials = useMemo(() => getInitials(user?.name, user?.email), [user]);

  if (status === "loading") {
    return (
      <div
        className={`flex h-11 min-w-[120px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-neutral-400 ${className ?? ""}`}
      >
        Checking...
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <Link
        href={appBaseUrl}
        className={`inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-neutral-100 transition hover:border-white/30 ${className ?? ""}`}
      >
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user?.name ? `${user.name} avatar` : "User avatar"}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-neutral-200">
            {initials}
          </span>
        )}
        Go to app
      </Link>
    );
  }

  return (
    <Link
      href={signInUrl}
      className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-neutral-200 transition hover:border-white/30 hover:text-white ${className ?? ""}`}
    >
      Sign in
    </Link>
  );
}
