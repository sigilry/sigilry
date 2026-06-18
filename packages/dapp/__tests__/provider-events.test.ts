import { describe, expect, mock, test } from "bun:test";
import type { TxChangedEvent } from "../src/generated/schemas.js";
import { SpliceProviderBase } from "../src/provider/base.js";
import type { TypedRequestFn } from "../src/provider/typed-request.js";
import type { BidirectionalTransport, NotificationListener } from "../src/transport/types.js";

class FakeNotificationTransport implements Pick<BidirectionalTransport, "onNotification"> {
  readonly subscriptions = mock(() => {});
  readonly unsubscribe = mock(() => {});
  private listener: NotificationListener | undefined;

  onNotification(listener: NotificationListener): () => void {
    this.subscriptions();
    this.listener = listener;
    return this.unsubscribe;
  }

  deliver(method: string, params: unknown): void {
    this.listener?.(method, params, {});
  }
}

class TestProvider extends SpliceProviderBase {
  request: TypedRequestFn = async () => {
    throw new Error("request is not used by provider event tests");
  };

  attachTransport(transport: Pick<BidirectionalTransport, "onNotification">): void {
    this.attachEventTransport(transport);
  }
}

describe("SpliceProviderBase transport event channel", () => {
  const txChanged: TxChangedEvent = {
    status: "pending",
    commandId: "command-1",
  };

  test("provider.on delivers known transport notifications to listeners", () => {
    const transport = new FakeNotificationTransport();
    const provider = new TestProvider();
    provider.attachTransport(transport);
    const received: TxChangedEvent[] = [];

    provider.on<TxChangedEvent>("txChanged", (event) => {
      received.push(event);
    });
    transport.deliver("txChanged", txChanged);

    expect(received).toEqual([txChanged]);
  });

  test("unknown transport notification methods are dropped", () => {
    const transport = new FakeNotificationTransport();
    const provider = new TestProvider();
    provider.attachTransport(transport);
    const received: unknown[] = [];

    provider.on("txChanged", (event) => {
      received.push(event);
    });
    expect(() => transport.deliver("bogusEvent", { ignored: true })).not.toThrow();

    expect(received).toEqual([]);
  });

  test("emit no-ops when no listener is registered", () => {
    const provider = new TestProvider();

    expect(() => provider.emit("txChanged", txChanged)).not.toThrow();
    expect(provider.emit("txChanged", txChanged)).toBe(false);
  });

  test("transport notification subscription is lazy and removed with the last listener", () => {
    const transport = new FakeNotificationTransport();
    const provider = new TestProvider();
    provider.attachTransport(transport);
    const txListener = mock(() => {});
    const statusListener = mock(() => {});

    expect(transport.subscriptions).toHaveBeenCalledTimes(0);
    expect(transport.unsubscribe).toHaveBeenCalledTimes(0);

    provider.on("txChanged", txListener);
    expect(transport.subscriptions).toHaveBeenCalledTimes(1);
    expect(transport.unsubscribe).toHaveBeenCalledTimes(0);

    provider.on("statusChanged", statusListener);
    expect(transport.subscriptions).toHaveBeenCalledTimes(1);
    provider.removeListener("txChanged", txListener);
    expect(transport.unsubscribe).toHaveBeenCalledTimes(0);

    provider.removeAllListeners("statusChanged");
    expect(transport.unsubscribe).toHaveBeenCalledTimes(1);
  });

  test("removeAllListeners without an event cascades to transport unsubscribe", () => {
    const transport = new FakeNotificationTransport();
    const provider = new TestProvider();
    provider.attachTransport(transport);

    provider.on("txChanged", () => {});
    provider.on("accountsChanged", () => {});
    provider.removeAllListeners();

    expect(transport.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
