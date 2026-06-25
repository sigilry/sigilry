/**
 * WalletConnect transport for dApp ↔ Canton wallet communication (sigilry#57).
 *
 * A sibling to {@link ./window.ts WindowTransport}: same `BidirectionalTransport`
 * surface, but messages travel over the WalletConnect relay instead of
 * `window.postMessage`. This lets sigilry dApps connect to WalletConnect-capable
 * Canton wallets (cross-device / no extension).
 *
 * Sigilry's typed surface is unchanged — only the transport swaps. The dApp
 * issues bare method names (`status`, `prepareExecute`, `ledgerApi`, …); this
 * transport marshals them onto the canonical Canton WC namespace (`canton_*`,
 * per splice-wallet-kernel + the DA dapp-sdk reference) and back. No dependency
 * on `@canton-network/dapp-sdk` — all source is sigilry-owned (MIT).
 */
import SignClient from "@walletconnect/sign-client";
import type { SessionTypes } from "@walletconnect/types";
import type { RequestPayload, ResponsePayload } from "../messages/schemas.js";
import { RpcErrorCode, rpcError } from "../rpc/errors.js";
import type { BidirectionalTransport, NotificationListener } from "./types.js";

/** Canonical Canton WC namespace (must match the wallet responder). */
const CANTON_NAMESPACE = "canton";
const CANTON_WC_METHODS = [
  "canton_status",
  "canton_listAccounts",
  "canton_getPrimaryAccount",
  "canton_getActiveNetwork",
  "canton_ledgerApi",
  "canton_prepareSignExecute",
  "canton_signMessage",
];
// Wallet-EMITTED events negotiated over the WC namespace. `connected` and
// `txChanged` are deliberately absent: the wallet never emits them, so they're
// synthesized dApp-side (`connected` on connect(), `txChanged` on prepareExecute).
const CANTON_WC_EVENTS = ["accountsChanged", "statusChanged"];

// On restore, validate a persisted session is still alive within this window. A
// session the wallet deleted while we were away (a missed session_delete) would
// otherwise be adopted and wedge every later request — and hang connect() on
// "connecting" with no QR. Short: canton_status is a quick read, and this cost is
// only paid when probing a (possibly dead) restored session.
const RESTORE_LIVENESS_TIMEOUT_MS = 6000;

/**
 * Bare sigilry RPC method → canonical `canton_*` wire method. `connect` /
 * `disconnect` / `isConnected` are session lifecycle (handled before this map),
 * not relay requests. `prepareExecute` and `prepareExecuteAndWait` both fold
 * onto the single spec method `canton_prepareSignExecute`.
 */
const METHOD_MAP: Record<string, string> = {
  status: "canton_status",
  getActiveNetwork: "canton_getActiveNetwork",
  listAccounts: "canton_listAccounts",
  getPrimaryAccount: "canton_getPrimaryAccount",
  signMessage: "canton_signMessage",
  ledgerApi: "canton_ledgerApi",
  prepareExecute: "canton_prepareSignExecute",
  prepareExecuteAndWait: "canton_prepareSignExecute",
};

export interface WalletConnectTransportConfig {
  /** Reown/WalletConnect Cloud project id. */
  projectId: string;
  /** CAIP-2 chain, e.g. `canton:mainnet`. Default `canton:devnet`. */
  chainId?: string;
  /**
   * Allowlist of origins the wallet-advertised `network.ledgerApi` may use for
   * DIRECT, bearer-authed reads (e.g. `["https://gateway.example.com"]`). The
   * ledgerApi URL comes from the wallet's `canton_status`; without an allowlist a
   * malicious/compromised wallet could point the dApp's authed fetch at an
   * arbitrary origin and exfiltrate the session token (confused-deputy). When
   * set, the ledgerApi origin MUST match one of these or the read is refused.
   * Strongly recommended in production. When unset, only the scheme is enforced
   * (https, or http for localhost).
   */
  ledgerApiAllowedOrigins?: string[];
  /** Per-request timeout (ms) for direct ledger-api reads. Default 30000. */
  ledgerApiTimeoutMs?: number;
  /**
   * dApp metadata shown to the user in their wallet at the connection prompt
   * (name, description, url, icon). REQUIRED: the wallet renders this as the
   * dApp's identity, so it must always be the real dApp — never a generic
   * placeholder the user wouldn't recognize (a trust/anti-phishing concern).
   */
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  /** Called with the pairing URI so the dApp can render a QR / deep-link. */
  onUri?: (uri: string) => void;
  /**
   * Forward wallet-originated events (`accountsChanged`, `statusChanged`) and
   * session lifecycle (`session_delete`) to the provider's emitter. The
   * `@sigilry/react` connect path wires this into the provider's `emit`.
   */
  onEvent?: (event: string, data: unknown) => void;
}

