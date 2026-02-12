/// <reference types="@figma/plugin-typings" />

import type {
  DesignNode,
  FrameNode as SpecFrameNode,
  TextNode as SpecTextNode,
  RectangleNode as SpecRectangleNode,
  ImageNode as SpecImageNode,
  ShadcnComponentNode,
  Color,
  Fill,
} from "../../../shared/src/design-spec";
import { importShadcnComponent } from "./component-importer";

function sendProgress(message: string, progress?: number) {
  figma.ui.postMessage({
    type: "build-progress",
    message,
    progress,
  });
}

/**
 * Recursively build Figma nodes from a DesignSpec node tree.
 */
export async function buildNodes(
  nodes: DesignNode[],
  parent: FrameNode | PageNode,
  totalNodes: number,
  builtCount: { count: number },
): Promise<void> {
  for (const node of nodes) {
    const figmaNode = await buildSingleNode(node);
    if (figmaNode) {
      parent.appendChild(figmaNode);
    }

    builtCount.count++;
    const progress = Math.round((builtCount.count / totalNodes) * 100);
    sendProgress(`Building: ${node.name}`, progress);
  }
}

async function buildSingleNode(node: DesignNode): Promise<SceneNode | null> {
  switch (node.type) {
    case "frame":
      return buildFrame(node);
    case "shadcn-component":
      return buildShadcnComponent(node);
    case "text":
      return buildText(node);
    case "rectangle":
      return buildRectangle(node);
    case "image":
      return buildImage(node);
    default:
      return null;
  }
}

async function buildFrame(node: SpecFrameNode): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = node.name;
  frame.x = node.x;
  frame.y = node.y;
  frame.resize(node.width, node.height);

  if (node.opacity !== undefined) frame.opacity = node.opacity;
  if (node.visible !== undefined) frame.visible = node.visible;
  if (node.cornerRadius) frame.cornerRadius = node.cornerRadius;

  // Fills
  if (node.fills && node.fills.length > 0) {
    frame.fills = node.fills.map(toFigmaFill);
  } else {
    frame.fills = [];
  }

  // Strokes
  if (node.strokes && node.strokes.length > 0) {
    frame.strokes = node.strokes.map((s) => ({
      type: "SOLID" as const,
      color: toRGB(s.color),
      opacity: s.color.a,
    }));
    frame.strokeWeight = node.strokes[0].weight || 1;
  }

  // Auto Layout
  if (node.autoLayout) {
    const al = node.autoLayout;
    frame.layoutMode = al.mode;
    frame.itemSpacing = al.spacing;
    frame.paddingTop = al.paddingTop;
    frame.paddingRight = al.paddingRight;
    frame.paddingBottom = al.paddingBottom;
    frame.paddingLeft = al.paddingLeft;
    frame.primaryAxisAlignItems = al.primaryAxisAlignItems;
    frame.counterAxisAlignItems = al.counterAxisAlignItems;

    if (al.primaryAxisSizingMode === "AUTO") {
      frame.primaryAxisSizingMode = "AUTO";
    }
    if (al.counterAxisSizingMode === "AUTO") {
      frame.counterAxisSizingMode = "AUTO";
    }
  }

  // Build children recursively
  if (node.children && node.children.length > 0) {
    const counter = { count: 0 };
    await buildNodes(node.children, frame, node.children.length, counter);
  }

  return frame;
}

async function buildShadcnComponent(
  node: ShadcnComponentNode,
): Promise<SceneNode> {
  return importShadcnComponent(node);
}

async function buildText(node: SpecTextNode): Promise<TextNode> {
  const textNode = figma.createText();
  textNode.name = node.name;
  textNode.x = node.x;
  textNode.y = node.y;

  const style = node.textStyle;
  const fontFamily = style.fontFamily || "Inter";
  const fontWeight = style.fontWeight || 400;

  // Map weight to Figma font style
  const fontStyle = weightToStyle(fontWeight);

  try {
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
  } catch {
    // Fallback to Inter Regular
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  }

  textNode.characters = node.text;
  textNode.fontSize = style.fontSize || 14;

  try {
    textNode.fontName = { family: fontFamily, style: fontStyle };
  } catch {
    textNode.fontName = { family: "Inter", style: "Regular" };
  }

  if (style.lineHeight) {
    textNode.lineHeight = { value: style.lineHeight, unit: "PIXELS" };
  }

  if (style.letterSpacing) {
    textNode.letterSpacing = { value: style.letterSpacing, unit: "PIXELS" };
  }

  if (style.textAlignHorizontal) {
    textNode.textAlignHorizontal = style.textAlignHorizontal;
  }

  if (style.color) {
    textNode.fills = [
      {
        type: "SOLID",
        color: toRGB(style.color),
        opacity: style.color.a,
      },
    ];
  }

  // Resize after setting text
  textNode.resize(node.width, node.height);

  if (node.opacity !== undefined) textNode.opacity = node.opacity;
  if (node.visible !== undefined) textNode.visible = node.visible;

  return textNode;
}

async function buildRectangle(node: SpecRectangleNode): Promise<RectangleNode> {
  const rect = figma.createRectangle();
  rect.name = node.name;
  rect.x = node.x;
  rect.y = node.y;
  rect.resize(node.width, node.height);

  if (node.cornerRadius) rect.cornerRadius = node.cornerRadius;
  if (node.opacity !== undefined) rect.opacity = node.opacity;
  if (node.visible !== undefined) rect.visible = node.visible;

  if (node.fills && node.fills.length > 0) {
    rect.fills = node.fills.map(toFigmaFill);
  }

  if (node.strokes && node.strokes.length > 0) {
    rect.strokes = node.strokes.map((s) => ({
      type: "SOLID" as const,
      color: toRGB(s.color),
      opacity: s.color.a,
    }));
    rect.strokeWeight = node.strokes[0].weight || 1;
  }

  return rect;
}

async function buildImage(node: SpecImageNode): Promise<FrameNode> {
  // Images are represented as frames with an image fill placeholder
  const frame = figma.createFrame();
  frame.name = node.name;
  frame.x = node.x;
  frame.y = node.y;
  frame.resize(node.width, node.height);

  if (node.fills && node.fills.length > 0) {
    frame.fills = node.fills.map(toFigmaFill);
  } else {
    // Light gray placeholder
    frame.fills = [
      {
        type: "SOLID",
        color: { r: 0.9, g: 0.9, b: 0.92 },
      },
    ];
  }

  if (node.cornerRadius) frame.cornerRadius = node.cornerRadius;
  if (node.opacity !== undefined) frame.opacity = node.opacity;

  return frame;
}

// --- Helpers ---

function toRGB(color: Color): RGB {
  return { r: color.r, g: color.g, b: color.b };
}

function toFigmaFill(fill: Fill): SolidPaint {
  return {
    type: "SOLID",
    color: toRGB(fill.color),
    opacity: fill.color.a,
  };
}

function weightToStyle(weight: number): string {
  const map: Record<number, string> = {
    100: "Thin",
    200: "Extra Light",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "Semi Bold",
    700: "Bold",
    800: "Extra Bold",
    900: "Black",
  };
  return map[weight] || "Regular";
}

/**
 * Count total nodes in the tree (for progress tracking).
 */
export function countNodes(nodes: DesignNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.type === "frame" && node.children) {
      count += countNodes(node.children);
    }
    if (node.type === "shadcn-component" && node.children) {
      count += countNodes(node.children);
    }
  }
  return count;
}
