import { Command } from "commander";
import { captureScreenshot } from "./analyzer/screenshot.js";
import { readProjectCode } from "./analyzer/code-reader.js";
import { analyzeWithClaude } from "./analyzer/ai-analyzer.js";
import { startWebSocketServer } from "./server/websocket.js";

const program = new Command();

program
  .name("react-to-figma")
  .description("Convert a running React/shadcn app into a Figma design")
  .requiredOption("--url <url>", "URL of the running React app")
  .requiredOption("--project <path>", "Path to the React project source")
  .option("--port <number>", "WebSocket server port", "9876")
  .option("--width <number>", "Viewport width", "1440")
  .option("--height <number>", "Viewport height", "900")
  .action(async (opts) => {
    const url: string = opts.url;
    const projectPath: string = opts.project;
    const port = parseInt(opts.port, 10);
    const width = parseInt(opts.width, 10);
    const height = parseInt(opts.height, 10);

    try {
      // Step 1: Screenshot
      console.log("\n[1/4] Capturing screenshot...");
      const screenshot = await captureScreenshot(url, width, height);
      console.log(
        `  Screenshot captured: ${screenshot.viewportWidth}x${screenshot.viewportHeight} (page height: ${screenshot.pageHeight}px)`,
      );

      // Step 2: Read code
      console.log("\n[2/4] Reading project code...");
      const codeAnalysis = await readProjectCode(projectPath);
      console.log(`  Found ${codeAnalysis.files.length} relevant files`);
      console.log(
        `  Detected ${codeAnalysis.componentUsages.length} shadcn component usages`,
      );

      // Step 3: AI Analysis
      console.log("\n[3/4] Analyzing with Claude...");
      const designSpec = await analyzeWithClaude(screenshot, codeAnalysis);
      console.log(
        `  Generated DesignSpec: "${designSpec.name}" with ${designSpec.nodes.length} top-level nodes`,
      );

      // Step 4: WebSocket Server
      console.log("\n[4/4] Starting WebSocket server...");
      console.log(
        `\n  Open Figma → Plugins → React to Figma → Connect to ws://localhost:${port}\n`,
      );

      await startWebSocketServer(designSpec, port, {
        onConnected: () => {
          console.log("  Plugin connected! Sending design spec...");
        },
        onProgress: (message, progress) => {
          const pct = progress !== undefined ? ` (${progress}%)` : "";
          console.log(`  ${message}${pct}`);
        },
        onComplete: () => {
          console.log("\n  Design created successfully in Figma!");
        },
        onError: (message) => {
          console.error(`\n  Plugin error: ${message}`);
        },
      });
    } catch (err) {
      console.error(
        "\nError:",
        err instanceof Error ? err.message : String(err),
      );
      process.exit(1);
    }
  });

program.parse();
