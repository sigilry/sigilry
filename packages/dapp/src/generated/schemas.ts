// AUTO-GENERATED - DO NOT EDIT
// Generated from api-specs/openrpc-dapp-api.json and openrpc-user-api.json
// Run 'bun run codegen' to regenerate
import { z } from 'zod'

// =============================================================================
// Schemas
// =============================================================================

export const AccountsChangedEventSchema = z.array(z.object({ "primary": z.boolean().describe("Set as primary wallet for dApp usage."), "partyId": z.string().describe("The party ID corresponding to the wallet."), "status": z.enum(["initialized","allocated"]).describe("The status of the wallet."), "hint": z.string().describe("The party hint and name of the wallet."), "publicKey": z.string().describe("The public key of the party."), "namespace": z.string().describe("The namespace of the party."), "networkId": z.string().describe("The network ID the wallet corresponds to."), "signingProviderId": z.string().describe("The signing provider ID the wallet corresponds to."), "externalTxId": z.string().describe("Unique identifier of the signed transaction given by the Signing Provider. This may not be the same as the internal txId given by the Wallet Gateway.").optional(), "topologyTransactions": z.string().describe("The topology transactions").optional(), "disabled": z.boolean().describe("Whether the wallet is disabled. Wallets are disabled when no signing provider matches the party's namespace during sync. Disabled wallets use participant as the default signing provider.").optional(), "reason": z.string().describe("Reason for the wallet state, e.g., 'no signing provider matched'.").optional() }).describe("Structure representing a wallet")).describe("Event emitted when the user's accounts change.")

export const AuthSchema = z.object({ "method": z.string(), "scope": z.string(), "clientId": z.string(), "clientSecret": z.string().optional(), "issuer": z.string().optional(), "audience": z.string() }).strict().describe("Represents the type of auth for a specified network")

export const CommandIdSchema = z.string().describe("The unique identifier of the command associated with the transaction.")

export const DisclosedContractSchema = z.object({ "templateId": z.string().describe("The template identifier of the disclosed contract.").optional(), "contractId": z.string().describe("The unique identifier of the disclosed contract.").optional(), "createdEventBlob": z.string().describe("The blob data of the created event for the disclosed contract."), "synchronizerId": z.string().describe("The synchronizer identifier associated with the disclosed contract.").optional() }).describe("Structure representing a disclosed contract for transaction execution")

export const IdpSchema = z.object({ "id": z.string().describe("ID of the identity provider"), "type": z.enum(["oauth","self_signed"]).describe("Type of identity provider (oauth / self_signed)"), "issuer": z.string().describe("Issuer of identity provider"), "configUrl": z.string().describe("The configuration URL for the identity provider.").optional() }).strict().describe("Structure representing the Identity Providers")

export const JsCommandsSchema = z.record(z.string(), z.any()).describe("Structure representing JS commands for transaction execution")

export const JsPrepareSubmissionRequestSchema = z.object({ "commandId": z.string().describe("The unique identifier of the command associated with the transaction.").optional(), "commands": z.record(z.string(), z.any()).describe("Structure representing JS commands for transaction execution"), "actAs": z.array(z.string()).describe("Set of parties on whose behalf the command should be executed, if submitted. If not set, the primary wallet's party is used.").optional(), "readAs": z.array(z.string()).describe("Set of parties that should be granted read access to the command, if submitted. If not set, no additional read parties are granted.").optional(), "disclosedContracts": z.array(z.object({ "templateId": z.string().describe("The template identifier of the disclosed contract.").optional(), "contractId": z.string().describe("The unique identifier of the disclosed contract.").optional(), "createdEventBlob": z.string().describe("The blob data of the created event for the disclosed contract."), "synchronizerId": z.string().describe("The synchronizer identifier associated with the disclosed contract.").optional() }).describe("Structure representing a disclosed contract for transaction execution")).describe("List of contract IDs to be disclosed with the command.").optional(), "synchronizerId": z.string().describe("If not set, a suitable synchronizer that this node is connected to will be chosen.").optional(), "packageIdSelectionPreference": z.array(z.string()).describe("The package-id selection preference of the client for resolving package names and interface instances in command submission and interpretation").optional() }).describe("Structure representing the request for prepare and execute calls")

