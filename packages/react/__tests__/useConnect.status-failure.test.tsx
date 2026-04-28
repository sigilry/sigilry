import { describe, expect, test } from "bun:test";
import { useCanton } from "../src/context.js";
import { useConnect } from "../src/index.js";
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

describe("useConnect post-connect status failures", () => {
  test("preserves a successful connect result when a follow-up status probe fails", async () => {
    let statusCalls = 0;
    const onErrorCalls: ParsedError[] = [];
    const connectResult = {
      isConnected: true,
      isNetworkConnected: true,
      userUrl: "https://wallet.example/connect",
      accounts: [TEST_ACCOUNT],
    };

    installMockProvider(
      createMockProvider(({ method }) => {
        if (method === "status") {
          statusCalls += 1;
          if (statusCalls === 1) {
            return DISCONNECTED_STATUS;
          }

          throw new Error("status exploded");
        }
        if (method === "connect") {
          return connectResult;
        }
        if (method === "listAccounts") {
          return connectResult.accounts;
        }

        throw new Error(`Unhandled method: ${method}`);
      }),
    );

    const { Wrapper } = createHookWrapper({
      onError: (error) => {
        onErrorCalls.push(error);
      },
    });
    const { result } = renderHook(() => ({ connect: useConnect(), canton: useCanton() }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.canton.providerReady).toBe(true);
    });

    await act(async () => {
      await expect(result.current.connect.connectAsync()).resolves.toEqual(connectResult);
    });

    await waitFor(() => {
      expect(result.current.canton.connectionState).toEqual({
        status: "connected",
        accounts: [TEST_ACCOUNT],
        networkId: TEST_ACCOUNT.networkId,
      });
    });

    expect(onErrorCalls).toEqual([]);
  });
});
