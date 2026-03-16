import { useEffect, useState } from "react";
import { useCantonProvider } from "@sigilry/react";

import { JsonViewer } from "../shared/JsonViewer";
import { InfoTooltip } from "../shared/InfoTooltip";
import { docsLinks } from "../../lib/docs";

interface RpcEntry {
  id: string;
  receivedAt: string;
  payload: unknown;
}

const MAX_ENTRIES = 6;

export const RpcLog = () => {
  // txChanged streams transaction status updates from the provider.
  // We keep a short rolling window so request->approval->result is easy to inspect.
  const { onTxChanged } = useCantonProvider();
  const [entries, setEntries] = useState<RpcEntry[]>([]);

  useEffect(() => {
    if (!onTxChanged) {
      return;
    }

    const unsubscribe = onTxChanged((payload: unknown) => {
      const receivedAt = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setEntries((prev) => {
        const next = [
          ...prev,
          {
            id: `${receivedAt}-${prev.length}`,
            receivedAt,
            payload,
          },
        ];
        return next.slice(-MAX_ENTRIES);
      });
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [onTxChanged]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="title-row">
            <h2>Transaction Log</h2>
            <InfoTooltip
              label="txChanged events"
              description="The provider emits txChanged when a ledger command completes. Latest events from the wallet appear here."
              href={docsLinks.rpcProtocol}
            />
          </div>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="muted">No transaction events yet.</p>
      ) : (
        <ul className="list">
          {[...entries].reverse().map((entry) => (
            <li key={entry.id}>
              <div className="row small muted">
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
