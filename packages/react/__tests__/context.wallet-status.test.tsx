import { describe, expect, test } from "bun:test";
import { useCanton } from "../src/context.js";
import type { ParsedError } from "../src/types.js";
import {
  act,
  DISCONNECTED_STATUS,
  TEST_ACCOUNT,
  createHookWrapper,
  createMockProvider,
  installMockProvider,
  registerTestIsolation,
  renderHook,
  waitFor,
} from "./testUtils.js";

registerTestIsolation();

const WALLET_STATUSES = ["initialized", "allocated", "removed"] as const;

describe("CantonReactProvider wallet status handling", () => {
  test.each(WALLET_STATUSES)(
    "preserves %s wallet status values from accountsChanged",
    async (status) => {
      const provider = createMockProvider(({ method }) => {
        if (method === "status") {
          return DISCONNECTED_STATUS;
        }

        throw new Error(`Unhandled method: ${method}`);
      });

      installMockProvider(provider);

      const { Wrapper } = createHookWrapper();
      const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.providerReady).toBe(true);
      });

      act(() => {
        provider.emit("accountsChanged", [{ ...TEST_ACCOUNT, status }]);
      });

      await waitFor(() => {
        expect(result.current.connectionState).toEqual({
          status: "connected",
          accounts: [{ ...TEST_ACCOUNT, status }],
          networkId: TEST_ACCOUNT.networkId,
        });
      });
    },
  );

  test("defaults missing wallet statuses to allocated without rewriting explicit spec values", async () => {
    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return DISCONNECTED_STATUS;
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.providerReady).toBe(true);
    });

    act(() => {
      const { status: _status, ...accountWithoutStatus } = TEST_ACCOUNT;
      provider.emit("accountsChanged", [accountWithoutStatus]);
    });

    await waitFor(() => {
      expect(result.current.connectionState).toEqual({
        status: "connected",
        accounts: [{ ...TEST_ACCOUNT, status: "allocated" }],
        networkId: TEST_ACCOUNT.networkId,
      });
    });
  });

  test("reports invalid explicit wallet status values instead of coercing them into connected state", async () => {
    const onErrorCalls: ParsedError[] = [];
    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return DISCONNECTED_STATUS;
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createHookWrapper({
      onError: (error) => {
        onErrorCalls.push(error);
      },
    });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.providerReady).toBe(true);
    });

    act(() => {
      provider.emit("accountsChanged", [{ ...TEST_ACCOUNT, status: "pending" }]);
    });

    expect(result.current.connectionState).toEqual({ status: "disconnected" });
    expect(onErrorCalls).toHaveLength(1);
    expect(onErrorCalls[0]).toMatchObject({
      code: "INTERNAL_ERROR",
      action: { type: "retry" },
    });
  });
});
