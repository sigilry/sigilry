import { useLedgerApi } from "@sigilry/react";
import { zGetLedgerEndResponse } from "@sigilry/canton-json-api";

export function LedgerEndButton() {
  const { requestAsync, data, isPending } = useLedgerApi({
    parse: zGetLedgerEndResponse.parse,
  });

  const fetchLedgerEnd = async () => {
    await requestAsync({
      requestMethod: "get",
      resource: "/v2/state/ledger-end",
    });
  };

  return (
    <div>
      <button onClick={fetchLedgerEnd} disabled={isPending}>
        Fetch ledger end
      </button>
      {data && <span>Offset: {String(data.data.offset)}</span>}
    </div>
  );
}
