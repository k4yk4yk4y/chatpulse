(() => {
  const TAG = "[ChatPulse Kick MAIN v2]";
  const CUSTOM_EVENT = "chatpulse:kick:msg";

  const OrigWebSocket = window.WebSocket;
  const origAddEventListener = OrigWebSocket.prototype.addEventListener;

  let msgDebugCount = 0;
  const MSG_DEBUG_LIMIT = 20;
  const NON_CHAT_DEBUG_LIMIT = 5;
  const DEBUG_LOGGING = false;

  function emitFrame(data: string): void {
    try {
      window.dispatchEvent(
        new CustomEvent(CUSTOM_EVENT, {
          detail: { frame: data, timestamp: Date.now() },
        })
      );
    } catch (e) {
      console.error(TAG, "emitFrame error", e);
    }
  }

  function dataToString(data: unknown): string | null {
    if (typeof data === "string") return data;
    if (data instanceof ArrayBuffer) {
      try { return new TextDecoder().decode(data); } catch { return null; }
    }
    if (typeof data === "object" && data !== null && "text" in data && typeof (data as { text: () => unknown }).text === "function") {
      try {
        const result = (data as { text: () => unknown }).text();
        return typeof result === "string" ? result : null;
      } catch { return null; }
    }
    return null;
  }

  function hookMessageEvent(ev: Event): void {
    const msgEv = ev as MessageEvent;
    const dataStr = dataToString(msgEv.data);
    if (dataStr === null) {
      if (DEBUG_LOGGING) {
        console.log(TAG, "Non-string/binary WS message, type:", typeof msgEv.data, "constructor:", msgEv.data?.constructor?.name);
      }
      return;
    }

    if (DEBUG_LOGGING && msgDebugCount < MSG_DEBUG_LIMIT) {
      msgDebugCount++;
      const preview = dataStr.length > 200 ? dataStr.slice(0, 200) + "..." : dataStr;
      console.log(TAG, `WS msg #${msgDebugCount}, len:${dataStr.length}, preview:`, preview);
    }

    try {
      const parsed = JSON.parse(dataStr);
      const msgType = parsed.type ?? parsed.event ?? parsed.name ?? parsed.kind ?? "";
      const isChatMsg = msgType === "chat_message"
        || msgType === "ChatMessage"
        || msgType === "message"
        || msgType === "App\\Events\\ChatMessageEvent";
      if (isChatMsg) {
        console.log(TAG, "Intercepted Kick chat message, type:", msgType, "length:", dataStr.length);
        emitFrame(dataStr);
      } else if (DEBUG_LOGGING && msgDebugCount <= NON_CHAT_DEBUG_LIMIT) {
        console.log(TAG, "Non-chat WS message type:", msgType || "(empty)");
      }
    } catch {
      if (DEBUG_LOGGING && msgDebugCount <= 3) {
        console.log(TAG, "Non-JSON WS message, first 100 chars:", dataStr.slice(0, 100));
      }
    }
  }

  OrigWebSocket.prototype.addEventListener = function (
    this: WebSocket,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    if (type === "message") {
      const wrapped = function (this: WebSocket, ev: Event) {
        hookMessageEvent(ev);
        if (typeof listener === "function") {
          listener.call(this, ev);
        } else if (listener && typeof listener.handleEvent === "function") {
          listener.handleEvent(ev);
        }
      };
      origAddEventListener.call(this, type, wrapped, options);
      return;
    }
    origAddEventListener.call(this, type, listener, options);
  };

  const origOnMessage = Object.getOwnPropertyDescriptor(
    OrigWebSocket.prototype,
    "onmessage"
  );

  Object.defineProperty(OrigWebSocket.prototype, "onmessage", {
    get() {
      return origOnMessage?.get?.call(this) ?? null;
    },
    set(handler: ((ev: MessageEvent) => void) | null) {
      if (origOnMessage?.set) {
        if (handler) {
          origOnMessage.set.call(this, function (this: WebSocket, ev: MessageEvent) {
            hookMessageEvent(ev);
            handler.call(this, ev);
          });
        } else {
          origOnMessage.set.call(this, null);
        }
      }
    },
    configurable: true,
  });

  class KickPulseWebSocket extends OrigWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);

      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("websockets.kick.com")) {
        console.log(TAG, "Kick WebSocket detected:", urlStr);
      }
    }
  }

  KickPulseWebSocket.prototype = OrigWebSocket.prototype;

  Object.defineProperty(window, "WebSocket", {
    value: KickPulseWebSocket,
    writable: false,
    configurable: true,
  });

  console.log(TAG, "Interceptor installed (constructor + addEventListener + onmessage)");
})();