# CLAUDE.md — React to Figma

## Project Overview

npm workspaces monorepo that converts a running React/shadcn app into a Figma design. Two-part system: a Node.js CLI analyzes the app (Playwright screenshot + Babel code parsing + Claude Vision), then a Figma plugin receives the result over WebSocket and builds the design using the Figma Plugin API.

## Repository Layout

```text
packages/shared/          → @react-to-figma/shared        (private, types + Zod schemas, built with tsc)
packages/react-to-figma/  → @maxischmaxi/react-to-figma          (published to npm, bundled with esbuild → ESM)
packages/figma-plugin/    → @maxischmaxi/react-to-figma-plugin   (published to npm, bundled with esbuild → IIFE)
scripts/                  → One-time utility scripts
.github/workflows/        → CI/CD (release on tag push)
```

## Build

```bash
npm run build               # All workspaces (shared must build first, others depend on it)
npm run build:shared        # tsc
npm run build:react-to-figma # esbuild (src/index.ts → dist/index.js, ESM, node20 target)
npm run build:plugin        # esbuild (main.ts → dist/main.js IIFE + ui.ts injected into dist/ui.html)
```

Build order matters: shared → react-to-figma, shared types are also referenced (via relative paths) by the plugin.

The esbuild config (`packages/react-to-figma/build.mjs`) injects a `createRequire` shim in the banner to support CJS dependencies (commander, ws) in ESM output. Playwright is externalized (not bundled).

The plugin esbuild config (`packages/figma-plugin/build.mjs`) builds two outputs: the sandbox code (IIFE) and the UI script which gets injected into `src/ui.html` at the `<!-- INJECTED_SCRIPT -->` marker.

## Key Architecture Decisions

- **WebSocket bridge**: Figma plugins run in a sandbox that can't access external APIs. The UI iframe can use WebSocket. So: CLI starts a WS server → plugin UI connects → forwards data to sandbox via `postMessage`.
- **Zod validation**: Claude's JSON output is validated with Zod (`DesignSpecSchema`) before sending to the plugin. Retry up to 2 times on malformed output.
- **Component fallback**: When shadcn component import fails (placeholder keys or Figma library not published), a labeled gray rectangle is created instead.
- **Recursive node builder**: The DesignSpec is a tree of nodes. `node-builder.ts` recursively walks the tree and creates corresponding Figma nodes.

## Important Files

