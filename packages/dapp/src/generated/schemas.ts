// AUTO-GENERATED - DO NOT EDIT
// Generated from api-specs/openrpc-dapp-api.json and openrpc-user-api.json
// Run 'bun run codegen' to regenerate
import { z } from 'zod'

// =============================================================================
// Schemas
// =============================================================================

export const AccessTokenSchema = z.string().describe("JWT authentication token.")

export const AuthSchema = z.object({ "method": z.string(), "scope": z.string(), "clientId": z.string(), "clientSecret": z.string().optional(), "issuer": z.string().optional(), "audience": z.string() }).strict().describe("Represents the type of auth for a specified network")

export const CommandIdSchema = z.string().describe("The unique identifier of the command associated with the transaction.")

export const ConnectResultSchema = z.object({ "isConnected": z.boolean().describe("Whether or not the user is authenticated with the Wallet."), "reason": z.string().describe("The reason why the user is not connected to the Wallet.").optional(), "isNetworkConnected": z.boolean().describe("Whether or not a connection to a network is established."), "networkReason": z.string().describe("If not connected to a network, the reason why.").optional(), "userUrl": z.string().url().describe("A URL that points to a user interface.").optional() }).strict()

export const CreateAndExerciseCommandSchema = z.object({ "CreateAndExerciseCommand": z.record(z.string(), z.any()).describe("Inner shape is defined by the Canton Ledger API CreateAndExerciseCommand schema; do not re-specify here.") }).strict()

export const CreateCommandSchema = z.object({ "CreateCommand": z.object({ "templateId": z.string().describe("The template identifier of the contract to create."), "createArguments": z.record(z.string(), z.any()).describe("Opaque template-specific create payload forwarded to the Canton Ledger API.") }).strict().describe("Canonical CIP-0103 CreateCommand shape. The createArguments payload stays opaque at the dApp boundary.") }).strict()

export const DisclosedContractSchema = z.object({ "templateId": z.string().describe("The template identifier of the disclosed contract.").optional(), "contractId": z.string().describe("The unique identifier of the disclosed contract.").optional(), "createdEventBlob": z.string().describe("The blob data of the created event for the disclosed contract."), "synchronizerId": z.string().describe("The synchronizer identifier associated with the disclosed contract.").optional() }).strict().describe("Structure representing a disclosed contract for transaction execution")

export const ExerciseByKeyCommandSchema = z.object({ "ExerciseByKeyCommand": z.record(z.string(), z.any()).describe("Inner shape is defined by the Canton Ledger API ExerciseByKeyCommand schema; do not re-specify here.") }).strict()

export const ExerciseCommandSchema = z.object({ "ExerciseCommand": z.object({ "templateId": z.string().describe("The template identifier of the contract being exercised."), "contractId": z.string().describe("The contract identifier to exercise."), "choice": z.string().describe("The choice name to exercise."), "choiceArgument": z.record(z.string(), z.any()).describe("Opaque choice payload forwarded to the Canton Ledger API.") }).strict().describe("Canonical CIP-0103 ExerciseCommand shape. The choiceArgument payload stays opaque at the dApp boundary.") }).strict()

export const IdpSchema = z.object({ "id": z.string().describe("ID of the identity provider"), "type": z.enum(["oauth","self_signed"]).describe("Type of identity provider (oauth / self_signed)"), "issuer": z.string().describe("Issuer of identity provider"), "configUrl": z.string().describe("The configuration URL for the identity provider.").optional() }).strict().describe("Structure representing the Identity Providers")

export const JsPrepareSubmissionResponseSchema = z.object({ "preparedTransaction": z.string().describe("The prepared transaction data.").optional(), "preparedTransactionHash": z.string().describe("The hash of the prepared transaction.").optional() }).strict().describe("Structure representing the result of a prepareReturn call")

export const LedgerApiRequestSchema = z.object({ "requestMethod": z.enum(["get","post","patch","put","delete"]), "resource": z.string(), "body": z.record(z.string(), z.any()).optional(), "query": z.record(z.string(), z.any()).describe("Query parameters as key-value pairs.").optional(), "path": z.record(z.string(), z.any()).describe("Path parameters as key-value pairs.").optional(), "headers": z.record(z.string(), z.any()).describe("Additional HTTP headers to include with the request.").optional() }).strict().describe("Ledger API request structure")

// NOTE: openrpc-dapp-api.json#/components/schemas/LedgerApiResult still says type: object.
// Keep arrays allowed here until the upstream schema matches real Ledger API list responses.
export const LedgerApiResultSchema = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).describe("Ledger Api response")

