import { describe, expect, test } from "bun:test";
import { useConnect } from "../src/index.js";
import {
  act,
  CONNECTED_STATUS,
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

describe("useConnect", () => {
  test("surfaces refused connects as mutation errors", async () => {
    installMockProvider(
      createMockProvider(({ method }) => {
        if (method === "status") return DISCONNECTED_STATUS;
        if (method === "connect") {
          return {
            isConnected: false,
            reason: "User cancelled",
            isNetworkConnected: false,
          };
        }

        throw new Error(`Unhandled method: ${method}`);
      }),
    );

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useConnect(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.connectAsync()).rejects.toEqual({
        message: "User cancelled",
        code: "NOT_CONNECTED",
        action: { type: "retry" },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual({
        message: "User cancelled",
        code: "NOT_CONNECTED",
        action: { type: "retry" },
      });
    });
  });

  test("returns successful connect results without setting mutation errors", async () => {
    const connectResult = {
      isConnected: true,
      isNetworkConnected: true,
    };

    installMockProvider(
      createMockProvider(({ method }) => {
        if (method === "status") return CONNECTED_STATUS;
        if (method === "connect") {
          return connectResult;
        }
        if (method === "listAccounts") {
          return [TEST_ACCOUNT];
        }

        throw new Error(`Unhandled method: ${method}`);
      }),
    );

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useConnect(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.connectAsync()).resolves.toEqual(connectResult);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
