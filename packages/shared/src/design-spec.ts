import { z } from "zod";

// --- Base Style Schemas ---

const ColorSchema = z.object({
  r: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  b: z.number().min(0).max(1),
  a: z.number().min(0).max(1).default(1),
});

const FillSchema = z.object({
  type: z.literal("SOLID"),
  color: ColorSchema,
});

const StrokeSchema = z.object({
  type: z.literal("SOLID"),
  color: ColorSchema,
  weight: z.number().default(1),
});

const TextStyleSchema = z.object({
  fontFamily: z.string().default("Inter"),
  fontWeight: z.number().default(400),
  fontSize: z.number().default(14),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  textAlignHorizontal: z
    .enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"])
    .default("LEFT"),
  color: ColorSchema.optional(),
});

const AutoLayoutSchema = z.object({
  mode: z.enum(["HORIZONTAL", "VERTICAL"]),
  spacing: z.number().default(0),
  paddingTop: z.number().default(0),
  paddingRight: z.number().default(0),
  paddingBottom: z.number().default(0),
  paddingLeft: z.number().default(0),
  primaryAxisAlignItems: z
    .enum(["MIN", "CENTER", "MAX", "SPACE_BETWEEN"])
    .default("MIN"),
  counterAxisAlignItems: z.enum(["MIN", "CENTER", "MAX"]).default("MIN"),
  primaryAxisSizingMode: z.enum(["FIXED", "AUTO"]).default("AUTO"),
  counterAxisSizingMode: z.enum(["FIXED", "AUTO"]).default("AUTO"),
});

// --- Node Schemas (recursive) ---
// We use z.lazy() for recursive references and avoid explicit ZodType annotations
// to prevent incompatibilities between Zod's inferred types and our interfaces.

const BaseNodeFields = {
  name: z.string(),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number(),
  height: z.number(),
  opacity: z.number().min(0).max(1).default(1),
  visible: z.boolean().default(true),
  cornerRadius: z.number().optional(),
} as const;

const FrameNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("frame"),
  fills: z.array(FillSchema).default([]),
  strokes: z.array(StrokeSchema).default([]),
  autoLayout: AutoLayoutSchema.optional(),
  children: z.lazy(() => z.array(DesignNodeSchema)) as z.ZodType<DesignNode[]>,
});

const ShadcnComponentNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("shadcn-component"),
  componentName: z.string(),
  componentProps: z.record(z.string(), z.unknown()).default({}),
  textContent: z.string().optional(),
  children: z.lazy(() => z.array(DesignNodeSchema)).optional() as z.ZodType<
    DesignNode[] | undefined
  >,
});

const TextNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("text"),
  text: z.string(),
  textStyle: TextStyleSchema.default({}),
});

const RectangleNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("rectangle"),
  fills: z.array(FillSchema).default([]),
  strokes: z.array(StrokeSchema).default([]),
});

const ImageNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("image"),
  imageUrl: z.string().optional(),
  fills: z.array(FillSchema).default([]),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DesignNodeSchema: z.ZodType<DesignNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    FrameNodeSchema as any,
    ShadcnComponentNodeSchema as any,
    TextNodeSchema as any,
    RectangleNodeSchema as any,
    ImageNodeSchema as any,
  ]),
) as any;

// --- Top-level DesignSpec ---

const DesignSpecSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  backgroundColor: ColorSchema.default({ r: 1, g: 1, b: 1, a: 1 }),
  nodes: z.array(DesignNodeSchema),
});

// --- WebSocket Message Schemas ---

const DesignSpecMessageSchema = z.object({
  type: z.literal("design-spec"),
  payload: DesignSpecSchema,
});

const StatusMessageSchema = z.object({
  type: z.literal("status"),
  payload: z.object({
    status: z.enum(["connected", "building", "progress", "complete", "error"]),
    message: z.string().optional(),
    progress: z.number().min(0).max(100).optional(),
  }),
});

const WebSocketMessageSchema = z.discriminatedUnion("type", [
  DesignSpecMessageSchema,
  StatusMessageSchema,
]);

// --- TypeScript Types ---

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Fill {
  type: "SOLID";
  color: Color;
}

export interface Stroke {
  type: "SOLID";
  color: Color;
  weight: number;
}

export interface TextStyle {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlignHorizontal: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  color?: Color;
}

export interface AutoLayout {
  mode: "HORIZONTAL" | "VERTICAL";
  spacing: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  primaryAxisAlignItems: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems: "MIN" | "CENTER" | "MAX";
  primaryAxisSizingMode: "FIXED" | "AUTO";
  counterAxisSizingMode: "FIXED" | "AUTO";
}

interface BaseNode {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  cornerRadius?: number;
}

export interface FrameNode extends BaseNode {
  type: "frame";
  fills: Fill[];
  strokes: Stroke[];
  autoLayout?: AutoLayout;
  children: DesignNode[];
}

export interface ShadcnComponentNode extends BaseNode {
  type: "shadcn-component";
  componentName: string;
  componentProps: Record<string, unknown>;
  textContent?: string;
  children?: DesignNode[];
}

export interface TextNode extends BaseNode {
  type: "text";
  text: string;
  textStyle: TextStyle;
}

export interface RectangleNode extends BaseNode {
  type: "rectangle";
  fills: Fill[];
  strokes: Stroke[];
}

export interface ImageNode extends BaseNode {
  type: "image";
  imageUrl?: string;
  fills: Fill[];
}

export type DesignNode =
  | FrameNode
  | ShadcnComponentNode
  | TextNode
  | RectangleNode
  | ImageNode;

export interface DesignSpec {
  version: 1;
  name: string;
  width: number;
  height: number;
  backgroundColor: Color;
  nodes: DesignNode[];
}

export type WebSocketMessage =
  | { type: "design-spec"; payload: DesignSpec }
  | {
      type: "status";
      payload: {
        status: "connected" | "building" | "progress" | "complete" | "error";
        message?: string;
        progress?: number;
      };
    };

// --- Exports ---

export {
  DesignSpecSchema,
  DesignNodeSchema,
  WebSocketMessageSchema,
  ColorSchema,
  TextStyleSchema,
  AutoLayoutSchema,
};