export const JsPrepareSubmissionResponseSchema = z.object({ "preparedTransaction": z.string().describe("The prepared transaction data.").optional(), "preparedTransactionHash": z.string().describe("The hash of the prepared transaction.").optional() }).describe("Structure representing the result of a prepareReturn call")

export const KernelInfoSchema = z.object({ "id": z.string().describe("The unique identifier of the Wallet Gateway."), "clientType": z.enum(["browser","desktop","mobile","remote"]).describe("The type of client that implements the Wallet Gateway."), "url": z.string().describe("The URL of the Wallet Gateway.").optional(), "userUrl": z.string().url().describe("A URL that points to a user interface.").optional() }).describe("Represents a Wallet Gateway.")

export const LedgerApiRequestSchema = z.object({ "requestMethod": z.enum(["GET","POST","PUT","DELETE"]), "resource": z.string(), "body": z.string().optional() }).describe("Ledger API request structure")

export const LedgerApiResultSchema = z.object({ "response": z.string() }).describe("Ledger Api configuration options")

export const ListAccountsResultSchema = z.array(z.object({ "primary": z.boolean().describe("Set as primary wallet for dApp usage."), "partyId": z.string().describe("The party ID corresponding to the wallet."), "status": z.enum(["initialized","allocated"]).describe("The status of the wallet."), "hint": z.string().describe("The party hint and name of the wallet."), "publicKey": z.string().describe("The public key of the party."), "namespace": z.string().describe("The namespace of the party."), "networkId": z.string().describe("The network ID the wallet corresponds to."), "signingProviderId": z.string().describe("The signing provider ID the wallet corresponds to."), "externalTxId": z.string().describe("Unique identifier of the signed transaction given by the Signing Provider. This may not be the same as the internal txId given by the Wallet Gateway.").optional(), "topologyTransactions": z.string().describe("The topology transactions").optional(), "disabled": z.boolean().describe("Whether the wallet is disabled. Wallets are disabled when no signing provider matches the party's namespace during sync. Disabled wallets use participant as the default signing provider.").optional(), "reason": z.string().describe("Reason for the wallet state, e.g., 'no signing provider matched'.").optional() }).describe("Structure representing a wallet")).describe("An array of accounts that the user has authorized the dapp to access..")

export const NetworkSchema = z.object({ "networkId": z.string().describe("A CAIP-2 compliant chain ID, e.g. 'canton:da-mainnet'."), "ledgerApi": z.object({ "baseUrl": z.string().url().describe("The base URL of the ledger API.") }).describe("Ledger API configuration.").optional() }).describe("Network information, if connected to a network.")

export const NullSchema = z.null().describe("Represents a null value, used in responses where no data is returned.")

export const SessionSchema = z.object({ "id": z.string().describe("The unique identifier of the session."), "network": z.object({ "networkId": z.string().describe("A CAIP-2 compliant chain ID, e.g. 'canton:da-mainnet'."), "ledgerApi": z.object({ "baseUrl": z.string().url().describe("The base URL of the ledger API.") }).describe("Ledger API configuration.").optional() }).describe("Network information, if connected to a network."), "idp": z.object({ "id": z.string().describe("ID of the identity provider"), "type": z.enum(["oauth","self_signed"]).describe("Type of identity provider (oauth / self_signed)"), "issuer": z.string().describe("Issuer of identity provider"), "configUrl": z.string().describe("The configuration URL for the identity provider.").optional() }).strict().describe("Structure representing the Identity Providers"), "accessToken": z.string().describe("The access token for the session."), "status": z.enum(["connected","disconnected"]), "reason": z.string().describe("The reason for the current status.").optional() }).strict().describe("Structure representing the connected network session")

export const SignMessageRequestSchema = z.object({ "message": z.string().describe("The message to sign.") }).describe("Request to sign a message.")

