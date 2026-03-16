/* eslint-disable no-console */
import { useEffect, useRef } from "react";

const UNSET = Symbol("unset");

const snapshotValue = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/**
 * Returns true only when the value for `key` changes.
 * Useful for polling-heavy debug logs where repeated identical payloads are noise.
 */
export const createChangeGate = (maxEntries = 128) => {
  const previousByKey = new Map<string, string>();

  return (key: string, value: unknown): boolean => {
    const next = snapshotValue(value);
    const previous = previousByKey.get(key);
    if (previous === next) {
      return false;
    }

    previousByKey.set(key, next);
    if (previousByKey.size > maxEntries) {
      const oldestKey = previousByKey.keys().next().value;
      if (oldestKey !== undefined) {
        previousByKey.delete(oldestKey);
      }
    }
    return true;
  };
};

/**
 * Returns true if enough time has elapsed since the last log with the same key.
 */
export const createThrottleGate = (windowMs: number, maxEntries = 128) => {
  const lastLoggedAtByKey = new Map<string, number>();

  return (key: string): boolean => {
    const now = Date.now();
    const lastLoggedAt = lastLoggedAtByKey.get(key);

    if (lastLoggedAt !== undefined && now - lastLoggedAt < windowMs) {
      return false;
    }

    lastLoggedAtByKey.set(key, now);
    if (lastLoggedAtByKey.size > maxEntries) {
      const oldestKey = lastLoggedAtByKey.keys().next().value;
      if (oldestKey !== undefined) {
        lastLoggedAtByKey.delete(oldestKey);
      }
    }
    return true;
  };
};

interface UseLogOnChangeOptions<T> {
  isEqual?: (previous: T, next: T) => boolean;
  map?: (value: T) => unknown;
}

export const useLogOnChange = <T>(
  message: string,
  value: T,
  options: UseLogOnChangeOptions<T> = {},
): void => {
  const { isEqual = Object.is, map } = options;
  const previousRef = useRef<T | typeof UNSET>(UNSET);

  useEffect(() => {
    const previous = previousRef.current;
    if (previous !== UNSET && isEqual(previous, value)) {
      return;
    }

    previousRef.current = value;
    console.debug(message, map ? map(value) : value);
  }, [isEqual, map, message, value]);
};
