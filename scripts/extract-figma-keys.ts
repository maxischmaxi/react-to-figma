/**
 * Extract component keys from the shadcn/ui Figma Community File.
 *
 * Usage:
 *   FIGMA_TOKEN=xxx npm run extract-keys
 *
 * This fetches all published components from the community file and
 * outputs a JSON mapping of component name → key.
 */

const FIGMA_FILE_KEY = "1203061493325953101";
const API_BASE = "https://api.figma.com/v1";

interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  containing_frame?: {
    name: string;
  };
}

interface FigmaComponentsResponse {
  meta: {
    components: FigmaComponent[];
    component_sets: FigmaComponent[];
  };
}

async function main() {
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    console.error("Error: FIGMA_TOKEN environment variable is required.");
    console.error(
      "Get one at: https://www.figma.com/developers/api#access-tokens",
    );
    process.exit(1);
  }

  console.log(`Fetching components from Figma file ${FIGMA_FILE_KEY}...`);

  const response = await fetch(
    `${API_BASE}/files/${FIGMA_FILE_KEY}/components`,
    {
      headers: { "X-Figma-Token": token },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`Figma API error (${response.status}): ${text}`);
    process.exit(1);
  }

  const data = (await response.json()) as FigmaComponentsResponse;

  // Also fetch component sets
  const setsResponse = await fetch(
    `${API_BASE}/files/${FIGMA_FILE_KEY}/component_sets`,
    {
      headers: { "X-Figma-Token": token },
    },
  );

  const setsData = setsResponse.ok
    ? ((await setsResponse.json()) as FigmaComponentsResponse)
    : null;

  const output: Record<
    string,
    {
      key: string;
      name: string;
      type: "component" | "component_set";
      frame?: string;
    }
  > = {};

  // Process individual components
  for (const comp of data.meta.components) {
    output[comp.name] = {
      key: comp.key,
      name: comp.name,
      type: "component",
      frame: comp.containing_frame?.name,
    };
  }

  // Process component sets
  if (setsData) {
    for (const set of setsData.meta.component_sets) {
      output[set.name] = {
        key: set.key,
        name: set.name,
        type: "component_set",
        frame: set.containing_frame?.name,
      };
    }
  }

  const componentCount = Object.keys(output).length;
  console.log(`Found ${componentCount} components/sets.\n`);

  // Print as JSON
  console.log(JSON.stringify(output, null, 2));

  // Also print a summary for quick reference
  console.log("\n--- Summary ---");
  for (const [name, info] of Object.entries(output)) {
    console.log(`  ${name}: ${info.key} (${info.type})`);
  }

  console.log(
    "\nCopy the relevant keys into packages/shared/src/component-map.ts",
  );
  console.log("and packages/figma-plugin/src/builder/component-importer.ts");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