export const NetworkSchema = z.object({ "networkId": z.string().describe("A CAIP-2 compliant chain ID, e.g. 'canton:da-mainnet'."), "ledgerApi": z.string().url().describe("The base URL of the ledger API.").optional(), "accessToken": z.string().describe("JWT authentication token.").optional() }).strict().describe("Network information, if connected to a network.")

export const NullSchema = z.null().describe("Represents a null value, used in responses where no data is returned.")

export const ProviderSchema = z.object({ "id": z.string().describe("The unique identifier of the Provider."), "version": z.string().describe("The version of the Provider.").optional(), "providerType": z.enum(["browser","desktop","mobile","remote"]).describe("The type of client that implements the Provider."), "url": z.string().describe("The URL of the Wallet Provider.").optional(), "userUrl": z.string().url().describe("A URL that points to a user interface.").optional() }).strict().describe("Represents a Provider.")

export const SessionSchema = z.object({ "accessToken": z.string().describe("JWT authentication token."), "userId": z.string().describe("The user identifier.") }).strict().describe("Session information, if authenticated.")

export const SignMessageRequestSchema = z.object({ "message": z.string().describe("The message to sign.") }).strict().describe("Request to sign a message.")

export const SignMessageResultSchema = z.object({ "signature": z.string().describe("The signature of the message.") }).strict().describe("Result of signing a message.")

export const SigningProviderContextSchema = z.object({ "partyId": z.string().describe("The party ID corresponding to the wallet."), "externalTxId": z.string().describe("The transaction ID"), "topologyTransactions": z.string().describe("The topology transactions"), "namespace": z.string().describe("The namespace of wallet") }).describe("Indicates that the wallet has been created in the database but hasn't yet been allocated by the participant.")

export const StatusEventSchema = z.object({ "provider": z.object({ "id": z.string().describe("The unique identifier of the Provider."), "version": z.string().describe("The version of the Provider.").optional(), "providerType": z.enum(["browser","desktop","mobile","remote"]).describe("The type of client that implements the Provider."), "url": z.string().describe("The URL of the Wallet Provider.").optional(), "userUrl": z.string().url().describe("A URL that points to a user interface.").optional() }).strict().describe("Represents a Provider."), "connection": z.object({ "isConnected": z.boolean().describe("Whether or not the user is authenticated with the Wallet."), "reason": z.string().describe("The reason why the user is not connected to the Wallet.").optional(), "isNetworkConnected": z.boolean().describe("Whether or not a connection to a network is established."), "networkReason": z.string().describe("If not connected to a network, the reason why.").optional(), "userUrl": z.string().url().describe("A URL that points to a user interface.").optional() }).strict(), "network": z.object({ "networkId": z.string().describe("A CAIP-2 compliant chain ID, e.g. 'canton:da-mainnet'."), "ledgerApi": z.string().url().describe("The base URL of the ledger API.").optional(), "accessToken": z.string().describe("JWT authentication token.").optional() }).strict().describe("Network information, if connected to a network.").optional(), "session": z.object({ "accessToken": z.string().describe("JWT authentication token."), "userId": z.string().describe("The user identifier.") }).strict().describe("Session information, if authenticated.").optional() }).strict()

export const TransactionSchema = z.object({ "commandId": z.string().describe("The unique identifier of the command associated with the transaction."), "status": z.string().describe("The status of the transaction."), "preparedTransaction": z.string().describe("The transaction data corresponding to the command ID."), "preparedTransactionHash": z.string().describe("The hash of the prepared transaction."), "payload": z.string().describe("Optional payload associated with the transaction.").optional(), "origin": z.string().describe("The origin (dApp URL) that initiated this transaction request.").optional() })

export const TxChangedExecutedEventSchema = z.object({ "status": z.literal("executed").describe("The status of the transaction."), "commandId": z.string().describe("The unique identifier of the command associated with the transaction."), "payload": z.object({ "updateId": z.string().describe("The update ID corresponding to the transaction."), "completionOffset": z.number().int() }).strict().describe("Payload for the TxChangedExecutedEvent.") }).strict().describe("Event emitted when a transaction is executed against the participant.")

export const TxChangedExecutedPayloadSchema = z.object({ "updateId": z.string().describe("The update ID corresponding to the transaction."), "completionOffset": z.number().int() }).strict().describe("Payload for the TxChangedExecutedEvent.")

