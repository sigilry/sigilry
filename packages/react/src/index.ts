/**
 * @sigilry/react - React hooks and context for Canton wallet integration
 *
 * Provides react-query powered hooks following wagmi patterns.
 *
 * @example
 * ```tsx
 * import { CantonReactProvider, useConnect, useLedgerEnd } from '@sigilry/react'
 * import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
 *
 * const queryClient = new QueryClient()
 *
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <CantonReactProvider>
 *         <MyDApp />
 *       </CantonReactProvider>
 *     </QueryClientProvider>
 *   )
 * }
 * ```
 */

// Context
export { type CantonContextValue, CantonReactProvider, useCanton } from "./context";

// Hooks
export {
  type ActiveContract,
  type ActiveContractsResponse,
  type ArchivedEvent,
  type ContractEvent,
  type CreatedEvent,
  type ExecutedPayload,
  type ExerciseChoiceRequest,
  type JwtPayload,
  type LedgerApiRequest,
  type LedgerApiResponse,
  type UseLedgerApiOptions,
  type LedgerEndResponse,
  parseJwt,
  type SessionState,
  type StreamedContract,
  type SubmitCommandRequest,
  type SubmitCommandResult,
  type TransactionUpdate,
  type UpdateTemplateFilter,
  type UseAccountsResult,
  type UseActiveAccountResult,
  type UseActiveContractsOptions,
  type UseActiveContractsResult,
  type UseCantonProviderResult,
  type UseConnectResult,
  type UseContractStreamOptions,
  type UseContractStreamResult,
  type UseDisconnectResult,
  type UseExerciseChoiceResult,
  type UseLedgerApiResult,
  type UseLedgerEndOptions,
  type UseLedgerEndResult,
  type UseLedgerUpdatesOptions,
  type UseLedgerUpdatesResult,
  type UseSessionOptions,
  type UseSessionResult,
  type UseSubmitCommandResult,
  useAccounts,
  useActiveAccount,
  useActiveContracts,
  useCantonProvider,
  useConnect,
  useContractStream,
  useDisconnect,
  useExerciseChoice,
  useLedgerApi,
  useLedgerEnd,
  useLedgerUpdates,
  useSession,
  useSubmitCommand,
} from "./hooks";

// Types
export type {
  Account,
  CantonProvider,
  ConnectionState,
  ErrorAction,
  KnownErrorCode,
  ParsedError,
  StatusResult,
  StatusType,
  TxEvent,
} from "./types";
export { parseError, parsePartyId } from "./types";
