import { useWalletSimulator } from "../../hooks/useWalletSimulator";
import { CopyableText } from "../shared/CopyableText";
import { InfoTooltip } from "../shared/InfoTooltip";
import { docsLinks } from "../../lib/docs";
import { shortenPartyId } from "../../lib/format";

export const AccountInfo = () => {
  const { identity, networkId } = useWalletSimulator();
  const { partyId, fingerprint } = identity;

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="title-row">
          <h3>Account</h3>
          <InfoTooltip
            label="Wallet account"
            description="Accounts are derived from the wallet's party ID and mapped to the Canton network."
            href={docsLinks.react}
          />
        </div>
      </div>
      <div className="stat">
        <span className="label">Party ID</span>
        <span className="value">
          {partyId ? (
            <CopyableText
              value={partyId}
              displayValue={shortenPartyId(partyId)}
              label="party id"
              textClassName="mono"
            />
          ) : (
            "unknown"
          )}
        </span>
      </div>
      <div className="stat">
        <span className="label">Fingerprint</span>
        <span className="value">
          {fingerprint ? (
            <CopyableText value={fingerprint} label="fingerprint" textClassName="mono" />
          ) : (
            "unknown"
          )}
        </span>
      </div>
      <div className="stat">
        <span className="label">Network</span>
        <span className="value">{networkId}</span>
      </div>
    </section>
  );
};
