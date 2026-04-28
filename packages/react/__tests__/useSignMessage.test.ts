import { describe, expect, test } from "bun:test";
import { useSignMessage } from "../src/index.js";
import {
  act,
  DISCONNECTED_STATUS,
  createHookWrapper,
  createMockProvider,
  installMockProvider,
  registerTestIsolation,
  renderHook,
  waitFor,
} from "./testUtils.js";

registerTestIsolation();

describe("useSignMessage", () => {
  test("resolves a signature and stores the latest successful result", async () => {
    installMockProvider(
      createMockProvider(({ method, params }) => {
        if (method === "status") return DISCONNECTED_STATUS;
        if (method === "signMessage") {
          expect(params).toEqual({ message: "hello" });
          return { signature: "abc123" };
        }

        throw new Error(`Unhandled method: ${method}`);
      }),
    );

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSignMessage(), { wrapper: Wrapper });

    await act(async () => {
      const response = await result.current.signMessageAsync({ message: "hello" });
      expect(response).toEqual({ signature: "abc123" });
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ signature: "abc123" });
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  test("parses structured RPC failures into ParsedError state", async () => {
    const rpcError = { message: "Session expired while signing", code: "SESSION_EXPIRED" };

    installMockProvider(
      createMockProvider(({ method }) => {
        if (method === "status") return DISCONNECTED_STATUS;
        if (method === "signMessage") {
          throw rpcError;
        }

        throw new Error(`Unhandled method: ${method}`);
      }),
    );

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSignMessage(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.signMessageAsync({ message: "hello" })).rejects.toEqual(rpcError);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual({
        message: "Your session has expired",
        code: "SESSION_EXPIRED",
        action: { type: "reconnect" },
        raw: rpcError,
      });
    });
  });

  test("rejects before the provider is ready and surfaces the parsed error", async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSignMessage(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.signMessageAsync({ message: "x" })).rejects.toThrow(
        "Provider not available",
      );
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual({
        message: "Provider not available",
        code: "INTERNAL_ERROR",
        action: { type: "retry" },
        raw: expect.any(Error),
      });
    });
  });
});
