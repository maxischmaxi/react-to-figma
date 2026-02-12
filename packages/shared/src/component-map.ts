/**
 * Mapping from React/shadcn component names to Figma component keys.
 *
 * Keys come from the shadcn/ui Community File (ID: 1203061493325953101).
 * Run `npm run extract-keys` with FIGMA_TOKEN to populate real keys.
 *
 * These are placeholder keys — replace with actual keys from extract-figma-keys.ts output.
 */

export interface FigmaComponentInfo {
  /** Figma component key (from REST API) */
  key: string;
  /** Whether this is a component set (has variants) */
  isComponentSet: boolean;
  /** Map React prop values → Figma variant property values */
  reactToFigmaProps: Record<string, Record<string, string>>;
  /** Default Figma variant properties */
  defaultVariantProps: Record<string, string>;
  /** Text layers that can be overridden, mapped by layer name */
  textLayers: string[];
}

/**
 * React component name → Figma component info.
 * Component keys must be extracted from the actual Figma community file.
 */
export const COMPONENT_MAP: Record<string, FigmaComponentInfo> = {
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
    defaultVariantProps: {
      Variant: "Primary",
      Size: "Default",
    },
    textLayers: ["Label"],
  },
  Card: {
    key: "PLACEHOLDER_CARD_KEY",
    isComponentSet: false,
    reactToFigmaProps: {},
    defaultVariantProps: {},
    textLayers: [],
  },
  CardHeader: {
    key: "PLACEHOLDER_CARD_HEADER_KEY",
    isComponentSet: false,
    reactToFigmaProps: {},
    defaultVariantProps: {},
    textLayers: [],
  },
  CardTitle: {
    key: "PLACEHOLDER_CARD_TITLE_KEY",
    isComponentSet: false,
    reactToFigmaProps: {},
    defaultVariantProps: {},
    textLayers: ["Title"],
  },
  CardDescription: {
    key: "PLACEHOLDER_CARD_DESCRIPTION_KEY",
    isComponentSet: false,
    reactToFigmaProps: {},
    defaultVariantProps: {},
    textLayers: ["Description"],
  },
  CardContent: {
    key: "PLACEHOLDER_CARD_CONTENT_KEY",
    isComponentSet: false,
    reactToFigmaProps: {},
    defaultVariantProps: {},
    textLayers: [],
  },
  CardFooter: {
    key: "PLACEHOLDER_CARD_FOOTER_KEY",
    isComponentSet: false,
    reactToFigmaProps: {},
    defaultVariantProps: {},
    textLayers: [],
  },
  Input: {
    key: "PLACEHOLDER_INPUT_KEY",
    isComponentSet: true,
    reactToFigmaProps: {
      type: {
        text: "Text",
        email: "Email",
        password: "Password",
      },
    },
    defaultVariantProps: {
      State: "Default",
    },
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
    defaultVariantProps: {
      Variant: "Default",
    },
    textLayers: ["Label"],
  },
  Label: {
    key: "PLACEHOLDER_LABEL_KEY",
    isComponentSet: false,
    reactToFigmaProps: {},
    defaultVariantProps: {},
    textLayers: ["Label"],
  },
  Separator: {
    key: "PLACEHOLDER_SEPARATOR_KEY",
    isComponentSet: true,
    reactToFigmaProps: {
      orientation: {
        horizontal: "Horizontal",
        vertical: "Vertical",
      },
    },
    defaultVariantProps: {
      Orientation: "Horizontal",
    },
    textLayers: [],
  },
  Avatar: {
    key: "PLACEHOLDER_AVATAR_KEY",
    isComponentSet: true,
    reactToFigmaProps: {
      size: {
        default: "Default",
        sm: "Small",
        lg: "Large",
      },
    },
    defaultVariantProps: {
      Size: "Default",
    },
    textLayers: [],
  },
  Alert: {
    key: "PLACEHOLDER_ALERT_KEY",
    isComponentSet: true,
    reactToFigmaProps: {
      variant: {
        default: "Default",
        destructive: "Destructive",
      },
    },
    defaultVariantProps: {
      Variant: "Default",
    },
    textLayers: ["Title", "Description"],
  },
  Checkbox: {
    key: "PLACEHOLDER_CHECKBOX_KEY",
    isComponentSet: true,
    reactToFigmaProps: {},
    defaultVariantProps: {
      State: "Unchecked",
    },
    textLayers: [],
  },
  Select: {
    key: "PLACEHOLDER_SELECT_KEY",
    isComponentSet: true,
    reactToFigmaProps: {},
    defaultVariantProps: {
      State: "Default",
    },
    textLayers: ["Placeholder"],
  },
  Switch: {
    key: "PLACEHOLDER_SWITCH_KEY",
    isComponentSet: true,
    reactToFigmaProps: {},
    defaultVariantProps: {
      State: "Off",
    },
    textLayers: [],
  },
  Textarea: {
    key: "PLACEHOLDER_TEXTAREA_KEY",
    isComponentSet: false,
    reactToFigmaProps: {},
    defaultVariantProps: {},
    textLayers: ["Placeholder"],
  },
};

/** List of supported component names */
export const SUPPORTED_COMPONENTS = Object.keys(COMPONENT_MAP);

/** Check if a component name is supported */
export function isSupported(name: string): boolean {
  return name in COMPONENT_MAP;
}

/** Get component info, returns undefined if not mapped */
export function getComponentInfo(name: string): FigmaComponentInfo | undefined {
  return COMPONENT_MAP[name];
}

/**
 * Translate React props to Figma variant properties.
 */
export function translateProps(
  componentName: string,
  reactProps: Record<string, unknown>,
): Record<string, string> {
  const info = COMPONENT_MAP[componentName];
  if (!info) return {};

  const figmaProps = { ...info.defaultVariantProps };

  for (const [propName, propValue] of Object.entries(reactProps)) {
    const mapping = info.reactToFigmaProps[propName];
    if (mapping && typeof propValue === "string" && mapping[propValue]) {
      // Capitalize the Figma property name (e.g., "variant" → "Variant")
      const figmaPropName =
        propName.charAt(0).toUpperCase() + propName.slice(1);
      figmaProps[figmaPropName] = mapping[propValue];
    }
  }

  return figmaProps;
}
