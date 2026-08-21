import { useState, useEffect } from "react";

const STORAGE_PREFIX = "usicorte_erp_";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const storageKey = `${STORAGE_PREFIX}${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      // ignore parse errors and fall back to initial value
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // storage may be full or unavailable; fail silently
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}
