// UI script — runs inside the plugin iframe. Has access to WebSocket.

const wsUrlInput = document.getElementById("ws-url") as HTMLInputElement;
const connectBtn = document.getElementById("connect-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const progressBar = document.getElementById("progress") as HTMLDivElement;
const progressFill = document.getElementById("progress-fill") as HTMLDivElement;

let ws: WebSocket | null = null;

function setStatus(
  message: string,
  type: "info" | "success" | "error" = "info",
) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function setProgress(percent: number) {
  progressBar.classList.add("visible");
  progressFill.style.width = `${percent}%`;
}

function hideProgress() {
  progressBar.classList.remove("visible");
}

connectBtn.addEventListener("click", () => {
  const url = wsUrlInput.value.trim();
  if (!url) return;

  if (ws) {
    ws.close();
    ws = null;
  }

  connectBtn.disabled = true;
  setStatus("Connecting...");

  try {
    ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("Connected to CLI. Waiting for design spec...", "info");

      // Tell the CLI we're connected
      ws!.send(
        JSON.stringify({
          type: "status",
          payload: { status: "connected", message: "Plugin connected" },
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "design-spec") {
          setStatus("Received design spec. Building in Figma...", "info");
          setProgress(0);

          // Forward to plugin sandbox
          parent.postMessage(
            {
              pluginMessage: {
                type: "build-design",
                payload: message.payload,
              },
            },
            "*",
          );
        }
      } catch (err) {
        setStatus(`Failed to parse message: ${err}`, "error");
      }
    };

    ws.onerror = () => {
      setStatus("Connection failed. Is the CLI running?", "error");
      connectBtn.disabled = false;
    };

    ws.onclose = () => {
      setStatus("Disconnected.", "info");
      connectBtn.disabled = false;
      hideProgress();
    };
  } catch (err) {
    setStatus(`Failed to connect: ${err}`, "error");
    connectBtn.disabled = false;
  }
});

// Listen for messages from the plugin sandbox
window.onmessage = (event) => {
  const msg = event.data?.pluginMessage;
  if (!msg) return;

  if (msg.type === "build-progress") {
    setStatus(msg.message || "Building...", "info");
    if (msg.progress !== undefined) {
      setProgress(msg.progress);
    }

    // Forward progress to CLI
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "status",
          payload: {
            status: "progress",
            message: msg.message,
            progress: msg.progress,
          },
        }),
      );
    }
  } else if (msg.type === "build-complete") {
    setStatus("Design created successfully!", "success");
    setProgress(100);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "status",
          payload: { status: "complete", message: "Design created" },
        }),
      );
    }
  } else if (msg.type === "build-error") {
    setStatus(`Error: ${msg.message}`, "error");
    hideProgress();

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "status",
          payload: { status: "error", message: msg.message },
        }),
      );
    }
  }
};
