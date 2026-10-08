import { useEffect } from "react";
import { useCanton } from "@sigilry/react";

export function StatusWatcher() {
  const { onStatusChanged, onConnected, onAccountsChanged } = useCanton();

  useEffect(() => {
    const offStatus = onStatusChanged((status) => console.log("status", status));
    const offConnected = onConnected((status) => console.log("connected", status));
    const offAccounts = onAccountsChanged((accounts) => console.log("accounts", accounts));
    return () => {
      offStatus();
      offConnected();
      offAccounts();
    };
  }, [onStatusChanged, onConnected, onAccountsChanged]);

  return null;
}