| File | What it does |
|------|-------------|
| `packages/shared/src/design-spec.ts` | DesignSpec interface + Zod schema. Central contract between CLI and plugin. Node types: frame, shadcn-component, text, rectangle, image. |
| `packages/shared/src/component-map.ts` | Static mapping of React component name → Figma component key + variant translation. `PLACEHOLDER_*_KEY` values need replacing with real keys from `extract-figma-keys.ts`. |
| `packages/react-to-figma/src/index.ts` | CLI entry point (commander). Orchestrates: screenshot → code-reader → ai-analyzer → websocket. |
| `packages/react-to-figma/src/analyzer/ai-analyzer.ts` | Claude API call. Uses `claude-sonnet-4-5-20250929`. System prompt defines Tailwind→pixel mappings, color mappings, layout rules, and the exact JSON output format. |
| `packages/react-to-figma/src/analyzer/code-reader.ts` | Babel AST parser. Finds `.tsx`/`.jsx` files, detects `@/components/ui/*` imports, extracts component usages with props. 50KB source limit. |
| `packages/react-to-figma/src/analyzer/screenshot.ts` | Playwright chromium. Viewport screenshot, base64 PNG. `networkidle` wait + 1s extra. |
| `packages/react-to-figma/src/server/websocket.ts` | WS server on configurable port (default 9876). 5-minute timeout. Single-connection enforced. |
| `packages/figma-plugin/src/main.ts` | Plugin sandbox. Receives `build-design` message, creates new Figma page, calls recursive builder. |
| `packages/figma-plugin/src/ui.ts` | Plugin UI iframe. WebSocket client → forwards messages between CLI and sandbox. |
| `packages/figma-plugin/src/builder/node-builder.ts` | Maps DesignSpec nodes to Figma API calls (`createFrame`, `createText`, `createRectangle`). Handles auto-layout, fills, strokes, text styles. |
| `packages/figma-plugin/src/builder/component-importer.ts` | `figma.importComponentByKeyAsync` / `importComponentSetByKeyAsync`. Caches imports. Sets variant props and text content. Has its own copy of the component map (can't import from shared in plugin sandbox). |

## Code Conventions

- TypeScript strict mode everywhere
- ESM (`"type": "module"`) for shared and react-to-figma packages
- Plugin is IIFE (Figma sandbox requirement)
- Figma plugin types from `@figma/plugin-typings` (reference directive in `.ts` files)
- The plugin's `component-importer.ts` duplicates the component map from shared because the plugin sandbox can't import workspace packages at runtime — it's bundled by esbuild

## Common Tasks

**Adding a new shadcn component mapping:**
1. Add entry in `packages/shared/src/component-map.ts` (COMPONENT_MAP)
2. Add matching entry in `packages/figma-plugin/src/builder/component-importer.ts` (COMPONENT_MAP)
3. Add component name to the system prompt in `packages/react-to-figma/src/analyzer/ai-analyzer.ts` (SUPPORTED_COMPONENTS is used automatically)
4. Rebuild: `npm run build`

**Changing the Claude model or prompt:**
Edit `packages/react-to-figma/src/analyzer/ai-analyzer.ts`. Model is set in the `messages.create()` call. System prompt is `SYSTEM_PROMPT` constant.

**Changing the DesignSpec schema:**
Edit `packages/shared/src/design-spec.ts`. Update both the Zod schema AND the TypeScript interface (they're maintained separately). Then update `node-builder.ts` in the plugin to handle any new node types or properties.

**Testing the CLI without the plugin:**
The CLI will run steps 1-3 and then wait at step 4 (WebSocket). You can verify screenshot capture, code reading, and AI analysis work correctly by checking the console output. The WebSocket server times out after 5 minutes.

## Versioning

All packages share the same version. Bump all at once:

```bash
npm run version:patch   # 0.0.1 → 0.0.2
npm run version:minor   # 0.0.2 → 0.1.0
npm run version:major   # 0.1.0 → 1.0.0
```

These commands update all 4 `package.json` files (root + 3 workspaces) synchronously via `npm version --no-git-tag-version --workspaces`. No git tags or commits are created — that's a separate step.

## Releasing

Two packages are published to npm. Releases are triggered by pushing a git tag:

```bash
npm run version:patch
git add -A && git commit -m "v0.0.2"
git tag v0.0.2
git push origin main --tags
```

The workflow (`.github/workflows/release.yml`) does:
1. `npm ci` — install deps
2. Sets version from tag name (strips `v` prefix) in both publishable packages
3. `npm run build` — builds all workspaces
4. Verifies the CLI runs (`--help`)
5. Publishes `@maxischmaxi/react-to-figma` (CLI) to npm
6. Publishes `@maxischmaxi/react-to-figma-plugin` (Figma plugin) to npm

Both packages use the same version, derived from the git tag. The workflow overrides the version in package.json from the tag, so the local version bump is mainly for consistency — the tag is the source of truth.

**CLI package** (`packages/react-to-figma`): esbuild bundles all deps into a single file — only `playwright` is a runtime dependency. The `files` field limits what goes to npm: `dist/index.js` and its source map.

**Plugin package** (`packages/figma-plugin`): Ships `manifest.json`, `dist/main.js`, and `dist/ui.html`. Users install it with npm and point Figma to the manifest.json inside node_modules.

The `@react-to-figma/shared` package is `private: true` and never published — it's only a build-time dependency consumed via npm workspaces.

## Environment Variables

- `ANTHROPIC_API_KEY` — required for Claude API calls in the CLI
- `FIGMA_TOKEN` — only needed for `npm run extract-keys`
- `NPM_TOKEN` — GitHub Actions secret for npm publishing

## Gotchas

- The plugin's component-importer.ts has its own copy of the component map — changes to shared/component-map.ts don't automatically propagate. Both must be updated.
- Zod schemas use `z.lazy()` with `as any` casts for recursive DesignNode references — this is intentional to work around Zod type inference limitations.
- The esbuild banner in `packages/react-to-figma/build.mjs` uses `createRequire` to polyfill `require()` for CJS deps in ESM output.
- `@babel/traverse` has a default export compatibility issue between CJS/ESM — `code-reader.ts` handles this with a runtime check.
- Figma plugin UI iframe can use WebSocket but the sandbox code cannot — all network communication goes through the UI iframe.
