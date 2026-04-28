import { type JSX } from "react";

import { ActiveContractsExample } from "./active-contracts";
import { SignMessageExample } from "./sign-message";
import { UsdcxTransferExample } from "./usdcx-transfer";

export type ExampleId = "active-contracts" | "sign-message" | "usdcx-transfer";

interface ExampleEntry {
  id: ExampleId;
  label: string;
  description: string;
  component: () => JSX.Element;
}

export const EXAMPLES: ExampleEntry[] = [
  {
    id: "active-contracts",
    label: "Active Contracts",
    description: "Query and group active contracts using `useActiveContracts`.",
    component: ActiveContractsExample,
  },
  {
    id: "sign-message",
    label: "Sign Message",
    description: "Request a signature from the wallet and verify it client-side.",
    component: SignMessageExample,
  },
  {
    id: "usdcx-transfer",
    label: "USDCx Transfer",
    description: "Prepare a token-standard transfer via useSubmitCommand.",
    component: UsdcxTransferExample,
  },
];
