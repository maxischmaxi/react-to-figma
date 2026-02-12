import { WebSocketServer, WebSocket } from "ws";
import type { DesignSpec, WebSocketMessage } from "@react-to-figma/shared";

export interface ServerEvents {
  onConnected: () => void;
  onProgress: (message: string, progress?: number) => void;
  onComplete: () => void;
  onError: (message: string) => void;
}

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function startWebSocketServer(
  designSpec: DesignSpec,
  port: number,
  events: ServerEvents,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port });
    let pluginSocket: WebSocket | null = null;
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        wss.close();
        reject(new Error("Timeout: No plugin connected within 5 minutes"));
      }
    }, TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      wss.close();
    }

    wss.on("connection", (ws) => {
      if (pluginSocket) {
        ws.close(1000, "Already connected");
        return;
      }

      pluginSocket = ws;

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;

          if (message.type === "status") {
            const { status, message: msg, progress } = message.payload;

            switch (status) {
              case "connected":
                events.onConnected();
                // Send the design spec
                const specMessage: WebSocketMessage = {
                  type: "design-spec",
                  payload: designSpec,
                };
                ws.send(JSON.stringify(specMessage));
                break;

              case "building":
              case "progress":
                events.onProgress(msg || "Building...", progress);
                break;

              case "complete":
                events.onComplete();
                if (!resolved) {
                  resolved = true;
                  cleanup();
                  resolve();
                }
                break;

              case "error":
                events.onError(msg || "Unknown plugin error");
                if (!resolved) {
                  resolved = true;
                  cleanup();
                  reject(new Error(`Plugin error: ${msg}`));
                }
                break;
            }
          }
        } catch (err) {
          console.error("Failed to parse plugin message:", err);
        }
      });

      ws.on("close", () => {
        pluginSocket = null;
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error("Plugin disconnected unexpectedly"));
        }
      });

      ws.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(err);
        }
      });
    });

    wss.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(err);
      }
    });

    console.log(`WebSocket server listening on ws://localhost:${port}`);
    console.log("Waiting for Figma plugin to connect...");
  });
}
