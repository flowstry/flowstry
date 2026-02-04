"use client";

import { useCallback, useEffect, useState } from "react";

type UITheme = "light" | "dark";

const DB_NAME = "flowstry-canvas-db";
const SETTINGS_STORE_NAME = "settings";
const SETTINGS_KEY = "workspace-settings";
const UI_THEME_KEY = "flowstry_ui_theme";

interface UseCanvasThemeReturn {
  theme: UITheme;
  isLoading: boolean;
}

/**
 * Hook to subscribe to canvas theme changes from IndexedDB
 * This allows external UI components to react to theme changes
 */
export function useCanvasTheme(): UseCanvasThemeReturn {
  const [theme, setTheme] = useState<UITheme>("light");
  const [isLoading, setIsLoading] = useState(true);

  const loadTheme = useCallback(async () => {
    if (typeof window === "undefined" || !window.indexedDB) {
      setIsLoading(false);
      return;
    }

    try {
      let nextTheme: UITheme | null = null;

      const savedTheme = window.localStorage?.getItem(UI_THEME_KEY);
      if (savedTheme === "light" || savedTheme === "dark") {
        nextTheme = savedTheme;
      }

      const db = await openDB();
      const settings = await getSettings(db);

      if (!nextTheme && settings?.uiTheme) {
        nextTheme = settings.uiTheme;
      }

      if (nextTheme) {
        setTheme(nextTheme);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load canvas theme:", error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTheme();

    // Poll for theme changes every 500ms (IndexedDB doesn't have native observers)
    // This ensures the UI stays in sync when theme is changed from canvas settings
    const interval = setInterval(loadTheme, 500);

    return () => clearInterval(interval);
  }, [loadTheme]);

  return { theme, isLoading };
}

export async function setCanvasTheme(theme: UITheme): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return;
  }
  const db = await openDB();
  const settings = await getSettings(db);
  const nextSettings = { ...(settings ?? {}), uiTheme: theme };
  await setSettings(db, nextSettings);
}

// Helper to open the IndexedDB database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

// Helper to get settings from IndexedDB
function getSettings(
  db: IDBDatabase
): Promise<{ uiTheme?: UITheme } | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE_NAME, "readonly");
    const store = transaction.objectStore(SETTINGS_STORE_NAME);
    const request = store.get(SETTINGS_KEY);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.data);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function setSettings(
  db: IDBDatabase,
  data: { uiTheme?: UITheme }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SETTINGS_STORE_NAME);
    const request = store.put({ key: SETTINGS_KEY, data });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
