import { authClient } from "./auth-client";

/**
 * Extended fetch wrapper that handles token refreshing on 401 errors.
 */
export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // 1. Initial request
  let response = await fetch(input, init);

  // 2. Check for 401 Unauthorized
  if (response.status === 401) {
    try {
      // 3. Attempt to refresh token
      await authClient.refresh();

      // 4. Retry original request
      // We need to clone the init object to ensure we don't mutate the original if it was reused
      response = await fetch(input, init);
    } catch (refreshError) {
      // Refresh failed (token expired or invalid)
      // We return the original 401 response so the app handles it (e.g. redirect to login)
      // logging the error for debugging
      console.warn("Token refresh failed:", refreshError);
      return response;
    }
  }

  return response;
}
