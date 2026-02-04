'use client';

import { AuthApiError, authClient } from '@/lib/auth-client';
import type { User, UserPreferences } from '@/lib/auth-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isNewSignup: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  updateUserPreferences: (preferences: UserPreferences) => void;
  refreshUserPreferences: () => Promise<void>;
  clearNewSignupFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewSignup, setIsNewSignup] = useState(false);

  const isAuthenticated = useMemo(() => !!user, [user]);

  // Fetch current user using cookies
  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      return await authClient.me();
    } catch (err) {
      if (err instanceof AuthApiError && err.statusCode === 401) {
        // Token expired, try refresh
        try {
          await authClient.refresh();
          // Retry getting user after refresh
          return await authClient.me();
        } catch {
          return null;
        }
      }
      return null;
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const currentUser = await fetchUser();
        if (mounted) {
          setUser(currentUser);
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchUser]);

  // Sign in with email/password
  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setIsLoading(true);

      try {
        const response = await authClient.signIn({ email, password });
        // Cookies are set by the backend, we just need to update user state
        setUser(response.user);
      } catch (err) {
        const message =
          err instanceof AuthApiError
            ? err.message
            : 'Failed to sign in. Please try again.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Sign up with email/password
  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      setError(null);
      setIsLoading(true);

      try {
        const response = await authClient.signUp({ email, password, name });
        // Cookies are set by the backend, we just need to update user state
        setUser(response.user);
        // Mark as new signup for migration flow
        setIsNewSignup(true);
      } catch (err) {
        const message =
          err instanceof AuthApiError
            ? err.message
            : 'Failed to sign up. Please try again.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Sign in with Google
  const signInWithGoogle = useCallback(() => {
    // Redirect to Google OAuth with callback URL
    const callbackUrl = `${window.location.origin}/auth/callback`;
    window.location.href = authClient.getGoogleAuthUrl(callbackUrl);
  }, []);

  // Refresh user after OAuth callback
  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await fetchUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUser]);

  const refreshUserPreferences = useCallback(async () => {
    try {
      const currentUser = await fetchUser();
      if (currentUser) {
        setUser(currentUser);
      }
    } catch {
      // Ignore refresh failures
    }
  }, [fetchUser]);

  const updateUserPreferences = useCallback((preferences: UserPreferences) => {
    setUser((current) => {
      if (!current) return current;
      return {
        ...current,
        preferences: {
          ...current.preferences,
          ...preferences,
        },
      };
    });
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await authClient.logout();
    } catch {
    // Ignore logout errors
    }
    setUser(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Clear new signup flag after migration is done
  const clearNewSignupFlag = useCallback(() => {
    setIsNewSignup(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      isNewSignup,
      error,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      clearError,
      refreshUser,
      updateUserPreferences,
      refreshUserPreferences,
      clearNewSignupFlag,
    }),
    [
      user,
      isAuthenticated,
      isLoading,
      isNewSignup,
      error,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      clearError,
      refreshUser,
      updateUserPreferences,
      refreshUserPreferences,
      clearNewSignupFlag,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
