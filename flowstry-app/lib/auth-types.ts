// Auth types for the frontend

export interface UserPreferences {
  theme?: 'light' | 'dark';
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  auth_provider: 'email' | 'google';
  preferences?: UserPreferences;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
}


export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface ApiError {
  error: string;
  message?: string;
}
