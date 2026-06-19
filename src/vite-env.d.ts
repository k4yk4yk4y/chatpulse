/// <reference types="vite/client" />

declare module "*.css" {
  const content: string;
  export default content;
}

interface Window {
  WebSocket: typeof WebSocket;
}

interface WebSocket {
  _chatpulseHandler: ((ev: MessageEvent) => void) | null;
}
