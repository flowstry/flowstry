// Auth API client

import type {
  ApiError,
  AuthResponse,
  SignInRequest,
  SignUpRequest,
  User,
} from './auth-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class AuthApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public error?: string
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    const apiError = data as ApiError;
    throw new AuthApiError(
      apiError.error || apiError.message || 'An error occurred',
      response.status,
      apiError.error
    );
  }

  // Backend wraps successful responses in { data: ... }
  return data.data || data;
}

export const authClient = {
  /**
   * Sign up with email and password
   */
  async signUp(request: SignUpRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for cross-origin requests
      body: JSON.stringify(request),
    });
    return handleResponse<AuthResponse>(response);
  },

  /**
   * Sign in with email and password
   */
  async signIn(request: SignInRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for cross-origin requests
      body: JSON.stringify(request),
    });
    return handleResponse<AuthResponse>(response);
  },

  /**
   * Refresh access token using refresh token cookie
   */
  async refresh(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Cookies are sent automatically
    });
    if (!response.ok) {
      throw new AuthApiError('Failed to refresh token', response.status);
    }
  },

  /**
   * Logout - revoke refresh token and clear cookies
   */
  async logout(): Promise<void> {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Cookies are sent automatically
    });
  },

  /**
   * Get current user info
   */
  async me(): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Use cookies for authentication
    });
    return handleResponse<User>(response);
  },

  /**
   * Get Google OAuth URL - redirects to Google
   * @param redirectUrl - URL to redirect back to after authentication
   */
  getGoogleAuthUrl(redirectUrl: string): string {
    const encodedRedirect = encodeURIComponent(redirectUrl);
    return `${API_BASE_URL}/auth/google?redirect_url=${encodedRedirect}`;
  },

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: { theme?: 'light' | 'dark' }): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(preferences),
    });
    return handleResponse<void>(response);
  },
};

export { AuthApiError };

