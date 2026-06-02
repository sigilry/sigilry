import { describe, expect, test } from "bun:test";
import {
  type ConnectedEvent,
  ConnectedEventSchema,
  type StatusChangedEvent,
  StatusChangedEventSchema,
} from "../src/generated/schemas.js";
import { ForwardToInjectedPayloadSchema } from "../src/messages/runtime-schemas.js";
import { SpliceProviderBase } from "../src/provider/base.js";
import type { TypedRequestFn } from "../src/provider/typed-request.js";

// CIP-103 §4.2.2: connected and statusChanged both carry the StatusEvent
// payload. These tests pin the shape so a future refactor can't silently
// diverge the two schemas (which would break envelope validation).
describe("CIP-103 §4.2.2 event schemas", () => {
  // Canonical StatusEvent fixture covering all optional fields, used across
  // the two-schema parity tests. Mirrors §4.2.2 (cip-0103.md:222-250).
  const fullStatusEvent: StatusChangedEvent = {
    provider: {
      id: "sigilry-wallet",
      version: "2.0.0",
      providerType: "browser",
    },
    connection: {
      isConnected: true,
      isNetworkConnected: true,
    },
    network: {
      networkId: "canton:da-mainnet",
      ledgerApi: "https://ledger.example.com",
    },
    session: {
      accessToken: "jwt-token",
      userId: "alice",
    },
  };

  describe("StatusChangedEventSchema", () => {
    test("accepts a full StatusEvent payload", () => {
      expect(StatusChangedEventSchema.parse(fullStatusEvent)).toEqual(fullStatusEvent);
    });

    test("accepts a minimal disconnected payload", () => {
      const event: StatusChangedEvent = {
        provider: { id: "sigilry-wallet", providerType: "browser" },
        connection: { isConnected: false, isNetworkConnected: false },
      };
      expect(StatusChangedEventSchema.parse(event)).toEqual(event);
    });

    test("rejects a payload missing the connection field", () => {
      const malformed = {
        provider: { id: "sigilry-wallet", providerType: "browser" },
      };
      expect(() => StatusChangedEventSchema.parse(malformed)).toThrow();
    });

    test("rejects a payload missing the provider field", () => {
      const malformed = {
        connection: { isConnected: true, isNetworkConnected: true },
      };
      expect(() => StatusChangedEventSchema.parse(malformed)).toThrow();
    });
  });

  describe("ConnectedEventSchema", () => {
    test("accepts the same payload shape as statusChanged", () => {
      // Per CIP-103 §4.2.2 (cip-0103.md:382): connected "Contains the same
      // payload as statusChanged."
      expect(ConnectedEventSchema.parse(fullStatusEvent)).toEqual(fullStatusEvent);
    });

    test("rejects malformed payloads symmetrically with statusChanged", () => {
      const malformed = { not: "a status event" };
      expect(() => ConnectedEventSchema.parse(malformed)).toThrow();
      expect(() => StatusChangedEventSchema.parse(malformed)).toThrow();
    });
  });

  describe("schema parity", () => {
    test("StatusChangedEventSchema and ConnectedEventSchema accept the same payloads", () => {
      // CIP-103 §4.2.2 requires statusChanged and connected to share the
      // StatusEvent payload shape. The OpenRPC spec achieves this via
      // `allOf StatusEvent` for both component schemas — codegen produces
      // structurally-equivalent (but referentially-distinct) Zod schemas.
      // Pin structural parity by parsing the same fixture through both.
      expect(StatusChangedEventSchema.parse(fullStatusEvent)).toEqual(fullStatusEvent);
      expect(ConnectedEventSchema.parse(fullStatusEvent)).toEqual(fullStatusEvent);
    });

    test("both schemas reject the same malformed shapes", () => {
      // Symmetric rejection: if upstream drifts one schema (e.g. adds a
      // `loginContext` field to ConnectedEvent only), this guard fires.
      const cases: unknown[] = [
        { not: "a status event" },
        { provider: { id: "x", providerType: "browser" } }, // missing connection
        { connection: { isConnected: true, isNetworkConnected: true } }, // missing provider
      ];
      for (const malformed of cases) {
        expect(StatusChangedEventSchema.safeParse(malformed).success).toBe(
          ConnectedEventSchema.safeParse(malformed).success,
        );
      }
    });
  });
});

