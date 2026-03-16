/**
 * useSession - Hook for session management and expiry tracking
 *
 * Parses JWT expiry time and provides session state with countdown.
 * Useful for showing session status and triggering re-authentication flows.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCanton } from "../context";

/**
 * Parsed JWT payload (minimal fields we care about)
 */
export interface JwtPayload {
  /** Subject (usually userId) */
  sub?: string;
  /** Expiration time (Unix timestamp in seconds) */
  exp?: number;
  /** Issued at time (Unix timestamp in seconds) */
  iat?: number;
  /** Audience */
  aud?: string | string[];
  /** Canton party IDs for acting as */
  actAs?: string[];
  /** Canton party IDs for reading as */
  readAs?: string[];
}

/**
 * Session state discriminated union
 */
export type SessionState =
  | { status: "no_session" }
  | { status: "valid"; expiresAt: Date; expiresIn: number }
  | { status: "expiring_soon"; expiresAt: Date; expiresIn: number }
  | { status: "expired"; expiredAt: Date }
  | { status: "unknown" };

/**
 * Threshold in milliseconds before expiry to consider "expiring soon"
 */
const EXPIRY_SOON_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface UseSessionOptions {
  /** Threshold in ms before expiry to consider "expiring soon" (default: 5 minutes) */
  expiringSoonThreshold?: number;
  /** Callback when session is about to expire */
  onExpiringSoon?: () => void;
  /** Callback when session expires */
  onExpired?: () => void;
  /** Update interval in ms (default: 1000) */
  updateInterval?: number;
}

export interface UseSessionResult {
  /** Current session state */
  sessionState: SessionState;
  /** Whether session is valid and not expiring soon */
  isValid: boolean;
  /** Whether session is expiring soon */
  isExpiringSoon: boolean;
  /** Whether session has expired */
  isExpired: boolean;
  /** Time remaining in milliseconds (undefined if no session or expired) */
  timeRemaining: number | undefined;
  /** Time remaining as formatted string (e.g., "4m 30s") */
  timeRemainingFormatted: string;
  /** Parsed JWT payload (if available) */
  jwtPayload: JwtPayload | null;
  /** Trigger re-authentication (calls reconnect) */
  reauthenticate: () => Promise<void>;
}

/**
 * Parse a JWT token without validation (client-side only, for display purposes)
 * IMPORTANT: This does NOT validate the signature - use for UI display only
 */
export function parseJwt(token: string): JwtPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payloadBase64 = parts[1];
    if (!payloadBase64) return null;

    // Handle URL-safe base64 encoding
    const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");

    // Decode with proper padding
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);

    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Format milliseconds as human-readable time remaining
 */
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Expired";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Hook for session management and expiry tracking
 *
 * @example
 * ```tsx
 * function SessionStatus() {
 *   const { sessionState, timeRemainingFormatted, isExpiringSoon, reauthenticate } = useSession({
 *     onExpiringSoon: () => console.log('Session expiring soon!'),
 *     onExpired: () => console.log('Session expired'),
 *   })
 *
 *   return (
 *     <div>
 *       <span>Status: {sessionState.status}</span>
 *       <span>Time remaining: {timeRemainingFormatted}</span>
 *       {isExpiringSoon && (
 *         <button onClick={reauthenticate}>Refresh Session</button>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useSession(options: UseSessionOptions = {}): UseSessionResult {
  const {
    expiringSoonThreshold = EXPIRY_SOON_THRESHOLD_MS,
    onExpiringSoon,
    onExpired,
    updateInterval = 1000,
  } = options;

  const { connectionState, reconnect, request } = useCanton();

  // Track whether callbacks have been fired
  const [expiringSoonFired, setExpiringSoonFired] = useState(false);
  const [expiredFired, setExpiredFired] = useState(false);

  // Get current access token from status
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Fetch session on connection
  useEffect(() => {
    if (connectionState.status !== "connected") {
      setAccessToken(null);
      setExpiringSoonFired(false);
      setExpiredFired(false);
      return;
    }

    const fetchSession = async () => {
      try {
        const result = await request("status");
        setAccessToken(result?.session?.accessToken ?? null);
      } catch {
        setAccessToken(null);
      }
    };

    fetchSession();
  }, [connectionState.status, request]);

  // Parse JWT payload
  const jwtPayload = useMemo(() => {
    if (!accessToken) return null;
    return parseJwt(accessToken);
  }, [accessToken]);

  // Calculate expiry time from JWT
  const expiresAt = useMemo(() => {
    if (!jwtPayload?.exp) return null;
    // exp is in seconds, convert to milliseconds
    return new Date(jwtPayload.exp * 1000);
  }, [jwtPayload]);

  // Track time remaining with updates
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, updateInterval);

    return () => clearInterval(interval);
  }, [expiresAt, updateInterval]);

  // Calculate session state
  const sessionState = useMemo((): SessionState => {
    if (connectionState.status !== "connected") {
      return { status: "no_session" };
    }

    if (!accessToken || !expiresAt) {
      return { status: "unknown" };
    }

    const expiresIn = expiresAt.getTime() - now;

    if (expiresIn <= 0) {
      return { status: "expired", expiredAt: expiresAt };
    }

    if (expiresIn <= expiringSoonThreshold) {
      return { status: "expiring_soon", expiresAt, expiresIn };
    }

    return { status: "valid", expiresAt, expiresIn };
  }, [connectionState.status, accessToken, expiresAt, now, expiringSoonThreshold]);

  // Fire callbacks when state changes
  useEffect(() => {
    if (sessionState.status === "expiring_soon" && !expiringSoonFired) {
      setExpiringSoonFired(true);
      onExpiringSoon?.();
    }

    if (sessionState.status === "expired" && !expiredFired) {
      setExpiredFired(true);
      onExpired?.();
    }

    // Reset flags when session becomes valid again
    if (sessionState.status === "valid") {
      setExpiringSoonFired(false);
      setExpiredFired(false);
    }
  }, [sessionState.status, expiringSoonFired, expiredFired, onExpiringSoon, onExpired]);

  // Derived values
  const isValid = sessionState.status === "valid";
  const isExpiringSoon = sessionState.status === "expiring_soon";
  const isExpired = sessionState.status === "expired";

  const timeRemaining = useMemo(() => {
    if (sessionState.status === "valid" || sessionState.status === "expiring_soon") {
      return sessionState.expiresIn;
    }
    return undefined;
  }, [sessionState]);

  const timeRemainingFormatted = useMemo(() => {
    if (timeRemaining === undefined) {
      return sessionState.status === "expired" ? "Expired" : "—";
    }
    return formatTimeRemaining(timeRemaining);
  }, [timeRemaining, sessionState.status]);

  // Re-authentication handler
  const reauthenticate = useCallback(async () => {
    await reconnect();
    // After reconnect, fetch new session token
    try {
      const result = await request("status");
      setAccessToken(result?.session?.accessToken ?? null);
      setExpiringSoonFired(false);
      setExpiredFired(false);
    } catch {
      // Ignore errors, reconnect already handles state
    }
  }, [reconnect, request]);

  return {
    sessionState,
    isValid,
    isExpiringSoon,
    isExpired,
    timeRemaining,
    timeRemainingFormatted,
    jwtPayload,
    reauthenticate,
  };
}