export const SignMessageResultSchema = z.object({ "signature": z.string().describe("The signature of the message.") }).describe("Result of signing a message.")

export const SigningProviderContextSchema = z.object({ "partyId": z.string().describe("The party ID corresponding to the wallet."), "externalTxId": z.string().describe("The transaction ID"), "topologyTransactions": z.string().describe("The topology transactions"), "namespace": z.string().describe("The namespace of wallet") }).describe("Indicates that the wallet has been created in the database but hasn't yet been allocated by the participant.")

export const StatusEventSchema = z.object({ "kernel": z.object({ "id": z.string().describe("The unique identifier of the Wallet Gateway."), "clientType": z.enum(["browser","desktop","mobile","remote"]).describe("The type of client that implements the Wallet Gateway."), "url": z.string().describe("The URL of the Wallet Gateway.").optional(), "userUrl": z.string().url().describe("A URL that points to a user interface.").optional() }).describe("Represents a Wallet Gateway."), "isConnected": z.boolean().describe("Whether or not the user is authenticated with the Wallet."), "isNetworkConnected": z.boolean().describe("Whether or not a connection to a network is established."), "networkReason": z.string().describe("If not connected to a network, the reason why.").optional(), "network": z.object({ "networkId": z.string().describe("A CAIP-2 compliant chain ID, e.g. 'canton:da-mainnet'."), "ledgerApi": z.object({ "baseUrl": z.string().url().describe("The base URL of the ledger API.") }).describe("Ledger API configuration.").optional() }).describe("Network information, if connected to a network.").optional(), "session": z.object({ "accessToken": z.string().describe("JWT authentication token."), "userId": z.string().describe("The user identifier.") }).describe("Session information, if authenticated.").optional() })

export const TransactionSchema = z.object({ "commandId": z.string().describe("The unique identifier of the command associated with the transaction."), "status": z.string().describe("The status of the transaction."), "preparedTransaction": z.string().describe("The transaction data corresponding to the command ID."), "preparedTransactionHash": z.string().describe("The hash of the prepared transaction."), "payload": z.string().describe("Optional payload associated with the transaction.").optional(), "origin": z.string().describe("The origin (dApp URL) that initiated this transaction request.").optional() })

export const TxChangedExecutedEventSchema = z.object({ "status": z.literal("executed").describe("The status of the transaction."), "commandId": z.string().describe("The unique identifier of the command associated with the transaction."), "payload": z.object({ "updateId": z.string().describe("The update ID corresponding to the transaction."), "completionOffset": z.number().int() }).strict().describe("Payload for the TxChangedExecutedEvent.") }).strict().describe("Event emitted when a transaction is executed against the participant.")

export const TxChangedExecutedPayloadSchema = z.object({ "updateId": z.string().describe("The update ID corresponding to the transaction."), "completionOffset": z.number().int() }).strict().describe("Payload for the TxChangedExecutedEvent.")

export const TxChangedFailedEventSchema = z.object({ "status": z.literal("failed").describe("The status of the transaction."), "commandId": z.string().describe("The unique identifier of the command associated with the transaction.") }).strict().describe("Event emitted when a transaction has failed.")

export const TxChangedPendingEventSchema = z.object({ "status": z.literal("pending").describe("The status of the transaction."), "commandId": z.string().describe("The unique identifier of the command associated with the transaction.") }).strict().describe("Event emitted when a transaction is pending.")

export const TxChangedSignedEventSchema = z.object({ "status": z.literal("signed").describe("The status of the transaction."), "commandId": z.string().describe("The unique identifier of the command associated with the transaction."), "payload": z.object({ "signature": z.string().describe("The signature of the transaction."), "signedBy": z.string().describe("The identifier of the provider that signed the transaction."), "party": z.string().describe("The party that signed the transaction.") }).strict().describe("Payload for the TxChangedSignedEvent.") }).strict().describe("Event emitted when a transaction has been signed.")