describe("ForwardToInjectedPayloadSchema (envelope discriminator)", () => {
  const statusPayload: StatusChangedEvent = {
    provider: { id: "sigilry-wallet", providerType: "browser" },
    connection: { isConnected: true, isNetworkConnected: true },
  };

  test("accepts the statusChanged branch", () => {
    const envelope = {
      type: "SPLICE_WALLET_EVENT" as const,
      event: "statusChanged" as const,
      payload: statusPayload,
    };
    expect(ForwardToInjectedPayloadSchema.parse(envelope)).toEqual(envelope);
  });

  test("accepts the connected branch", () => {
    const envelope = {
      type: "SPLICE_WALLET_EVENT" as const,
      event: "connected" as const,
      payload: statusPayload satisfies ConnectedEvent,
    };
    expect(ForwardToInjectedPayloadSchema.parse(envelope)).toEqual(envelope);
  });

  test("rejects an envelope with unknown event name", () => {
    const envelope = {
      type: "SPLICE_WALLET_EVENT",
      event: "disconnect", // pre-CIP-103 name that must NOT appear on the wire
      payload: statusPayload,
    };
    expect(() => ForwardToInjectedPayloadSchema.parse(envelope)).toThrow();
  });

  test("rejects connected envelope with malformed payload", () => {
    const envelope = {
      type: "SPLICE_WALLET_EVENT",
      event: "connected",
      payload: { isConnected: true }, // ConnectResult-shaped, not StatusEvent
    };
    expect(() => ForwardToInjectedPayloadSchema.parse(envelope)).toThrow();
  });
});

// SpliceProviderBase is abstract; subclass it minimally for unit testing the
// CIP-103 emit helpers and isConnected() bookkeeping.
class TestProvider extends SpliceProviderBase {
  request: TypedRequestFn = async () => {
    throw new Error("not used in these tests");
  };

  // Re-expose protected emitters so tests can drive them directly.
  publicEmitConnected(payload: ConnectedEvent): void {
    this.emitConnected(payload);
  }

  publicEmitStatusChanged(payload: StatusChangedEvent): void {
    this.emitStatusChanged(payload);
  }
}

describe("SpliceProviderBase CIP-103 emit helpers", () => {
  const connectedPayload: ConnectedEvent = {
    provider: { id: "test-wallet", providerType: "browser" },
    connection: { isConnected: true, isNetworkConnected: true },
  };

  const disconnectedPayload: StatusChangedEvent = {
    provider: { id: "test-wallet", providerType: "browser" },
    connection: { isConnected: false, isNetworkConnected: false },
  };

  test("emitConnected fires 'connected' with the StatusEvent payload", () => {
    const provider = new TestProvider();
    const received: ConnectedEvent[] = [];
    provider.on<ConnectedEvent>("connected", (event) => {
      received.push(event);
    });

    provider.publicEmitConnected(connectedPayload);

    expect(received).toEqual([connectedPayload]);
  });

  test("emitConnected updates isConnected() from payload.connection.isConnected", () => {
    const provider = new TestProvider();
    expect(provider.isConnected()).toBe(false);

    provider.publicEmitConnected(connectedPayload);
    expect(provider.isConnected()).toBe(true);

    // Edge case: a connected payload with isConnected=false (e.g., login
    // flow surfaced an unauthenticated provider). Internal flag must mirror.
    provider.publicEmitConnected({
      ...connectedPayload,
      connection: { isConnected: false, isNetworkConnected: false },
    });
    expect(provider.isConnected()).toBe(false);
  });

  test("emitStatusChanged fires 'statusChanged' with the StatusEvent payload", () => {
    const provider = new TestProvider();
    const received: StatusChangedEvent[] = [];
    provider.on<StatusChangedEvent>("statusChanged", (event) => {
      received.push(event);
    });

    provider.publicEmitStatusChanged(disconnectedPayload);

    expect(received).toEqual([disconnectedPayload]);
  });

  test("emitStatusChanged updates isConnected() from payload.connection.isConnected", () => {
    const provider = new TestProvider();
    provider.publicEmitConnected(connectedPayload);
    expect(provider.isConnected()).toBe(true);

    provider.publicEmitStatusChanged(disconnectedPayload);
    expect(provider.isConnected()).toBe(false);
  });

  test("does NOT emit the pre-CIP-103 'connect'/'disconnect' event names", () => {
    // Regression guard: the old setConnected helper emitted bare 'connect'
    // / 'disconnect' strings with no payload. Per CIP-103 §4.2.2 those
    // names are reserved for the RPC methods, not the event surface.
    const provider = new TestProvider();
    const legacyConnect: unknown[][] = [];
    const legacyDisconnect: unknown[][] = [];
    provider.on("connect", (...args: unknown[]) => legacyConnect.push(args));
    provider.on("disconnect", (...args: unknown[]) => legacyDisconnect.push(args));

    provider.publicEmitConnected(connectedPayload);
    provider.publicEmitStatusChanged(disconnectedPayload);

    expect(legacyConnect).toEqual([]);
    expect(legacyDisconnect).toEqual([]);
  });
});