export const TxChangedFailedEventSchema = z.object({ "status": z.literal("failed").describe("The status of the transaction."), "commandId": z.string().describe("The unique identifier of the command associated with the transaction.") }).strict().describe("Event emitted when a transaction has failed.")

export const TxChangedPendingEventSchema = z.object({ "status": z.literal("pending").describe("The status of the transaction."), "commandId": z.string().describe("The unique identifier of the command associated with the transaction.") }).strict().describe("Event emitted when a transaction is pending.")

export const TxChangedSignedEventSchema = z.object({ "status": z.literal("signed").describe("The status of the transaction."), "commandId": z.string().describe("The unique identifier of the command associated with the transaction."), "payload": z.object({ "signature": z.string().describe("The signature of the transaction."), "signedBy": z.string().describe("The identifier of the provider that signed the transaction."), "party": z.string().describe("The party that signed the transaction.") }).strict().describe("Payload for the TxChangedSignedEvent.") }).strict().describe("Event emitted when a transaction has been signed.")

export const TxChangedSignedPayloadSchema = z.object({ "signature": z.string().describe("The signature of the transaction."), "signedBy": z.string().describe("The identifier of the provider that signed the transaction."), "party": z.string().describe("The party that signed the transaction.") }).strict().describe("Payload for the TxChangedSignedEvent.")

export const UserUrlSchema = z.string().url().describe("A URL that points to a user interface.")

export const WalletSchema = z.object({ "primary": z.boolean().describe("Set as primary wallet for dApp usage."), "partyId": z.string().describe("The party ID corresponding to the wallet."), "status": z.enum(["initialized","allocated","removed"]).describe("The status of the wallet."), "hint": z.string().describe("The party hint and name of the wallet."), "publicKey": z.string().describe("The public key of the party."), "namespace": z.string().describe("The namespace of the party."), "networkId": z.string().describe("The network ID the wallet corresponds to."), "signingProviderId": z.string().describe("The signing provider ID the wallet corresponds to."), "externalTxId": z.string().describe("Unique identifier of the signed transaction given by the Signing Provider. This may not be the same as the internal txId given by the Wallet Gateway.").optional(), "topologyTransactions": z.string().describe("The topology transactions").optional(), "disabled": z.boolean().describe("Whether the wallet is disabled. Wallets are disabled when no signing provider matches the party's namespace during sync. Disabled wallets use participant as the default signing provider.").optional(), "reason": z.string().describe("Reason for the wallet state, e.g., 'no signing provider matched'.").optional() }).strict().describe("Structure representing a wallet")

export const WalletFilterSchema = z.object({ "networkIds": z.array(z.string()).describe("Filter wallets by network IDs.").optional(), "signingProviderIds": z.array(z.string()).describe("Filter wallets by signing provider IDs.").optional() }).describe("Filter for wallets")

export const CommandSchema = z.union([CreateCommandSchema, ExerciseCommandSchema, CreateAndExerciseCommandSchema, ExerciseByKeyCommandSchema]).describe("A Daml command atom. Mirror of the Canton Ledger API Command union; inner shapes are intentionally opaque so the dApp layer never drifts from the Ledger API contract.")

export const TxChangedEventSchema = z.union([TxChangedPendingEventSchema, TxChangedSignedEventSchema, TxChangedExecutedEventSchema, TxChangedFailedEventSchema]).describe("Event emitted when a transaction changes.")

export const AccountsChangedEventSchema = z.array(WalletSchema).describe("Event emitted when the user's accounts change.")

export const JsCommandsSchema = z.array(CommandSchema).min(1).describe("Non-empty array of Daml command atoms to submit atomically as a single transaction.")

export const JsPrepareSubmissionRequestSchema = z.object({ "commandId": CommandIdSchema.optional(), "commands": JsCommandsSchema, "actAs": z.array(z.string()).describe("Set of parties on whose behalf the command should be executed, if submitted. If not set, the primary wallet's party is used.").optional(), "readAs": z.array(z.string()).describe("Set of parties that should be granted read access to the command, if submitted. If not set, no additional read parties are granted.").optional(), "disclosedContracts": z.array(DisclosedContractSchema).describe("List of contract IDs to be disclosed with the command.").optional(), "synchronizerId": z.string().describe("If not set, a suitable synchronizer that this node is connected to will be chosen.").optional(), "packageIdSelectionPreference": z.array(z.string()).describe("The package-id selection preference of the client for resolving package names and interface instances in command submission and interpretation").optional() }).strict().describe("Structure representing the request for prepare and execute calls")

export const ListAccountsResultSchema = z.array(WalletSchema).describe("An array of accounts that the user has authorized the dapp to access..")