/**
 * WalletConnect-backed transport. The dApp side of the Canton WC namespace.
 */
export class WalletConnectTransport implements BidirectionalTransport {
  private readonly projectId: string;
  private readonly chainId: string;
  private readonly metadata: WalletConnectTransportConfig["metadata"];
  private readonly ledgerApiAllowedOrigins: string[] | undefined;
  private readonly ledgerApiTimeoutMs: number;
  private readonly onUri: ((uri: string) => void) | undefined;
  private readonly onEvent: ((event: string, data: unknown) => void) | undefined;

  private signClient: SignClient | null = null;
  private session: SessionTypes.Struct | null = null;
  private initPromise: Promise<SignClient> | null = null;
  // session_event is bound once on the signClient (not per session) — guards against
  // restore()/establishSession() each adding a listener and firing events N times.
  private sessionEventsBound = false;
  private readonly notificationListeners = new Set<NotificationListener>();
  // Cached from canton_status. Per CIP-103 the dApp reads the ledger API
  // DIRECTLY as `${network.ledgerApi}${resource}` with the session token, rather
  // than proxying reads over the WC relay (which rejects large responses such as
  // the active-contract set). `canton_ledgerApi` over the relay remains the
  // wallet-side proxy contract; the dApp prefers the direct path.
  private ledgerApiUrl: string | null = null;
  private accessToken: string | null = null;

  constructor(config: WalletConnectTransportConfig) {
    this.projectId = config.projectId;
    this.chainId = config.chainId ?? "canton:devnet";
    this.metadata = config.metadata;
    this.ledgerApiAllowedOrigins = config.ledgerApiAllowedOrigins?.map((o) => new URL(o).origin);
    this.ledgerApiTimeoutMs = config.ledgerApiTimeoutMs ?? 30000;
    this.onUri = config.onUri;
    this.onEvent = config.onEvent;
  }

