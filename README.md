# React to Figma

Converts a running React/shadcn app into a Figma design — with real shadcn component instances from the community library.

## How it works

```text
CLI (Node.js)                              Figma Plugin
─────────────                              ────────────
1. Playwright screenshots the app
2. Babel parses the React source code
3. Claude Vision analyzes both
   → produces DesignSpec JSON
4. WebSocket server starts        ──ws──►  Connects to CLI
                                           Receives DesignSpec
                                           Imports shadcn components
                                           Builds Figma page
```

The Figma REST API is read-only — creating designs requires the Plugin API. That's why this is a two-part system: a CLI that does the analysis, and a Figma plugin that builds the design.

## Prerequisites

- **Node.js** >= 20
- **Figma** desktop app with plugin support
- **`ANTHROPIC_API_KEY`** environment variable set
- **`FIGMA_TOKEN`** (only for the one-time key extraction script)
- The **shadcn/ui Figma Community File** added to your Figma libraries:
  Open [the file](https://www.figma.com/community/file/1203061493325953101), duplicate it, and publish it as a library

## Install

```bash
npx @maxischmaxi/react-to-figma --url http://localhost:3000 --project ./my-app
```

Or install globally:

```bash
npm install -g @maxischmaxi/react-to-figma
npx playwright install chromium
react-to-figma --url http://localhost:3000 --project ./my-app
```

### Development Setup

```bash
npm install
npx playwright install chromium
npm run build
```

### Extract Figma Component Keys (one-time)

The component map ships with placeholder keys. To use real shadcn Figma components, extract the actual keys:

```bash
FIGMA_TOKEN=your-token npm run extract-keys
```

Then copy the output keys into:
- `packages/shared/src/component-map.ts`
- `packages/figma-plugin/src/builder/component-importer.ts`

Rebuild after updating keys: `npm run build`

## Usage

### 1. Start your React app

Your app needs to be running and accessible via URL (e.g. `http://localhost:3000`).

### 2. Run the CLI

```bash
npx @maxischmaxi/react-to-figma --url http://localhost:3000 --project ./path-to-your-app
```

Options:

| Flag | Default | Description |
|------|---------|-------------|
| `--url <url>` | (required) | URL of the running React app |
| `--project <path>` | (required) | Path to the React project source |
| `--port <number>` | `9876` | WebSocket server port |
| `--width <number>` | `1440` | Viewport width in px |
| `--height <number>` | `900` | Viewport height in px |

The CLI runs through 4 steps:
1. **Screenshot** — Playwright captures the viewport
2. **Code analysis** — Babel parses `.tsx`/`.jsx` files, detects shadcn imports
3. **AI analysis** — Claude Vision produces a DesignSpec JSON from screenshot + code
4. **WebSocket server** — Waits for the Figma plugin to connect (5 min timeout)

### 3. Install and connect the Figma plugin

Install the plugin package:

```bash
npm install @maxischmaxi/react-to-figma-plugin
```

Then in Figma:

1. Go to **Plugins → Development → Import plugin from manifest**
2. Select `node_modules/@maxischmaxi/react-to-figma-plugin/manifest.json`
3. Run the plugin, enter `ws://localhost:9876`, click **Connect**
4. The plugin receives the DesignSpec and builds the design

## Project Structure

```bash
react-to-figma/
├── packages/
│   ├── shared/                    # Shared types between CLI and plugin
│   │   └── src/
│   │       ├── design-spec.ts     # DesignSpec types + Zod validation
│   │       └── component-map.ts   # React component → Figma component key mapping
│   ├── react-to-figma/            # CLI tool (published as @maxischmaxi/react-to-figma)
│   │   └── src/
│   │       ├── index.ts           # Entry point (commander)
│   │       ├── analyzer/
│   │       │   ├── screenshot.ts      # Playwright screenshot capture
│   │       │   ├── code-reader.ts     # Babel AST parser for shadcn detection
│   │       │   └── ai-analyzer.ts     # Claude Vision API integration
│   │       └── server/
│   │           └── websocket.ts       # WebSocket server
│   └── figma-plugin/              # Figma plugin
│       ├── manifest.json
│       └── src/
│           ├── main.ts            # Plugin sandbox
│           ├── ui.html / ui.ts    # Plugin UI + WebSocket client
│           └── builder/
│               ├── node-builder.ts        # Recursive Figma node builder
│               └── component-importer.ts  # shadcn component import + fallback
└── scripts/
    └── extract-figma-keys.ts      # One-time Figma API key extraction
```

This is an npm workspaces monorepo with three packages:
- **`@react-to-figma/shared`** — built with `tsc`, outputs declarations (private)
- **`@maxischmaxi/react-to-figma`** — CLI, bundled with esbuild (ESM, Node target, published to npm)
- **`@maxischmaxi/react-to-figma-plugin`** — Figma plugin, bundled with esbuild (IIFE, published to npm)

## Build Commands

```bash
npm run build               # Build all workspaces (shared → react-to-figma → plugin)
npm run build:shared        # Build shared types only
npm run build:react-to-figma # Build CLI only
npm run build:plugin        # Build Figma plugin only
```

The shared package must be built before react-to-figma (it imports from shared). The plugin bundles its own copy of the types.

## Supported shadcn Components

Button, Card (+ CardHeader, CardTitle, CardDescription, CardContent, CardFooter), Input, Badge, Label, Separator, Avatar, Alert, Checkbox, Select, Switch, Textarea.

Unsupported components fall back to a labeled gray rectangle in Figma.

## DesignSpec Format

The CLI produces and the plugin consumes a `DesignSpec` JSON:

```typescript
interface DesignSpec {
  version: 1;
  name: string;
  width: number;
  height: number;
  backgroundColor: Color; // { r, g, b, a } values 0-1
  nodes: DesignNode[];    // recursive tree
}
```

Node types: `frame`, `shadcn-component`, `text`, `rectangle`, `image`. Each has position (x/y), size (width/height), and type-specific properties. Frames support auto-layout. All validated at runtime with Zod.

## Environment Variables

| Variable | Required | Used by |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | CLI (Claude API) |
| `FIGMA_TOKEN` | Only for key extraction | `extract-figma-keys.ts` |

## Known Limitations

- Component keys are placeholders until you run `extract-keys` — without real keys, all components render as fallback rectangles
- Source code sent to Claude is capped at 50KB
- Only viewport-sized screenshots (no full-page scroll capture)
- The Figma plugin can only connect to `localhost` (WebSocket)
- Font loading in Figma may fail for non-Inter fonts — falls back to Inter Regular
- Variant property names between React and Figma may not match perfectly for all components