export const PrepareExecuteAndWaitResultSchema = z.object({ "tx": z.object({ "status": z.literal("executed").describe("The status of the transaction."), "commandId": z.string().describe("The unique identifier of the command associated with the transaction."), "payload": z.object({ "updateId": z.string().describe("The update ID corresponding to the transaction."), "completionOffset": z.number().int() }).strict().describe("Payload for the TxChangedExecutedEvent.") }).strict().describe("Event emitted when a transaction is executed against the participant.") }).strict()

// =============================================================================
// Types (inferred from schemas)
// =============================================================================

export type AccessToken = z.infer<typeof AccessTokenSchema>
export type Auth = z.infer<typeof AuthSchema>
export type CommandId = z.infer<typeof CommandIdSchema>
export type ConnectResult = z.infer<typeof ConnectResultSchema>
export type CreateAndExerciseCommand = z.infer<typeof CreateAndExerciseCommandSchema>
export type CreateCommand = z.infer<typeof CreateCommandSchema>
export type DisclosedContract = z.infer<typeof DisclosedContractSchema>
export type ExerciseByKeyCommand = z.infer<typeof ExerciseByKeyCommandSchema>
export type ExerciseCommand = z.infer<typeof ExerciseCommandSchema>
export type Idp = z.infer<typeof IdpSchema>
export type JsPrepareSubmissionResponse = z.infer<typeof JsPrepareSubmissionResponseSchema>
export type LedgerApiRequest = z.infer<typeof LedgerApiRequestSchema>
export type LedgerApiResult = z.infer<typeof LedgerApiResultSchema>
export type Network = z.infer<typeof NetworkSchema>
export type Null = z.infer<typeof NullSchema>
export type Provider = z.infer<typeof ProviderSchema>
export type Session = z.infer<typeof SessionSchema>
export type SignMessageRequest = z.infer<typeof SignMessageRequestSchema>
export type SignMessageResult = z.infer<typeof SignMessageResultSchema>
export type SigningProviderContext = z.infer<typeof SigningProviderContextSchema>
export type StatusEvent = z.infer<typeof StatusEventSchema>
export type Transaction = z.infer<typeof TransactionSchema>
export type TxChangedExecutedEvent = z.infer<typeof TxChangedExecutedEventSchema>
export type TxChangedExecutedPayload = z.infer<typeof TxChangedExecutedPayloadSchema>
export type TxChangedFailedEvent = z.infer<typeof TxChangedFailedEventSchema>
export type TxChangedPendingEvent = z.infer<typeof TxChangedPendingEventSchema>
export type TxChangedSignedEvent = z.infer<typeof TxChangedSignedEventSchema>
export type TxChangedSignedPayload = z.infer<typeof TxChangedSignedPayloadSchema>
export type UserUrl = z.infer<typeof UserUrlSchema>
export type Wallet = z.infer<typeof WalletSchema>
export type WalletFilter = z.infer<typeof WalletFilterSchema>
export type Command = z.infer<typeof CommandSchema>
export type TxChangedEvent = z.infer<typeof TxChangedEventSchema>
export type AccountsChangedEvent = z.infer<typeof AccountsChangedEventSchema>
export type JsCommands = z.infer<typeof JsCommandsSchema>
export type JsPrepareSubmissionRequest = z.infer<typeof JsPrepareSubmissionRequestSchema>
export type ListAccountsResult = z.infer<typeof ListAccountsResultSchema>
export type PrepareExecuteAndWaitResult = z.infer<typeof PrepareExecuteAndWaitResultSchema>

// =============================================================================
// RPC Method Types
// =============================================================================

export interface RpcMethods {
  status: { params: void; result: StatusEvent }
  connect: { params: void; result: ConnectResult }
  disconnect: { params: void; result: Null }
  isConnected: { params: void; result: ConnectResult }
  getActiveNetwork: { params: void; result: Network }
  prepareExecute: { params: JsPrepareSubmissionRequest; result: Null }
  prepareExecuteAndWait: { params: JsPrepareSubmissionRequest; result: PrepareExecuteAndWaitResult }
  signMessage: { params: SignMessageRequest; result: SignMessageResult }
  ledgerApi: { params: LedgerApiRequest; result: LedgerApiResult }
  accountsChanged: { params: void; result: AccountsChangedEvent }
  getPrimaryAccount: { params: void; result: Wallet }
  listAccounts: { params: void; result: ListAccountsResult }
  txChanged: { params: void; result: TxChangedEvent }
}
