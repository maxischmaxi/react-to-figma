import { build, context } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const isWatch = process.argv.includes("--watch");

// Build main (sandbox)
const mainOptions = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "neutral",
  target: "es2022",
  format: "iife",
  outfile: "dist/main.js",
  sourcemap: false,
};

// Build UI script
const uiScriptOptions = {
  entryPoints: ["src/ui.ts"],
  bundle: true,
  platform: "browser",
  target: "es2022",
  format: "iife",
  write: false,
  sourcemap: false,
};

async function buildAll() {
  await build(mainOptions);

  const uiResult = await build(uiScriptOptions);
  const uiScript = uiResult.outputFiles[0].text;

  const uiHtml = readFileSync("src/ui.html", "utf-8");
  const finalHtml = uiHtml.replace(
    "<!-- INJECTED_SCRIPT -->",
    `<script>${uiScript}</script>`
  );

  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/ui.html", finalHtml);

  console.log("Figma plugin built successfully.");
}

if (isWatch) {
  const ctx = await context(mainOptions);
  await ctx.watch();
  console.log("Watching for changes...");
  // Also do initial build of UI
  await buildAll();
} else {
  await buildAll();
}
