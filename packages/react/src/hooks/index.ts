/**
 * React hooks for Canton wallet integration
 *
 * All hooks follow wagmi patterns with { data, isLoading, isError, error } shape.
 */

export { type UseAccountsResult, useAccounts } from "./useAccounts";
export { type UseActiveAccountResult, useActiveAccount } from "./useActiveAccount";
export {
  type ActiveContract,
  type ActiveContractsResponse,
  type TemplateFilter,
  type UseActiveContractsOptions,
  type UseActiveContractsResult,
  useActiveContracts,
} from "./useActiveContracts";
export { type UseCantonProviderResult, useCantonProvider } from "./useCantonProvider";
export { type UseConnectResult, useConnect } from "./useConnect";
export {
  type StreamedContract,
  type UseContractStreamOptions,
  type UseContractStreamResult,
  useContractStream,
} from "./useContractStream";
export { type UseDisconnectResult, useDisconnect } from "./useDisconnect";
export {
  type ExerciseChoiceRequest,
  type UseExerciseChoiceResult,
  useExerciseChoice,
} from "./useExerciseChoice";
export {
  type LedgerApiParser,
  type LedgerApiRequest,
  type LedgerApiResponse,
  parseLedgerApiResponse,
  type UseLedgerApiOptions,
  type UseLedgerApiResult,
  useLedgerApi,
} from "./useLedgerApi";
export {
  type LedgerEndResponse,
  type UseLedgerEndOptions,
  type UseLedgerEndResult,
  useLedgerEnd,
} from "./useLedgerEnd";
export {
  type ArchivedEvent,
  type ContractEvent,
  type CreatedEvent,
  type TransactionUpdate,
  type UpdateTemplateFilter,
  type UseLedgerUpdatesOptions,
  type UseLedgerUpdatesResult,
  useLedgerUpdates,
} from "./useLedgerUpdates";
export {
  applyPrunedOffsetFloor,
  deriveRecentBeginExclusive,
  isMaximumListElementsError,
  parseLatestPrunedOffsetResponse,
  parseLedgerEndResponse,
} from "./ledgerApiContract";
export {
  type SignMessageRequest,
  type SignMessageResult,
  type UseSignMessageResult,
  useSignMessage,
} from "./useSignMessage";
export {
  type JwtPayload,
  parseJwt,
  type SessionState,
  type UseSessionOptions,
  type UseSessionResult,
  useSession,
} from "./useSession";
export {
  type ExecutedPayload,
  type SubmitCommandRequest,
  type SubmitCommandResult,
  type UseSubmitCommandResult,
  useSubmitCommand,
} from "./useSubmitCommand";
