/**
 * Deferred Convex connection (PERF-04). The Convex client opens its WebSocket as soon as the
 * auth provider hands it a token fetcher — during hydration, competing with it on a slow
 * phone. `DeferredWebSocket` is passed as the client's `webSocketConstructor`: it behaves like
 * a WebSocket that is still connecting until `openConvexConnection()` is called, then opens
 * the real socket and forwards every event. Queries and mutations issued earlier are queued by
 * the Convex client and sent on open, exactly as on a slow network.
 *
 * `ConvexConnectionGate` (ConvexClientProvider) opens it at once for signed-in visitors and
 * on the first interaction or after the page has loaded and gone idle for anonymous ones.
 */

let release: (() => void) | null = null;
const gate = new Promise<void>((resolve) => {
  release = resolve;
});

/** Lets the Convex client connect (idempotent). */
export function openConvexConnection(): void {
  release?.();
  release = null;
}

type Handler<E extends Event> = ((event: E) => void) | null;

export class DeferredWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  onopen: Handler<Event> = null;
  onmessage: Handler<MessageEvent> = null;
  onerror: Handler<Event> = null;
  onclose: Handler<CloseEvent> = null;

  private socket: WebSocket | null = null;
  private closedBeforeOpen = false;

  constructor(url: string | URL, protocols?: string | string[]) {
    void gate.then(() => {
      if (this.closedBeforeOpen) return;
      const ws = new WebSocket(url, protocols);
      this.socket = ws;
      ws.onopen = (event) => this.onopen?.(event);
      ws.onmessage = (event) => this.onmessage?.(event);
      ws.onerror = (event) => this.onerror?.(event);
      ws.onclose = (event) => this.onclose?.(event);
    });
  }

  get readyState(): number {
    if (this.socket) return this.socket.readyState;
    return this.closedBeforeOpen ? DeferredWebSocket.CLOSED : DeferredWebSocket.CONNECTING;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (!this.socket) throw new Error("WebSocket is not open");
    this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    if (this.socket) {
      this.socket.close(code, reason);
      return;
    }
    if (this.closedBeforeOpen) return;
    this.closedBeforeOpen = true;
    // A real socket closed while connecting reports `close` asynchronously; do the same.
    window.setTimeout(() =>
      this.onclose?.(
        new CloseEvent("close", { code: code ?? 1000, reason: reason ?? "", wasClean: true }),
      ),
    );
  }
}
