import { describe, expect, test } from "bun:test";
import { useCanton } from "../src/context.js";
import type { ParsedError } from "../src/types.js";
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

describe("CantonReactProvider", () => {
  test("connect() sets connected state after a successful connect flow", async () => {
    let connected = false;

    installMockProvider(
      createMockProvider(({ method }) => {
        if (method === "status") {
          return connected ? CONNECTED_STATUS : DISCONNECTED_STATUS;
        }
        if (method === "connect") {
          connected = true;
          return {
            isConnected: true,
            isNetworkConnected: true,
          };
        }
        if (method === "listAccounts") {
          return [TEST_ACCOUNT];
        }

        throw new Error(`Unhandled method: ${method}`);
      }),
    );

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.providerReady).toBe(true);
    });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.connectionState.status).toBe("connected");
      expect(result.current.isConnected).toBe(true);
      expect(result.current.partyId).toBe(TEST_ACCOUNT.partyId);
    });
  });

  test("connect() surfaces a refusal instead of leaving the state in connecting", async () => {
    const onErrorCalls: ParsedError[] = [];

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

    const { Wrapper } = createHookWrapper({
      onError: (error) => {
        onErrorCalls.push(error);
      },
    });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.providerReady).toBe(true);
    });

    await act(async () => {
      await expect(result.current.connect()).rejects.toEqual({
        message: "User cancelled",
        code: "NOT_CONNECTED",
        action: { type: "retry" },
      });
    });

    await waitFor(() => {
      expect(result.current.connectionState).toEqual({
        status: "error",
        error: {
          message: "User cancelled",
          code: "NOT_CONNECTED",
          action: { type: "retry" },
        },
      });
    });

    expect(onErrorCalls).toEqual([
      {
        message: "User cancelled",
        code: "NOT_CONNECTED",
        action: { type: "retry" },
      },
    ]);
  });

  test("init-time status errors call onError without flipping into an error state", async () => {
    const onErrorCalls: ParsedError[] = [];

    installMockProvider(
      createMockProvider(({ method }) => {
        if (method === "status") {
          throw new Error("status exploded");
        }

        throw new Error(`Unhandled method: ${method}`);
      }),
    );

    const { Wrapper } = createHookWrapper({
      onError: (error) => {
        onErrorCalls.push(error);
      },
    });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.providerReady).toBe(true);
      expect(onErrorCalls.length).toBeGreaterThan(0);
    });

    expect(result.current.connectionState).toEqual({ status: "disconnected" });
    expect(onErrorCalls[0]).toEqual({
      message: "status exploded",
      code: "INTERNAL_ERROR",
      action: { type: "retry" },
      raw: expect.any(Error),
    });
  });

  test("legacy status shapes warn and skip session restore instead of crashing", async () => {
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      installMockProvider(
        createMockProvider(({ method }) => {
          if (method === "status") {
            return {
              kernel: {
                id: "sendwallet",
                clientType: "browser",
              },
              isConnected: false,
              isNetworkConnected: false,
            };
          }

          throw new Error(`Unhandled method: ${method}`);
        }),
      );

      const { Wrapper } = createHookWrapper();
      const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.providerReady).toBe(true);
        expect(warnings).toHaveLength(1);
      });

      expect(result.current.connectionState).toEqual({ status: "disconnected" });
      expect(warnings[0]?.[0]).toBe(
        "[sigilry] StatusEvent.connection missing; provider may be on legacy shape",
      );
    } finally {
      console.warn = originalWarn;
    }
  });
});
