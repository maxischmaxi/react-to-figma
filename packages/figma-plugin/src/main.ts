/// <reference types="@figma/plugin-typings" />

import type { DesignSpec } from "../../shared/src/design-spec";
import { buildNodes, countNodes } from "./builder/node-builder";

figma.showUI(__html__, { width: 320, height: 280 });

figma.ui.onmessage = async (msg: { type: string; payload?: unknown }) => {
  if (msg.type === "build-design") {
    const spec = msg.payload as DesignSpec;
    await buildDesign(spec);
  }
};

async function buildDesign(spec: DesignSpec) {
  try {
    figma.ui.postMessage({
      type: "build-progress",
      message: "Starting build...",
      progress: 0,
    });

    // Create a new page
    const page = figma.createPage();
    page.name = spec.name || "React to Figma Import";
    figma.currentPage = page;

    // Create root frame
    const rootFrame = figma.createFrame();
    rootFrame.name = spec.name;
    rootFrame.resize(spec.width, spec.height);
    rootFrame.x = 0;
    rootFrame.y = 0;

    // Set background color
    rootFrame.fills = [
      {
        type: "SOLID",
        color: {
          r: spec.backgroundColor.r,
          g: spec.backgroundColor.g,
          b: spec.backgroundColor.b,
        },
        opacity: spec.backgroundColor.a,
      },
    ];

    // Count total nodes for progress
    const totalNodes = countNodes(spec.nodes);
    const builtCount = { count: 0 };

    // Build all nodes recursively
    await buildNodes(spec.nodes, rootFrame, totalNodes, builtCount);

    page.appendChild(rootFrame);

    // Zoom to fit
    figma.viewport.scrollAndZoomIntoView([rootFrame]);

    figma.ui.postMessage({
      type: "build-complete",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    figma.ui.postMessage({
      type: "build-error",
      message,
    });
  }
}
