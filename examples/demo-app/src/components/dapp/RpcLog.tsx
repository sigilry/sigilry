import { useCallback, useEffect, useState } from "react";
import { useCantonProvider } from "@sigilry/react";

import { JsonViewer } from "../shared/JsonViewer";
import { InfoTooltip } from "../shared/InfoTooltip";
import { docsLinks } from "../../lib/docs";

// The CIP-103 push-event surface. The §4.2.2 sync events (accountsChanged, statusChanged,
// txChanged) keep the dApp in step with wallet state; `connected` is the separate login-flow
// event. The wallet pane emits all four, and this panel renders them as they arrive.
type EventKind = "accountsChanged" | "statusChanged" | "txChanged" | "connected";

interface EventEntry {
  id: string;
  kind: EventKind;
  receivedAt: string;
  payload: unknown;
}

const MAX_ENTRIES = 8;

export const RpcLog = () => {
  const { onTxChanged, onStatusChanged, onConnected, onAccountsChanged } = useCantonProvider();
  const [entries, setEntries] = useState<EventEntry[]>([]);

  // Append to a short rolling window so the request -> approval -> result/event flow is easy to
  // inspect without unbounded growth.
  const record = useCallback((kind: EventKind, payload: unknown) => {
    const receivedAt = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setEntries((prev) =>
      [...prev, { id: `${kind}-${receivedAt}-${prev.length}`, kind, receivedAt, payload }].slice(
        -MAX_ENTRIES,
      ),
    );
  }, []);

  useEffect(() => {
    // Each subscription returns an unsubscribe function; tear all of them down on cleanup so a
    // provider swap (selecting a different wallet) never leaks listeners.
    const unsubscribes = [
      onAccountsChanged?.((payload) => record("accountsChanged", payload)),
      onStatusChanged?.((payload) => record("statusChanged", payload)),
      onTxChanged?.((payload) => record("txChanged", payload)),
      onConnected?.((payload) => record("connected", payload)),
    ];
    return () => {
      for (const unsubscribe of unsubscribes) {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      }
    };
  }, [onAccountsChanged, onStatusChanged, onTxChanged, onConnected, record]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="title-row">
            <h2>RPC &amp; Events</h2>
            <InfoTooltip
              label="CIP-103 push events"
              description="The provider pushes accountsChanged, statusChanged and txChanged (the §4.2.2 sync events) plus the connected login event. Latest events from the wallet appear here."
              href={docsLinks.rpcProtocol}
            />
          </div>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="muted">No events yet. Connect the wallet and submit a command.</p>
      ) : (
        <ul className="list">
          {[...entries].reverse().map((entry) => (
            <li key={entry.id}>
              <div className="row small muted">
                <span className="badge">{entry.kind}</span>
                <span>{entry.receivedAt}</span>
              </div>
              <JsonViewer value={entry.payload} maxLength={1400} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
