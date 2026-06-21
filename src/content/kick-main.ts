(() => {
  const TAG = "[ChatPulse Kick MAIN v1]";
  const CUSTOM_EVENT = "chatpulse:kick:msg";

  const OrigWebSocket = window.WebSocket;

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

  function hookMessageEvent(ev: Event): void {
    const msgEv = ev as MessageEvent;
    if (typeof msgEv.data === "string") {
      try {
        const parsed = JSON.parse(msgEv.data);
        if (parsed.type === "chat_message") {
          console.log(TAG, "Intercepted Kick chat_message, length:", msgEv.data.length);
          emitFrame(msgEv.data);
        }
      } catch {
        // Not JSON, skip
      }
    }
  }

  const origAddEventListener = OrigWebSocket.prototype.addEventListener;

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