export const TxChangedSignedPayloadSchema = z.object({ "signature": z.string().describe("The signature of the transaction."), "signedBy": z.string().describe("The identifier of the provider that signed the transaction."), "party": z.string().describe("The party that signed the transaction.") }).strict().describe("Payload for the TxChangedSignedEvent.")

export const UserUrlSchema = z.string().url().describe("A URL that points to a user interface.")

export const WalletSchema = z.object({ "primary": z.boolean().describe("Set as primary wallet for dApp usage."), "partyId": z.string().describe("The party ID corresponding to the wallet."), "status": z.enum(["initialized","allocated"]).describe("The status of the wallet."), "hint": z.string().describe("The party hint and name of the wallet."), "publicKey": z.string().describe("The public key of the party."), "namespace": z.string().describe("The namespace of the party."), "networkId": z.string().describe("The network ID the wallet corresponds to."), "signingProviderId": z.string().describe("The signing provider ID the wallet corresponds to."), "externalTxId": z.string().describe("Unique identifier of the signed transaction given by the Signing Provider. This may not be the same as the internal txId given by the Wallet Gateway.").optional(), "topologyTransactions": z.string().describe("The topology transactions").optional(), "disabled": z.boolean().describe("Whether the wallet is disabled. Wallets are disabled when no signing provider matches the party's namespace during sync. Disabled wallets use participant as the default signing provider.").optional(), "reason": z.string().describe("Reason for the wallet state, e.g., 'no signing provider matched'.").optional() }).describe("Structure representing a wallet")

export const WalletFilterSchema = z.object({ "networkIds": z.array(z.string()).describe("Filter wallets by network IDs.").optional(), "signingProviderIds": z.array(z.string()).describe("Filter wallets by signing provider IDs.").optional() }).describe("Filter for wallets")

export const TxChangedEventSchema = z.union([TxChangedPendingEventSchema, TxChangedSignedEventSchema, TxChangedExecutedEventSchema, TxChangedFailedEventSchema]).describe("Event emitted when a transaction changes.")

export const PrepareExecuteAndWaitResultSchema = z.object({ "tx": z.object({ "status": z.literal("executed").describe("The status of the transaction."), "commandId": z.string().describe("The unique identifier of the command associated with the transaction."), "payload": z.object({ "updateId": z.string().describe("The update ID corresponding to the transaction."), "completionOffset": z.number().int() }).strict().describe("Payload for the TxChangedExecutedEvent.") }).strict().describe("Event emitted when a transaction is executed against the participant.") })

// =============================================================================
// Types (inferred from schemas)
// =============================================================================

export type AccountsChangedEvent = z.infer<typeof AccountsChangedEventSchema>
export type Auth = z.infer<typeof AuthSchema>
export type CommandId = z.infer<typeof CommandIdSchema>
export type DisclosedContract = z.infer<typeof DisclosedContractSchema>
export type Idp = z.infer<typeof IdpSchema>
export type JsCommands = z.infer<typeof JsCommandsSchema>
export type JsPrepareSubmissionRequest = z.infer<typeof JsPrepareSubmissionRequestSchema>
export type JsPrepareSubmissionResponse = z.infer<typeof JsPrepareSubmissionResponseSchema>
export type KernelInfo = z.infer<typeof KernelInfoSchema>
export type LedgerApiRequest = z.infer<typeof LedgerApiRequestSchema>
export type LedgerApiResult = z.infer<typeof LedgerApiResultSchema>
export type ListAccountsResult = z.infer<typeof ListAccountsResultSchema>
export type Network = z.infer<typeof NetworkSchema>
export type Null = z.infer<typeof NullSchema>
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
export type TxChangedEvent = z.infer<typeof TxChangedEventSchema>
export type PrepareExecuteAndWaitResult = z.infer<typeof PrepareExecuteAndWaitResultSchema>

// =============================================================================
// RPC Method Types
// =============================================================================

export interface RpcMethods {
  status: { params: void; result: StatusEvent }
  connect: { params: void; result: StatusEvent }
  disconnect: { params: void; result: Null }
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
