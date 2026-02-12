import Anthropic from "@anthropic-ai/sdk";
import { DesignSpecSchema, SUPPORTED_COMPONENTS } from "@react-to-figma/shared";
import type { DesignSpec } from "@react-to-figma/shared";
import type { ScreenshotResult } from "./screenshot.js";
import type { CodeAnalysis } from "./code-reader.js";

const SYSTEM_PROMPT = `You are a design system expert that converts React/shadcn UI screenshots and code into a structured DesignSpec JSON format for Figma recreation.

## Your Task
Analyze the provided screenshot and React source code, then produce a JSON DesignSpec that describes the visual layout and components.

## Available shadcn Components
${SUPPORTED_COMPONENTS.map((c) => `- ${c}`).join("\n")}

If a UI element uses a component not in this list, represent it as a "frame" or "rectangle" with appropriate styling.

## Tailwind Spacing → Pixels
- 1 unit = 4px (e.g., p-4 = 16px, gap-2 = 8px, m-6 = 24px)
- text-xs: 12px, text-sm: 14px, text-base: 16px, text-lg: 18px, text-xl: 20px, text-2xl: 24px, text-3xl: 30px

## Layout Rules
- Tailwind \`flex flex-col\` → autoLayout mode: "VERTICAL"
- Tailwind \`flex flex-row\` or just \`flex\` → autoLayout mode: "HORIZONTAL"
- \`items-center\` → counterAxisAlignItems: "CENTER"
- \`justify-center\` → primaryAxisAlignItems: "CENTER"
- \`justify-between\` → primaryAxisAlignItems: "SPACE_BETWEEN"
- \`gap-N\` → spacing: N * 4

## Color Mapping (Tailwind defaults, values 0-1)
- bg-background / bg-white: {r:1, g:1, b:1, a:1}
- bg-primary / bg-zinc-900: {r:0.09, g:0.09, b:0.11, a:1}
- bg-secondary / bg-zinc-100: {r:0.96, g:0.96, b:0.96, a:1}
- bg-muted / bg-zinc-100: {r:0.96, g:0.96, b:0.96, a:1}
- bg-destructive / bg-red-500: {r:0.94, g:0.27, b:0.27, a:1}
- text-primary / text-foreground: {r:0.09, g:0.09, b:0.11, a:1}
- text-muted-foreground: {r:0.45, g:0.45, b:0.47, a:1}
- border color: {r:0.90, g:0.90, b:0.92, a:1}

## Output Format
Return ONLY valid JSON matching this structure (no markdown, no code fences):
{
  "version": 1,
  "name": "Page Name",
  "width": <viewport width>,
  "height": <viewport height>,
  "backgroundColor": { "r": 1, "g": 1, "b": 1, "a": 1 },
  "nodes": [
    {
      "type": "frame" | "shadcn-component" | "text" | "rectangle" | "image",
      "name": "descriptive-name",
      "x": <number>, "y": <number>,
      "width": <number>, "height": <number>,
      "opacity": 1, "visible": true,
      // For frames:
      "fills": [{ "type": "SOLID", "color": { "r": 0, "g": 0, "b": 0, "a": 1 } }],
      "autoLayout": { "mode": "VERTICAL", "spacing": 8, ... },
      "children": [ ... ]
      // For shadcn-component:
      "componentName": "Button",
      "componentProps": { "variant": "outline", "size": "sm" },
      "textContent": "Click me"
      // For text:
      "text": "Hello",
      "textStyle": { "fontFamily": "Inter", "fontSize": 16, "fontWeight": 400, "color": {...} }
    }
  ]
}

## Important Rules
1. Position and size every element based on what you see in the screenshot
2. Use "shadcn-component" type for recognized shadcn components from the code
3. Preserve the exact text content from the code/screenshot
4. Create a hierarchical layout tree — use frames to group related elements
5. Every node MUST have x, y, width, height
6. Use auto-layout on frames wherever flex is used in the code
7. Keep the structure as flat as reasonable — don't over-nest`;

const MAX_RETRIES = 2;

export async function analyzeWithClaude(
  screenshot: ScreenshotResult,
  codeAnalysis: CodeAnalysis,
): Promise<DesignSpec> {
  const client = new Anthropic();

  const userMessage = `Analyze this React/shadcn application and produce a DesignSpec JSON.

## Screenshot Info
- Viewport: ${screenshot.viewportWidth}x${screenshot.viewportHeight}
- Full page height: ${screenshot.pageHeight}px

## Detected shadcn Components in Code
${
  codeAnalysis.componentUsages.length > 0
    ? codeAnalysis.componentUsages
        .map(
          (u) =>
            `- <${u.name} ${Object.entries(u.props)
              .map(([k, v]) => (v === true ? k : `${k}="${v}"`))
              .join(
                " ",
              )}>${u.children || ""}</${u.name}> (${u.sourceFile}:${u.line})`,
        )
        .join("\n")
    : "No shadcn components detected in code."
}

## Source Code
\`\`\`tsx
${codeAnalysis.sourceCode.slice(0, 40000)}
\`\`\`

Produce the DesignSpec JSON now. Output ONLY the JSON, no other text.`;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: screenshot.base64,
                },
              },
              {
                type: "text",
                text: userMessage,
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text response from Claude");
      }

      let jsonText = textBlock.text.trim();

      // Strip markdown code fences if present
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/^```(?:json)?\s*\n?/, "")
          .replace(/\n?```\s*$/, "");
      }

      const parsed = JSON.parse(jsonText);
      const validated = DesignSpecSchema.parse(parsed);
      return validated as DesignSpec;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        console.log(
          `  Retry ${attempt + 1}/${MAX_RETRIES}: ${lastError.message.slice(0, 100)}`,
        );
      }
    }
  }

  throw new Error(
    `Failed to get valid DesignSpec from Claude after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`,
  );
}
