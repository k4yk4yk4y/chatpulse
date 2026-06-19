import { test, expect } from "@playwright/test";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOCK_PORT = 8765;

const mainScript = fs.readFileSync(
  path.resolve(__dirname, "../dist/assets/twitch-main.ts-BuktJAWW.js"),
  "utf-8"
);

function createMockServer(): { server: http.Server; wss: WebSocketServer } {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html><body><h1 id="status">loading</h1></body></html>`);
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    const msgs = [
      "@badge-info=;badges=broadcaster/1;bits=0;color=#FF0000;display-name=Streamer;emotes=;id=abc1;mod=0;room-id=1;subscriber=0;tmi-sent-ts=1700000000000;user-id=1;user-type= :streamer!streamer@streamer.tmi.twitch.tv PRIVMSG #streamer :Welcome to the stream everyone!",
      "@badge-info=;badges=subscriber/1;bits=0;color=;display-name=Fan1;emotes=;id=abc2;mod=0;room-id=1;subscriber=1;tmi-sent-ts=1700000001000;user-id=2;user-type= :fan1!fan1@fan1.tmi.twitch.tv PRIVMSG #streamer :Hey, the new patch broke the audio again",
      "@badge-info=;badges=;bits=100;color=;display-name=Tipper;emotes=;id=abc3;mod=0;room-id=1;subscriber=0;tmi-sent-ts=1700000002000;user-id=3;user-type= :tipper!tipper@tipper.tmi.twitch.tv PRIVMSG #streamer :Where is the RGB settings? Can anyone help?",
      "@badge-info=;badges=moderator/1;bits=0;color=#00FF00;display-name=Mod;emotes=;id=abc4;mod=1;room-id=1;subscriber=1;tmi-sent-ts=1700000003000;user-id=4;user-type=mod :mod!mod@mod.tmi.twitch.tv PRIVMSG #streamer :This game is way better than the competitor",
      "@badge-info=;badges=;bits=0;color=;display-name=ChatBot;emotes=;id=abc5;mod=0;room-id=1;subscriber=0;tmi-sent-ts=1700000004000;user-id=5;user-type= :chatbot!chatbot@chatbot.tmi.twitch.tv PRIVMSG #streamer :Pog Pog Pog Pog Pog Pog Pog Pog Pog Pog Pog",
      "@badge-info=;badges=;bits=0;color=;display-name=RealUser;emotes=;id=abc6;mod=0;room-id=1;subscriber=0;tmi-sent-ts=1700000005000;user-id=6;user-type= :realuser!realuser@realuser.tmi.twitch.tv PRIVMSG #streamer :Can you fix the lag spikes? My FPS drops every 5 minutes",
    ];

    msgs.forEach((msg, i) => {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      }, 300 + i * 200);
    });

    ws.on("message", (data) => {
      const s = data.toString();
      if (s.startsWith("PONG")) ws.send(":tmi.twitch.tv PONG :tmi.twitch.tv");
    });
  });

  return { server, wss };
}

test.describe("ChatPulse WebSocket interception", () => {
  let mock: ReturnType<typeof createMockServer>;

  test.beforeAll(async () => {
    mock = createMockServer();
    await new Promise<void>((r) => mock.server.listen(MOCK_PORT, r));
  });

  test.afterAll(async () => {
    mock.wss.close();
    await new Promise<void>((r) => mock.server.close(() => r()));
  });

  test("MAIN-world script captures PRIVMSG from Twitch IRC frames", async ({
    page,
  }) => {
    await page.goto(`http://localhost:${MOCK_PORT}/`);

    // Inject the interceptor script
    await page.addScriptTag({ content: mainScript });

    // Listen for the custom event, then override WebSocket.url to simulate Twitch
    await page.evaluate(() => {
      (window as Record<string, unknown>)._captured = [];
      window.addEventListener(
        "chatpulse:msg",
        ((e: CustomEvent) => {
          ((window as Record<string, unknown>)._captured as string[]).push(
            e.detail.frame
          );
        }) as EventListener
      );

      // Override WebSocket so that the url getter returns a Twitch-like URL
      const OrigWS = window.WebSocket;
      class FakeTwitchWS extends OrigWS {
        get url(): string {
          return "wss://irc-ws.chat.twitch.tv:443/";
        }
      }
      (window as unknown as Record<string, unknown>).WebSocket = FakeTwitchWS;
    });

    // Now create a WebSocket — it will appear as Twitch IRC to our interceptor
    await page.evaluate((port) => {
      const ws = new WebSocket(`ws://localhost:${port}/`);
      ws.addEventListener("message", () => {});
    }, MOCK_PORT);

    await page.waitForTimeout(2500);

    const captured = await page.evaluate(
      () => (window as Record<string, unknown>)._captured as string[]
    );

    console.log(`\n=== Captured ${captured.length} messages ===`);
    captured.forEach((m) => console.log(`  ${m.substring(0, 100)}...`));

    const privmsgCount = captured.filter((m) => m.includes("PRIVMSG")).length;
    console.log(`PRIVMSG count: ${privmsgCount}`);

    expect(privmsgCount).toBeGreaterThanOrEqual(4);
  });

  test("filters PING frames", async ({ page }) => {
    await page.goto(`http://localhost:${MOCK_PORT}/`);
    await page.addScriptTag({ content: mainScript });

    await page.evaluate(() => {
      (window as Record<string, unknown>)._captured = [];
      window.addEventListener(
        "chatpulse:msg",
        ((e: CustomEvent) => {
          ((window as Record<string, unknown>)._captured as string[]).push(
            e.detail.frame
          );
        }) as EventListener
      );

      const OrigWS = window.WebSocket;
      class FakeTwitchWS extends OrigWS {
        get url(): string {
          return "wss://irc-ws.chat.twitch.tv:443/";
        }
      }
      (window as unknown as Record<string, unknown>).WebSocket = FakeTwitchWS;
    });

    await page.evaluate((port) => {
      const ws = new WebSocket(`ws://localhost:${port}/`);
      ws.addEventListener("message", () => {});
    }, MOCK_PORT);

    await page.waitForTimeout(2500);

    const captured = await page.evaluate(
      () => (window as Record<string, unknown>)._captured as string[]
    );

    const pingCount = captured.filter((m) => m.includes("PING")).length;
    expect(pingCount).toBe(0);
  });
});