  /**
   * Guard the wallet-advertised ledgerApi URL before we send the session token to
   * it (confused-deputy defense). Require https (http only for localhost), and —
   * when an allowlist is configured — require the origin to be on it. Throws on
   * violation so a malicious wallet can't redirect the authed read off-origin.
   */
  private assertLedgerApiAllowed(rawUrl: string): URL {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error(`ledgerApi URL is not a valid absolute URL: ${rawUrl}`);
    }
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
      throw new Error(`ledgerApi must use https (got ${url.protocol}//${url.host})`);
    }
    if (this.ledgerApiAllowedOrigins && !this.ledgerApiAllowedOrigins.includes(url.origin)) {
      throw new Error(`ledgerApi origin ${url.origin} is not in the configured allowlist`);
    }
    return url;
  }

  /** True once a Canton WC session is established. */
  get connected(): boolean {
    return this.session !== null;
  }

  /**
   * Marshal a sigilry RPC call onto the Canton WC namespace. Mirrors the
   * `RpcTransport` contract: resolves to `{ result }` or `{ error }` (never
   * rejects), so the client layer surfaces errors uniformly.
   */
  async submit(payload: RequestPayload): Promise<ResponsePayload> {
    const { method, params } = payload;
    try {
      // ── Session lifecycle (not relay requests) ──
      if (method === "connect") {
        // Resume the persisted session first (SignClient stores approved
        // sessions across reloads) — only open a NEW pairing when there's
        // nothing to restore. Otherwise every reload+connect piles up a
        // duplicate session on the wallet.
        if (!this.session) {
          const restored = await this.restore();
          if (!restored) await this.establishSession();
        }
        // Per CIP-103, connect() resolves to the CONNECTION object (the
        // `.connection` of a StatusEvent), not the full status payload. Also
        // caches network.ledgerApi + the session token for direct reads.
        const status = await this.fetchStatus();
        // `connected` is not a WC namespace event (the wallet never emits it), so
        // synthesize it on login completion — otherwise onConnected never fires in
        // WC mode (txChanged is likewise synthesized on prepareExecute).
        this.onEvent?.("connected", status);
        const connection = (status as { connection?: unknown } | null)?.connection;
        return { result: connection ?? status };
      }
      if (method === "disconnect") {
        await this.disconnect();
        return { result: null };
      }
      if (method === "isConnected") {
        // Public contract returns ConnectResult, not a bare boolean (the generated
        // client reads isConnected/isNetworkConnected off this).
        const isConnected = this.session !== null;
        return { result: { isConnected, isNetworkConnected: isConnected } };
      }
      // Answer status locally when there's no session yet (no relay round-trip).
      // Shape = CIP-103 StatusEvent. `network` reports the CONFIGURED chain so
      // dApp network gates (e.g. "wallet must be on canton:mainnet") can resolve
      // before pairing — matching the injected provider, which can also report
      // its network pre-connect.
      if (method === "status" && !this.session) {
        return {
          result: {
            provider: { id: "walletconnect", providerType: "remote" },
            connection: { isConnected: false, isNetworkConnected: true },
            network: { networkId: this.chainId },
          },
        };
      }

      if (!this.session) {
        return {
          error: rpcError(RpcErrorCode.DISCONNECTED, "WalletConnect session not established"),
        };
      }

      // Ledger reads go DIRECT to the wallet's gateway (CIP-103
      // network.ledgerApi + session token), NOT over the relay — large
      // responses (e.g. the active-contract set) exceed the relay's per-message
      // size limit and fail to publish.
      if (method === "ledgerApi" || method === "canton_ledgerApi") {
        return { result: await this.ledgerApiDirect(params) };
      }

      // Fallthrough is intentional: an unmapped bare method is forwarded as
      // `canton_<method>` (parity with the splice dapp-sdk). The responder rejects
      // unknown methods, so this can't smuggle an unsupported call past the wallet.
      const cantonMethod =
        METHOD_MAP[method] ?? (method.startsWith("canton_") ? method : `canton_${method}`);
      const result = await this.relayRequest(cantonMethod, params);
      // prepareExecute*/canton_prepareSignExecute results are surfaced under
      // `tx` by sigilry's typed client (parity with the window path).
      if (method === "prepareExecute" || method === "prepareExecuteAndWait") {
        this.onEvent?.("txChanged", result);
        // OpenRPC spec: prepareExecute's result is Null (the tx is delivered via the
        // txChanged event); only prepareExecuteAndWait returns the tx to the caller.
        return { result: method === "prepareExecuteAndWait" ? { tx: result } : null };
      }
      return { result };
    } catch (err: unknown) {
      // Relay rejections arrive as plain JSON-RPC error objects ({code, message}),
      // not Error instances — String(err) would mangle them to "[object Object]".
      const errObj =
        typeof err === "object" && err !== null
          ? (err as { code?: unknown; message?: unknown })
          : {};
      const message =
        err instanceof Error
          ? err.message
          : typeof errObj.message === "string"
            ? errObj.message
            : String(err);
      const code =
        typeof errObj.code === "number" ? (errObj.code as number) : RpcErrorCode.INTERNAL_ERROR;
      return { error: rpcError(code as RpcErrorCode, message) };
    }
  }

  /**
   * The dApp issues requests; it never answers them. The responder side
   * (wallet) owns `submitResponse`. No-op here to satisfy the interface.
   */
  submitResponse(): void {
    // intentional no-op — dApp-side transport
  }

  /**
   * Subscribe to wallet-pushed notifications (BidirectionalTransport). WC wallet
   * events (`session_event`) are dispatched here in addition to the `onEvent`
   * config bridge, so consumers using either channel receive them.
   */
  onNotification(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  /** Dispatch a wallet-pushed notification to `onNotification` subscribers. */
  notify(event: string, payload: unknown, target?: string): void {
    for (const listener of this.notificationListeners) listener(event, payload, { target });
  }

  /** Restore a previously-approved Canton session (e.g. after reload). */
  async restore(): Promise<boolean> {
    const client = await this.initSignClient();
    // Restore only a session for OUR configured chain — a stale session on a
    // different chain (e.g. canton:mainnet while configured for canton:devnet)
    // would otherwise be adopted and every request would fail.
    const existing = client.session
      .getAll()
      .find((s) => s.namespaces?.[CANTON_NAMESPACE]?.chains?.includes(this.chainId));
    if (!existing) return false;
    this.session = existing;
    this.setupSessionEvents();
    // Validate the session is still ALIVE before trusting it. The wallet may have
    // deleted it while we were away (we'd miss the session_delete); adopting a
    // dead session wedges every later request AND hangs connect() on "connecting"
    // with no QR (restore wins over establishSession). A timed canton_status
    // confirms the wallet still answers — on timeout/failure, tear the dead
    // session down so the caller falls back to a fresh pairing.
    try {
      await this.relayRequest("canton_status", {}, RESTORE_LIVENESS_TIMEOUT_MS);
      return true;
    } catch {
      await this.disconnect();
      return false;
    }
  }

  /** Tear down the WC session. */
  async disconnect(): Promise<void> {
    if (this.signClient && this.session) {
      try {
        await this.signClient.disconnect({
          topic: this.session.topic,
          reason: { code: 6000, message: "User disconnected" },
        });
      } catch {
        // session may already be gone on the relay
      }
    }
    this.session = null;
  }

  // ── private ──────────────────────────────────────────────────────

  private async relayRequest(
    method: string,
    params: unknown,
    timeoutMs?: number,
  ): Promise<unknown> {
    if (!this.signClient || !this.session) {
      throw new Error("WalletConnect session not established");
    }
    const request = this.signClient.request({
      topic: this.session.topic,
      chainId: this.chainId,
      request: { method, params: (params as Record<string, unknown>) ?? {} },
    });
    // Most relay requests (signMessage / prepareSignExecute) wait on user approval
    // in the wallet and must NOT time out. Only callers that pass timeoutMs — the
    // restore liveness probe — are bounded.
    if (timeoutMs === undefined) return request;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`relay request '${method}' timed out after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** canton_status over the relay; caches the direct-read base URL + token. */
  private async fetchStatus(): Promise<unknown> {
    const status = (await this.relayRequest("canton_status", {})) as {
      network?: { ledgerApi?: string; accessToken?: string };
      session?: { accessToken?: string };
    } | null;
    const advertised = status?.network?.ledgerApi;
    if (advertised) {
      // Validate the wallet-advertised URL BEFORE caching it — we never retain an
      // off-origin ledgerApi that we'd subsequently bearer-auth to.
      this.assertLedgerApiAllowed(advertised);
      this.ledgerApiUrl = advertised;
    }
    this.accessToken =
      status?.session?.accessToken ?? status?.network?.accessToken ?? this.accessToken;
    return status;
  }

  /**
   * Read the Canton ledger API directly: `${network.ledgerApi}${resource}` with
   * the session token (CIP-103). `params` is the LedgerApiRequest envelope
   * ({ requestMethod, resource, body?, query?, path?, headers? }). Bypasses the
   * relay's per-message size limit (large responses like the active-contract
   * set). `{name}` path params are substituted and `query` params appended.
   * Refreshes the cached token once on 401; aborts after `ledgerApiTimeoutMs`.
   */
  private async ledgerApiDirect(params: unknown): Promise<unknown> {
    if (!this.ledgerApiUrl || !this.accessToken) await this.fetchStatus();
    if (!this.ledgerApiUrl) {
      throw new Error("canton_status did not provide network.ledgerApi for a direct read");
    }
    // Re-validate the cached origin before every bearer-authed read (defense in depth).
    const baseUrl = this.assertLedgerApiAllowed(this.ledgerApiUrl);
    const p = (params ?? {}) as {
      requestMethod?: string;
      resource?: string;
      body?: unknown;
      query?: Record<string, unknown>;
      path?: Record<string, unknown>;
      headers?: Record<string, string>;
    };
    if (!p.resource) {
      throw new Error("ledgerApi request is missing 'resource'");
    }
    const httpMethod = (p.requestMethod ?? "get").toUpperCase();

    // Substitute `{name}` path params into the resource, then build the URL +
    // append query params (both defined by LedgerApiRequestSchema).
    let resource = p.resource;
    if (p.path) {
      for (const [k, v] of Object.entries(p.path)) {
        resource = resource.replace(`{${k}}`, encodeURIComponent(String(v)));
      }
    }
    const base = `${baseUrl.origin}${baseUrl.pathname.replace(/\/+$/, "")}`;
    const url = new URL(resource.startsWith("/") ? `${base}${resource}` : `${base}/${resource}`);
    if (p.query) {
      for (const [k, v] of Object.entries(p.query)) {
        if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
      }
    }

    const sendsBody = httpMethod !== "GET" && httpMethod !== "HEAD" && p.body !== undefined;
    const call = (): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.ledgerApiTimeoutMs);
      return fetch(url, {
        method: httpMethod,
        headers: {
          ...(sendsBody ? { "content-type": "application/json" } : {}),
          ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}),
          ...p.headers,
        },
        body: sendsBody ? JSON.stringify(p.body) : undefined,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
    };

    let res: Response;
    try {
      res = await call();
      if (res.status === 401) {
        await this.fetchStatus(); // token may have rotated mid-session
        res = await call();
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw {
          code: -32000,
          message: `ledger-api request timed out after ${this.ledgerApiTimeoutMs}ms`,
        };
      }
      throw e;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw { code: -32000, message: `ledger-api ${res.status}: ${detail || res.statusText}` };
    }
    return res.json();
  }

  private async establishSession(): Promise<void> {
    const client = await this.initSignClient();
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        [CANTON_NAMESPACE]: {
          chains: [this.chainId],
          methods: CANTON_WC_METHODS,
          events: CANTON_WC_EVENTS,
        },
      },
    });
    if (uri) this.onUri?.(uri);
    this.session = await approval();
    this.setupSessionEvents();
  }

  private async initSignClient(): Promise<SignClient> {
    if (this.signClient) return this.signClient;
    if (this.initPromise) return this.initPromise;

    this.initPromise = SignClient.init({
      projectId: this.projectId,
      metadata: this.metadata,
    });
    this.signClient = await this.initPromise;

    this.signClient.on("session_delete", ({ topic }) => {
      // Only react to OUR session's deletion — another WC session in the same
      // browser being deleted must not disconnect the Canton provider.
      if (topic !== this.session?.topic) return;
      this.session = null;
      this.onEvent?.("statusChanged", {
        connection: { isConnected: false, isNetworkConnected: false },
      });
    });

    return this.signClient;
  }

  private setupSessionEvents(): void {
    if (!this.signClient || this.sessionEventsBound) return;
    // Bind once (restore() + establishSession() both call this); the listener
    // filters by topic so only the active Canton session's events are forwarded.
    this.sessionEventsBound = true;
    this.signClient.on("session_event", ({ topic, params }) => {
      if (topic !== this.session?.topic) return;
      const event = params?.event;
      if (event?.name) {
        this.onEvent?.(event.name, event.data);
        this.notify(event.name, event.data);
      }
    });
  }
}
