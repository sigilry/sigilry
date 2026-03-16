/**
 * Type-safe request types for Canton dApp API.
 *
 * These types enforce that dApps use canonical OpenRPC methods with
 * correct params and receive correctly typed results.
 */
import type { RpcMethods } from "../generated/schemas.js";

/**
 * Union of all valid RPC method names.
 */
export type RpcMethodName = keyof RpcMethods;

/**
 * Type-safe request payload.
 *
 * Makes illegal states unrepresentable:
 * - Methods with void params: `params` is optional and must be undefined
 * - Methods with params: `params` is required with the correct type
 */
export type TypedRequestPayload<M extends RpcMethodName> = RpcMethods[M]["params"] extends void
  ? { method: M; params?: undefined }
  : { method: M; params: RpcMethods[M]["params"] };

/**
 * Result type for a given method.
 */
export type TypedResult<M extends RpcMethodName> = RpcMethods[M]["result"];

/**
 * Type-safe request function.
 *
 * Strictly typed to canonical OpenRPC methods only.
 * Use the method name as a literal type to get correct params/result types.
 *
 * @example
 * const status = await provider.request({ method: 'status' })
 * // status is StatusEvent
 *
 * const result = await provider.request({
 *   method: 'prepareExecuteAndWait',
 *   params: { commands: {...}, commandId: 'cmd-1' }
 * })
 * // result is PrepareExecuteAndWaitResult
 */
export type TypedRequestFn = <M extends RpcMethodName>(
  request: TypedRequestPayload<M>,
) => Promise<TypedResult<M>>;

/**
 * Union type of all valid request payloads.
 * Useful for runtime validation or narrowing.
 */
export type AnyTypedRequestPayload = {
  [M in RpcMethodName]: TypedRequestPayload<M>;
}[RpcMethodName];
