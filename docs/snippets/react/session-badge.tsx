import { useSession } from "@sigilry/react";

export function SessionBadge() {
  const { sessionState, timeRemainingFormatted, reauthenticate } = useSession();

  return (
    <div>
      <span>Status: {sessionState.status}</span>
      <span>Time remaining: {timeRemainingFormatted}</span>
      {sessionState.status === "expiring_soon" && (
        <button onClick={reauthenticate}>Refresh session</button>
      )}
    </div>
  );
}
