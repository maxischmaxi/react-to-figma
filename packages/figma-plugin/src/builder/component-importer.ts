/// <reference types="@figma/plugin-typings" />

import type { ShadcnComponentNode } from "../../../shared/src/design-spec";

// Inline the component map to avoid bundling issues in the plugin sandbox
// These keys must be replaced with real ones from extract-figma-keys.ts
const COMPONENT_MAP: Record<
  string,
  {
    key: string;
    isComponentSet: boolean;
    reactToFigmaProps: Record<string, Record<string, string>>;
    defaultVariantProps: Record<string, string>;
    textLayers: string[];
  }
> = {
  Button: {
    key: "PLACEHOLDER_BUTTON_KEY",
    isComponentSet: true,
    reactToFigmaProps: {
      variant: {
        default: "Primary",
        destructive: "Destructive",
        outline: "Outline",
        secondary: "Secondary",
        ghost: "Ghost",
        link: "Link",
      },
      size: {
        default: "Default",
        sm: "Small",
        lg: "Large",
        icon: "Icon",
      },
    },
    defaultVariantProps: { Variant: "Primary", Size: "Default" },
    textLayers: ["Label"],
  },
  Input: {
    key: "PLACEHOLDER_INPUT_KEY",
    isComponentSet: true,
    reactToFigmaProps: {},
    defaultVariantProps: { State: "Default" },
    textLayers: ["Placeholder"],
  },
  Badge: {
    key: "PLACEHOLDER_BADGE_KEY",
    isComponentSet: true,
    reactToFigmaProps: {
      variant: {
        default: "Default",
        secondary: "Secondary",
        destructive: "Destructive",
        outline: "Outline",
      },
    },
    defaultVariantProps: { Variant: "Default" },
    textLayers: ["Label"],
  },
  Checkbox: {
    key: "PLACEHOLDER_CHECKBOX_KEY",
    isComponentSet: true,
    reactToFigmaProps: {},
    defaultVariantProps: { State: "Unchecked" },
    textLayers: [],
  },
  // Add more as needed — keys must come from extract-figma-keys.ts
};

const importCache = new Map<string, ComponentNode>();

/**
 * Try to import a shadcn component from the community library.
 * Falls back to a labeled rectangle if the import fails.
 */
export async function importShadcnComponent(
  node: ShadcnComponentNode,
): Promise<SceneNode> {
  const info = COMPONENT_MAP[node.componentName];

  if (
    info &&
    info.key !== `PLACEHOLDER_${node.componentName.toUpperCase()}_KEY`
  ) {
    try {
      return await importFromFigmaLibrary(node, info);
    } catch (err) {
      console.log(
        `Failed to import ${node.componentName}, using fallback:`,
        err,
      );
    }
  }

  // Fallback: create a labeled rectangle
  return createFallbackComponent(node);
}

async function importFromFigmaLibrary(
  node: ShadcnComponentNode,
  info: (typeof COMPONENT_MAP)[string],
): Promise<SceneNode> {
  let component = importCache.get(info.key);

  if (!component) {
    if (info.isComponentSet) {
      const componentSet = await figma.importComponentSetByKeyAsync(info.key);
      // Pick the default variant
      const defaultChild = componentSet.children[0];
      if (defaultChild.type === "COMPONENT") {
        component = defaultChild;
      } else {
        throw new Error("Component set has no component children");
      }
    } else {
      component = await figma.importComponentByKeyAsync(info.key);
    }
    importCache.set(info.key, component);
  }

  const instance = component.createInstance();
  instance.name = node.name;
  instance.x = node.x;
  instance.y = node.y;
  instance.resize(node.width, node.height);

  // Set variant properties
  const figmaProps = { ...info.defaultVariantProps };
  const reactProps = node.componentProps || {};

  for (const [propName, propValue] of Object.entries(reactProps)) {
    const mapping = info.reactToFigmaProps[propName];
    if (mapping && typeof propValue === "string" && mapping[propValue]) {
      const figmaPropName =
        propName.charAt(0).toUpperCase() + propName.slice(1);
      figmaProps[figmaPropName] = mapping[propValue];
    }
  }

  try {
    instance.setProperties(figmaProps);
  } catch {
    // Variant properties might not match exactly
  }

  // Set text content in text layers
  if (node.textContent && info.textLayers.length > 0) {
    await setTextInInstance(instance, info.textLayers[0], node.textContent);
  }

  return instance;
}

async function setTextInInstance(
  instance: InstanceNode,
  layerName: string,
  text: string,
) {
  const textNode = instance.findOne(
    (n) => n.type === "TEXT" && n.name === layerName,
  ) as TextNode | null;

  if (textNode) {
    // Load the font used by the text node
    const fontName = textNode.fontName as FontName;
    await figma.loadFontAsync(fontName);
    textNode.characters = text;
  } else {
    // Try to find any text node
    const anyText = instance.findOne(
      (n) => n.type === "TEXT",
    ) as TextNode | null;
    if (anyText) {
      const fontName = anyText.fontName as FontName;
      await figma.loadFontAsync(fontName);
      anyText.characters = text;
    }
  }
}

function createFallbackComponent(node: ShadcnComponentNode): FrameNode {
  const frame = figma.createFrame();
  frame.name = `${node.componentName} (fallback)`;
  frame.x = node.x;
  frame.y = node.y;
  frame.resize(node.width, node.height);

  // Light gray background with border
  frame.fills = [
    {
      type: "SOLID",
      color: { r: 0.96, g: 0.96, b: 0.98 },
    },
  ];
  frame.strokes = [
    {
      type: "SOLID",
      color: { r: 0.8, g: 0.8, b: 0.85 },
    },
  ];
  frame.strokeWeight = 1;
  frame.cornerRadius = 6;

  // Auto-layout to center the label
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisAlignItems = "CENTER";
  frame.counterAxisAlignItems = "CENTER";
  frame.paddingTop = 8;
  frame.paddingBottom = 8;
  frame.paddingLeft = 12;
  frame.paddingRight = 12;

  // Label text
  const labelText = node.textContent || node.componentName;
  const textNode = figma.createText();

  figma
    .loadFontAsync({ family: "Inter", style: "Regular" })
    .then(() => {
      textNode.characters = labelText;
      textNode.fontSize = 13;
      textNode.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.35 } }];
    })
    .catch(() => {
      // Font loading failed — leave default
    });

  frame.appendChild(textNode);
  return frame;
}
